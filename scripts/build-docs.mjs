import fs from "node:fs/promises";
import path from "node:path";

import { DOCS_DIR, DOCS_HUB_PATH, SITEMAP_PATH } from "./lib/paths.mjs";
import { getNotionClient } from "./notion/notion-client.mjs";
import { fetchPublishedDocTopics, walkDocTopic, flattenDocTree } from "./notion/fetch-docs.mjs";
import { renderSectionBody } from "./notion/blocks-to-html.mjs";
import { downloadDocImage } from "./notion/download-images.mjs";
import { renderDocsHubPage, renderDocsPage } from "./render/docs-template.mjs";
import { urlEntry, insertSitemapEntries } from "./render/sitemap.mjs";
import { defaultOgImageUrl } from "./render/seo.mjs";

async function pruneStaleTopicDirs(currentSlugs) {
	let entries;
	try {
		entries = await fs.readdir(DOCS_DIR, { withFileTypes: true });
	} catch (err) {
		if (err.code === "ENOENT") return;
		throw err;
	}
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name === "img") continue;
		if (!currentSlugs.has(entry.name)) {
			await fs.rm(path.join(DOCS_DIR, entry.name), { recursive: true, force: true });
		}
	}
}

function assertUniqueTopicSlugs(topics) {
	const seen = new Map();
	for (const t of topics) {
		if (seen.has(t.slug)) {
			throw new Error(`Duplicate doc topic Slug "${t.slug}" on both "${seen.get(t.slug)}" and "${t.title}".`);
		}
		seen.set(t.slug, t.title);
	}
}

async function buildTopic(client, topicMeta, ogImage, warnings) {
	const topicRoot = await walkDocTopic(client, topicMeta);
	const nodes = flattenDocTree(topicRoot);

	const topicDir = path.join(DOCS_DIR, topicMeta.slug);
	await fs.mkdir(topicDir, { recursive: true });

	const sitemapEntries = [];
	const currentFilenames = new Set();
	for (const node of nodes) {
		const isOverview = node.id === topicRoot.id;
		const pageSlug = isOverview ? "_root" : node.slug;
		const imageCounter = { n: 0 };
		const downloadImage = (src, index) => downloadDocImage(src, topicMeta.slug, pageSlug, index);
		const bodyHtml = await renderSectionBody(
			client,
			node.bodyBlocks,
			`${topicMeta.slug}/${pageSlug}`,
			imageCounter,
			warnings,
			downloadImage
		);

		const html = renderDocsPage({ topic: topicMeta, topicRoot, node, bodyHtml, ogImage });
		const filename = isOverview ? "index.html" : `${node.slug}.html`;
		await fs.writeFile(path.join(topicDir, filename), html, "utf8");
		sitemapEntries.push(urlEntry(`docs/${topicMeta.slug}/${filename}`));
		currentFilenames.add(filename);
	}

	const existingEntries = await fs.readdir(topicDir, { withFileTypes: true });
	for (const entry of existingEntries) {
		if (entry.isFile() && entry.name.endsWith(".html") && !currentFilenames.has(entry.name)) {
			await fs.rm(path.join(topicDir, entry.name), { force: true });
		}
	}

	return sitemapEntries;
}

async function main() {
	console.log("[build-docs] Fetching published doc topics from Notion…");
	const client = getNotionClient();
	const topics = await fetchPublishedDocTopics();
	console.log(`[build-docs] ${topics.length} published topic(s) found.`);
	assertUniqueTopicSlugs(topics);

	await fs.mkdir(DOCS_DIR, { recursive: true });
	await pruneStaleTopicDirs(new Set(topics.map((t) => t.slug)));
	const ogImage = await defaultOgImageUrl();
	const warnings = [];

	let sitemapEntries = [urlEntry("docs/index.html")];
	for (const topic of topics) {
		console.log(`[build-docs] Rendering topic "${topic.title}" (${topic.slug})…`);
		sitemapEntries = sitemapEntries.concat(await buildTopic(client, topic, ogImage, warnings));
	}

	warnings.forEach((w) => console.warn(`[build-docs] ${w}`));

	await fs.writeFile(DOCS_HUB_PATH, renderDocsHubPage(topics, ogImage), "utf8");

	const existingSitemap = await fs.readFile(SITEMAP_PATH, "utf8");
	await fs.writeFile(SITEMAP_PATH, insertSitemapEntries(existingSitemap, sitemapEntries), "utf8");

	console.log(`[build-docs] Done. ${topics.length} topic(s), ${sitemapEntries.length - 1} page(s).`);
}

main().catch((err) => {
	console.error("[build-docs] Build failed:", err.message);
	console.error(err.stack);
	process.exit(1);
});
