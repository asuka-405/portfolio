import fs from "node:fs/promises";
import path from "node:path";

import { ROOT, DOCS_DIR } from "./paths.mjs";
import { escapeHtml, slugify } from "./html.mjs";
import { humanizeHtml } from "./humanize.mjs";
import { renderMarkdownBody } from "./markdown.mjs";
import { renderDocsPage } from "../render/docs-template.mjs";
import { urlEntry } from "../render/sitemap.mjs";

// Hand-written docs topics live in docs-src/<slug>/ as Markdown, outside the Notion pipeline:
//   _topic.json   { title, slug, icon, summary, order }
//   index.md      the topic overview (its sidebar entry is the topic title)
//   NN-name.md    one docs page each, ordered by file name; front matter holds `title:`
// They render through the same template as Notion topics, so build-docs.mjs can mix both.

export const LOCAL_DOCS_DIR = path.join(ROOT, "docs-src");

function parseFrontMatter(raw) {
	const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw.replace(/\r\n/g, "\n"));
	if (!m) return { meta: {}, body: raw };
	const meta = {};
	for (const line of m[1].split("\n")) {
		const kv = /^(\w+):\s*(.*)$/.exec(line);
		if (kv) meta[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
	}
	return { meta, body: raw.replace(/\r\n/g, "\n").slice(m[0].length) };
}

/** Reads every docs-src topic: its metadata plus the parsed pages in reading order. */
export async function loadLocalTopics() {
	let entries;
	try {
		entries = await fs.readdir(LOCAL_DOCS_DIR, { withFileTypes: true });
	} catch (err) {
		if (err.code === "ENOENT") return [];
		throw err;
	}

	const topics = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const dir = path.join(LOCAL_DOCS_DIR, entry.name);
		let topicMeta;
		try {
			topicMeta = JSON.parse(await fs.readFile(path.join(dir, "_topic.json"), "utf8"));
		} catch (err) {
			if (err.code === "ENOENT") continue; // helper folders such as tools/ are not topics
			throw err;
		}
		const slug = topicMeta.slug || entry.name;

		const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md")).sort();
		const pages = [];
		for (const file of files) {
			const { meta, body } = parseFrontMatter(await fs.readFile(path.join(dir, file), "utf8"));
			if (!meta.title) throw new Error(`docs-src/${entry.name}/${file} is missing a "title:" in its front matter.`);
			pages.push({ file, isOverview: file === "index.md", title: meta.title, slug: slugify(meta.title), body });
		}
		if (!pages.some((p) => p.isOverview)) throw new Error(`docs-src/${entry.name}/ needs an index.md overview page.`);

		topics.push({
			id: `local-${slug}`,
			slug,
			title: topicMeta.title,
			summary: topicMeta.summary || "",
			icon: topicMeta.icon || "📄",
			order: typeof topicMeta.order === "number" ? topicMeta.order : 99,
			pages,
		});
	}
	return topics.sort((a, b) => a.order - b.order);
}

function contentsHtml(headings) {
	const items = headings.map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join("");
	return `<div class="prose reveal">\n\t\t\t\t\t<p><strong>On this page</strong></p>\n\t\t\t\t\t<ul>${items}</ul>\n\t\t\t\t</div>`;
}

/** Writes docs/<slug>/*.html for one local topic and returns its sitemap entries. */
export async function renderLocalTopic(topic, ogImage = null) {
	const used = new Set();
	const uniqueSlug = (base) => {
		let slug = base || "page";
		for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
		used.add(slug);
		return slug;
	};

	const children = topic.pages
		.filter((p) => !p.isOverview)
		.map((p) => ({ id: `${topic.id}/${p.file}`, title: p.title, slug: uniqueSlug(p.slug), children: [], page: p }));
	const topicRoot = { id: topic.id, title: topic.title, icon: topic.icon, slug: "index", children };
	const overview = topic.pages.find((p) => p.isOverview);

	const topicDir = path.join(DOCS_DIR, topic.slug);
	await fs.mkdir(topicDir, { recursive: true });

	const sitemapEntries = [];
	const written = new Set();
	const targets = [{ node: topicRoot, page: overview, filename: "index.html" }].concat(
		children.map((c) => ({ node: c, page: c.page, filename: `${c.slug}.html` }))
	);

	for (const { node, page, filename } of targets) {
		const headings = [];
		let bodyHtml = await renderMarkdownBody(page.body, headings);
		if (headings.length >= 4) bodyHtml = `${contentsHtml(headings)}\n\n${bodyHtml}`;
		const html = renderDocsPage({ topic, topicRoot, node, bodyHtml, ogImage });
		await fs.writeFile(path.join(topicDir, filename), humanizeHtml(html), "utf8");
		sitemapEntries.push(urlEntry(`docs/${topic.slug}/${filename}`));
		written.add(filename);
	}

	for (const entry of await fs.readdir(topicDir, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(".html") && !written.has(entry.name)) {
			await fs.rm(path.join(topicDir, entry.name), { force: true });
		}
	}
	return sitemapEntries;
}
