import fs from "node:fs/promises";

import { DOCS_HUB_PATH, SITEMAP_PATH } from "./lib/paths.mjs";
import { loadLocalTopics, renderLocalTopic } from "./lib/local-docs.mjs";
import { insertSitemapEntries } from "./render/sitemap.mjs";
import { defaultOgImageUrl } from "./render/seo.mjs";
import { escapeHtml } from "./lib/html.mjs";

// Offline counterpart to build-docs.mjs: renders only the Markdown topics in docs-src/ (no Notion
// token needed) and patches the existing docs hub and sitemap in place. A full `npm run build`
// regenerates both from scratch and includes these same topics.

function hubCard(topic) {
	return `\t\t<a class="article-card reveal" href="${escapeHtml(topic.slug)}/index.html">
\t\t\t<div class="a-meta">
\t\t\t\t<span class="tag">${escapeHtml(topic.icon)}</span>
\t\t\t</div>
\t\t\t<h3>${escapeHtml(topic.title)}</h3>
\t\t\t<p>${escapeHtml(topic.summary)}</p>
\t\t\t<span class="a-more">Open →</span>
\t\t</a>`;
}

async function patchHub(topic) {
	const hub = await fs.readFile(DOCS_HUB_PATH, "utf8");
	const href = `href="${topic.slug}/index.html"`;
	const card = hubCard(topic);
	const cardRe = new RegExp(`\\t\\t<a class="article-card reveal" ${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}>[\\s\\S]*?</a>`);
	if (cardRe.test(hub)) return hub.replace(cardRe, card);

	// New topic: place it after the AI in IAM card when present, else at the end of the list.
	const anchor = /(\t\t<a class="article-card reveal" href="ai-in-iam\/index\.html">[\s\S]*?<\/a>)/.exec(hub);
	if (anchor) return hub.replace(anchor[1], `${anchor[1]}\n${card}`);
	return hub.replace(/(\n\t\t\t\t<\/div>\n\t\t\t<\/section>)/, `\n${card}$1`);
}

async function main() {
	const topics = await loadLocalTopics();
	if (topics.length === 0) {
		console.log("[build-local-docs] No topics in docs-src/.");
		return;
	}
	const ogImage = await defaultOgImageUrl();

	let sitemap = await fs.readFile(SITEMAP_PATH, "utf8");
	for (const topic of topics) {
		console.log(`[build-local-docs] Rendering "${topic.title}" (${topic.slug}), ${topic.pages.length} page(s)…`);
		const entries = await renderLocalTopic(topic, ogImage);
		const fresh = entries.filter((e) => !sitemap.includes(e.match(/<loc>(.*?)<\/loc>/)[1]));
		sitemap = insertSitemapEntries(sitemap, fresh);
		await fs.writeFile(DOCS_HUB_PATH, await patchHub(topic), "utf8");
	}
	await fs.writeFile(SITEMAP_PATH, sitemap, "utf8");
	console.log("[build-local-docs] Done.");
}

main().catch((err) => {
	console.error("[build-local-docs] Build failed:", err.message);
	console.error(err.stack);
	process.exit(1);
});
