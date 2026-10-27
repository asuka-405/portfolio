// Builds the search index the on-device site assistant reads (assistant/index/*.json).
// No dependencies: it reads the built HTML pages in the repo, so run it after the docs/articles build.
//
//   site.json        every page (title, summary), the compact sitemap text, and chunks for all non-docs pages
//   docs-<topic>.json  chunks for one docs topic, fetched only when that topic is relevant
import fs from "node:fs/promises";
import path from "node:path";

import { ROOT } from "./lib/paths.mjs";

const OUT_DIR = path.join(ROOT, "assistant", "index");
const CHUNK_TARGET = 900; // characters per chunk, split at paragraph boundaries
const CHUNK_MAX = 1400;
const CODE_MAX = 700; // long code blocks are cut so one example cannot fill a chunk

const SKIP_DIRS = new Set(["node_modules", ".git", "docs-src", "app-preview", "assistant", "scripts", "data", "assets", ".cache"]);
const SITE_NAME = /\s*[·|—-]\s*Suryansh Kapil\s*$/i;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rarr: "→", larr: "←", middot: "·", copy: "©" };
function decode(s) {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
		if (e[0] === "#") {
			const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
		}
		return ENTITIES[e.toLowerCase()] ?? m;
	});
}

const squash = (s) => decode(s).replace(/[ \t\r\f\v]+/g, " ").replace(/ *\n */g, "\n").trim();

function metaContent(html, name) {
	const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i"));
	const c = m && m[0].match(/content=("([^"]*)"|'([^']*)')/i);
	return c ? squash(c[2] ?? c[3] ?? "") : "";
}

function pageTitle(html) {
	const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	return t ? squash(t[1]).replace(SITE_NAME, "") : "";
}

/** Turn a page's <main> into blocks: { k: "h1"|"h2"|"h3"|"p"|"code", t }. */
function extractBlocks(html) {
	let body = html.replace(/<!--[\s\S]*?-->/g, "");
	const main = body.match(/<main[\s\S]*?<\/main>/i);
	if (main) body = main[0];
	// Demo/info JSON (works hub tiles) becomes plain paragraphs before scripts are dropped.
	const extra = [];
	body = body.replace(/<script[^>]*type=["']application\/json["'][^>]*class=["']info["'][^>]*>([\s\S]*?)<\/script>/gi, (_, j) => {
		try {
			const d = JSON.parse(j);
			extra.push(`${d.name}: ${d.ind}. ${d.desc} Includes: ${(d.chips || []).join(", ")}.`);
		} catch {}
		return "";
	});
	body = body
		.replace(/<(script|style|svg|button|select|textarea|option|template|iframe|canvas)\b[\s\S]*?<\/\1>/gi, " ")
		.replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
		.replace(/<header class="site-header"[\s\S]*?<\/header>/gi, " ")
		.replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
		.replace(/<div[^>]*class="[^"]*embed-head[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ")
		.replace(/<(a|div)[^>]*class="[^"]*(?:back-link|docs-sidebar-toggle|skip)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, " ");

	const blocks = [];
	let para = "";
	const flush = () => {
		const t = squash(para);
		if (t) blocks.push({ k: "p", t });
		para = "";
	};
	const re = /<pre\b[^>]*>([\s\S]*?)<\/pre>|<(\/?)([a-z][a-z0-9]*)\b[^>]*>|([^<]+)/gi;
	let m;
	let heading = null;
	while ((m = re.exec(body))) {
		if (m[1] !== undefined) {
			flush();
			const code = decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+$/g, "");
			if (code.trim() && !blocks.some((b) => b.k === "code" && b.t === code)) blocks.push({ k: "code", t: code });
		} else if (m[3]) {
			const close = m[2] === "/";
			const tag = m[3].toLowerCase();
			if (/^h[1-3]$/.test(tag)) {
				if (!close) {
					flush();
					heading = tag;
				} else {
					const t = squash(para);
					para = "";
					if (t) blocks.push({ k: heading || tag, t });
					heading = null;
				}
			} else if (/^(p|li|tr|div|section|article|ul|ol|table|br|blockquote|dd|dt|figure|figcaption|details|summary)$/.test(tag)) {
				if (!heading) flush();
			} else if (tag === "td" || tag === "th") {
				if (close) para += " | ";
			}
		} else if (m[4]) {
			para += m[4];
		}
	}
	flush();
	for (const t of extra) blocks.push({ k: "p", t });
	return blocks;
}

/** Group blocks into heading-scoped chunks of roughly CHUNK_TARGET characters. */
function toChunks(url, title, blocks) {
	const chunks = [];
	let h = "";
	let buf = [];
	let len = 0;
	const emit = () => {
		const x = buf.join("\n").trim();
		if (x.length > 30) chunks.push({ u: url, h, x });
		buf = [];
		len = 0;
	};
	for (const b of blocks) {
		if (b.k === "h1") {
			// the page title; keep it as the opening heading without starting a chunk of its own
			if (!h) h = b.t;
			continue;
		}
		if (b.k === "h2" || b.k === "h3") {
			emit();
			h = b.t;
			continue;
		}
		let t = b.t;
		if (b.k === "code") {
			if (t.length > CODE_MAX) t = t.slice(0, CODE_MAX).replace(/\n[^\n]*$/, "") + "\n…";
			t = "```\n" + t + "\n```";
		}
		if (len + t.length > CHUNK_MAX && buf.length) emit();
		buf.push(t);
		len += t.length;
		if (len >= CHUNK_TARGET) emit();
	}
	emit();
	if (!chunks.length) chunks.push({ u: url, h: "", x: title });
	return chunks;
}

