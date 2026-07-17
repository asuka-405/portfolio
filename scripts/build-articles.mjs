import fs from "node:fs/promises";
import path from "node:path";

import {
	ROOT,
	ARTICLES_DIR,
	GENERATED_DIR,
	HUB_PATH,
	HOMEPAGE_PATH,
	LEGACY_DATA_PATH,
	MARKER_START,
	MARKER_END,
	HOMEPAGE_TEASER_COUNT,
} from "./lib/paths.mjs";
import { stripHtml, escapeHtml } from "./lib/html.mjs";
import { getNotionClient } from "./notion/notion-client.mjs";
import { fetchPublishedArticles } from "./notion/fetch-articles.mjs";
import { convertPageToSections } from "./notion/blocks-to-html.mjs";
import { downloadArticleImage } from "./notion/download-images.mjs";
import { computeReadTime } from "./render/word-count.mjs";
import {
	renderArticlePage,
	renderHomepageListFragment,
	renderHubPage,
	renderFeaturedPage,
} from "./render/article-template.mjs";
import { buildSearchIndex } from "./render/search-index.mjs";
import { loadAdsConfig } from "./render/ads.mjs";
import { SITE_URL, defaultOgImageUrl } from "./render/seo.mjs";
import { buildSitemap } from "./render/sitemap.mjs";