async function* walk(dir, rel = "") {
	for (const e of await fs.readdir(dir, { withFileTypes: true })) {
		if (e.name.startsWith(".")) continue;
		const r = rel ? `${rel}/${e.name}` : e.name;
		if (e.isDirectory()) {
			if (SKIP_DIRS.has(e.name) && !rel) continue;
			// Each works/<demo>/ is its own sample site; the works hub page describes them all.
			if (rel === "works") continue;
			yield* walk(path.join(dir, e.name), r);
		} else if (e.name.endsWith(".html")) {
			yield r;
		}
	}
}

async function main() {
	const pages = [];
	const chunksByGroup = new Map(); // "site" | "docs-<topic>" -> chunks

	for await (const rel of walk(ROOT)) {
		if (rel.startsWith("works/") && rel !== "works/index.html") continue;
		const html = await fs.readFile(path.join(ROOT, rel), "utf8");
		const title = pageTitle(html) || rel;
		const desc = metaContent(html, "description");
		const docsTopic = rel.match(/^docs\/([^/]+)\//)?.[1] || null;
		const blocks = extractBlocks(html);
		const chunks = toChunks(rel, title, blocks);
		const group = docsTopic ? `docs-${docsTopic}` : "site";
		if (!chunksByGroup.has(group)) chunksByGroup.set(group, []);
		chunksByGroup.get(group).push(...chunks);
		pages.push({ u: rel, t: title, d: desc.slice(0, 220), ...(docsTopic ? { g: docsTopic } : {}) });
	}
	pages.sort((a, b) => a.u.localeCompare(b.u));

	// Compact sitemap for the system prompt: sections, not every URL (the full list lives in `pages`).
	const by = (f) => pages.filter(f);
	const line = (label, list) => `${label}: ${list.map((p) => `${p.t} (${p.u})`).join("; ")}`;
	const topics = [...new Set(by((p) => p.g).map((p) => p.g))].sort();
	const topicLine = topics.map((tp) => {
		const idx = pages.find((p) => p.u === `docs/${tp}/index.html`);
		return `${idx ? idx.t : tp} (docs/${tp}/, ${by((p) => p.g === tp).length} pages)`;
	});
	const sitemap = [
		`Home: index.html (about, projects, writing, contact)`,
		line("Writing", by((p) => p.u.startsWith("articles/") && !/index\.html$|featured\.html$/.test(p.u))),
		line("Projects", by((p) => p.u.startsWith("projects/"))),
		`Docs hub: docs/index.html. Topics: ${topicLine.join("; ")}`,
		line("Tools", by((p) => /^tools\/[^/]+\/index\.html$/.test(p.u))),
		`Works: works/index.html (sample websites and business apps, the demos open from there)`,
		line("Other", by((p) => p.u === "arch-setup.html")),
	].join("\n");

	// Even shorter, for the CPU model whose prompt processing is slow.
	const stems = (list, strip) => list.map((p) => p.u.replace(strip, "")).join(", ");
	const sitemapShort = [
		"Home: index.html",
		`Writing: articles/{${stems(by((p) => p.u.startsWith("articles/") && !/index\.html$|featured\.html$/.test(p.u)), /^articles\/|\.html$/g)}}.html`,
		`Projects: projects/{${stems(by((p) => p.u.startsWith("projects/")), /^projects\/|\.html$/g)}}.html`,
		`Docs: docs/index.html, topics docs/{${topics.join(", ")}}/`,
		`Tools: tools/{${stems(by((p) => /^tools\/[^/]+\/index\.html$/.test(p.u)), /^tools\/|\/index\.html$/g)}}/`,
		"Works: works/index.html",
	].join("\n");

	await fs.rm(OUT_DIR, { recursive: true, force: true });
	await fs.mkdir(OUT_DIR, { recursive: true });
	const built = new Date().toISOString().slice(0, 10);
	const written = [];
	for (const [group, chunks] of chunksByGroup) {
		const body = group === "site" ? { v: 1, built, sitemap, sitemapShort, pages, chunks } : { v: 1, built, chunks };
		const file = path.join(OUT_DIR, `${group}.json`);
		await fs.writeFile(file, JSON.stringify(body));
		written.push(`${group}.json ${(JSON.stringify(body).length / 1024).toFixed(0)} KB, ${chunks.length} chunks`);
	}
	console.log(`assistant index: ${pages.length} pages\n  ` + written.sort().join("\n  "));
	console.log(`sitemap prompt text: ${sitemap.length} chars (short: ${sitemapShort.length})`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