async function loadLegacyArticles() {
	const raw = await fs.readFile(LEGACY_DATA_PATH, "utf8");
	return JSON.parse(raw).map((a) => ({
		...a,
		bodyText: "",
		hrefRoot: a.href,
		hrefArticles: a.href.replace(/^articles\//, ""),
	}));
}

function formatDateLabel(isoDate) {
	const d = new Date(isoDate);
	return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Fails the build (rather than silently overwriting a file) if two Notion articles share a
 * slug, or a Notion slug collides with a legacy hand-written article's filename.
 */
function assertUniqueSlugs(notionMeta, legacyArticles) {
	const legacySlugs = new Set(legacyArticles.map((a) => a.hrefArticles.replace(/\.html$/, "")));
	const seen = new Map();
	for (const meta of notionMeta) {
		if (legacySlugs.has(meta.slug)) {
			throw new Error(
				`Notion article "${meta.title}" has Slug "${meta.slug}", which collides with an existing hand-written article (articles/${meta.slug}.html). Pick a different Slug.`
			);
		}
		if (seen.has(meta.slug)) {
			throw new Error(
				`Duplicate Slug "${meta.slug}" on both "${seen.get(meta.slug)}" and "${meta.title}" in Notion. Slugs must be unique.`
			);
		}
		seen.set(meta.slug, meta.title);
	}
}

async function buildNotionArticle(client, meta) {
	const { sections, warnings } = await convertPageToSections(client, meta.id, meta.slug);
	warnings.forEach((w) => console.warn(`[build-articles] ${meta.title}: ${w}`));

	const readTime = computeReadTime(
		sections.map((s) => s.bodyHtml),
		meta.readTimeOverride
	);
	const tagsLabel = meta.tags.join(" · ");
	const bodyText = stripHtml(sections.map((s) => s.bodyHtml).join(" "));

	let ogImage = null;
	if (meta.cover) {
		const localSrc = await downloadArticleImage(meta.cover, meta.slug, "cover");
		ogImage = `${SITE_URL}/articles/generated/${localSrc}`;
	} else {
		ogImage = await defaultOgImageUrl();
	}

	const adsConfig = await loadAdsConfig();
	const html = renderArticlePage({
		title: meta.title,
		description: meta.summary,
		eyebrowLabel: meta.eyebrow,
		dateLabel: formatDateLabel(meta.publishDate),
		readTimeLabel: readTime,
		tagsLabel,
		taglineHtml: escapeHtml(meta.summary),
		sectionsHtml: sections,
		adsConfig,
		canonicalPath: `articles/generated/${meta.slug}.html`,
		ogImage,
		publishedTimeIso: meta.publishDate,
		tags: meta.tags,
	});

	await fs.mkdir(GENERATED_DIR, { recursive: true });
	await fs.writeFile(path.join(GENERATED_DIR, `${meta.slug}.html`), html, "utf8");

	return {
		kind: "notion",
		title: meta.title,
		hrefRoot: `articles/generated/${meta.slug}.html`,
		hrefArticles: `generated/${meta.slug}.html`,
		tag: tagsLabel || "Article",
		tags: meta.tags,
		readTime,
		summary: meta.summary,
		date: meta.publishDate,
		featured: meta.featured,
		bodyText,
	};
}

async function rewriteHomepage(teaserArticles) {
	const html = await fs.readFile(HOMEPAGE_PATH, "utf8");
	const startIdx = html.indexOf(MARKER_START);
	const endIdx = html.indexOf(MARKER_END);
	if (startIdx === -1 || endIdx === -1) {
		throw new Error(
			`Could not find ${MARKER_START} / ${MARKER_END} markers in index.html — the homepage article list must be wrapped in these comments before running the build.`
		);
	}
	const before = html.slice(0, startIdx + MARKER_START.length);
	const after = html.slice(endIdx);
	const fragment = renderHomepageListFragment(teaserArticles);
	await fs.writeFile(HOMEPAGE_PATH, `${before}\n${fragment}\n\t\t\t\t\t${after}`, "utf8");
}

async function main() {
	console.log("[build-articles] Fetching published articles from Notion…");
	const client = getNotionClient();
	const notionMeta = await fetchPublishedArticles();
	console.log(`[build-articles] ${notionMeta.length} published article(s) found.`);

	const legacyArticles = await loadLegacyArticles();
	assertUniqueSlugs(notionMeta, legacyArticles);

	const notionArticles = [];
	for (const meta of notionMeta) {
		console.log(`[build-articles] Rendering "${meta.title}" (${meta.slug})…`);
		notionArticles.push(await buildNotionArticle(client, meta));
	}

	const allArticles = [...legacyArticles, ...notionArticles].sort(
		(a, b) => new Date(b.date) - new Date(a.date)
	);

	// Two href bases: pages served from repo root (index.html) need "articles/…" hrefs;
	// pages served from articles/ (hub, featured) need hrefs relative to that directory.
	const forArticlesDir = allArticles.map((a) => ({ ...a, href: a.hrefArticles }));
	const forRoot = allArticles.map((a) => ({ ...a, href: a.hrefRoot }));

	const adsConfig = await loadAdsConfig();
	const listingOgImage = await defaultOgImageUrl();

	await fs.mkdir(ARTICLES_DIR, { recursive: true });
	await fs.writeFile(HUB_PATH, renderHubPage(forArticlesDir, adsConfig, listingOgImage), "utf8");

	const featured = forArticlesDir.filter((a) => a.featured);
	await fs.writeFile(
		path.join(ARTICLES_DIR, "featured.html"),
		renderFeaturedPage(featured, adsConfig, listingOgImage),
		"utf8"
	);

	await fs.mkdir(GENERATED_DIR, { recursive: true });
	await fs.writeFile(
		path.join(GENERATED_DIR, "search-index.json"),
		JSON.stringify(buildSearchIndex(forArticlesDir)),
		"utf8"
	);

	await fs.writeFile(path.join(ROOT, "sitemap.xml"), buildSitemap(allArticles), "utf8");

	await rewriteHomepage(forRoot.slice(0, HOMEPAGE_TEASER_COUNT));

	console.log(
		`[build-articles] Done. ${notionArticles.length} Notion article(s), ${legacyArticles.length} legacy article(s), ${featured.length} featured.`
	);
}

main().catch((err) => {
	console.error("[build-articles] Build failed:", err.message);
	console.error(err.stack);
	process.exit(1);
});
