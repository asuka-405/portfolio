import { escapeHtml } from "../lib/html.mjs";
import { adsHeadScript, adSlotHtml } from "./ads.mjs";
import { buildSeoTags } from "./seo.mjs";

const THEME_FLASH_SCRIPT = `\t\t<script>
\t\t\t(function () {
\t\t\t\tvar r = document.documentElement;
\t\t\t\tr.className += " js";
\t\t\t\ttry {
\t\t\t\t\tvar t = localStorage.getItem("sk-theme");
\t\t\t\t\tif (t) r.setAttribute("data-theme", t);
\t\t\t\t} catch (e) {}
\t\t\t})();
\t\t</script>`;

const BG_STACK = `\t\t<div class="bg-stack" aria-hidden="true">
\t\t\t<div class="bg-grid"></div>
\t\t\t<div class="bg-grid-accent"></div>
\t\t\t<div class="bg-vignette"></div>
\t\t</div>`;

const SITE_HEADER = `\t\t<header class="site-header">
\t\t\t<a class="site-logo" href="../index.html">suryansh<span class="dot">.</span></a>
\t\t\t<div class="header-right">
\t\t\t\t<nav class="site-nav">
\t\t\t\t\t<a href="../index.html#about">About</a>
\t\t\t\t\t<a href="../index.html#projects">Projects</a>
\t\t\t\t\t<a href="../index.html#writing">Writing</a>
\t\t\t\t\t<a href="../index.html#contact">Contact</a>
\t\t\t\t</nav>
\t\t\t\t<button class="site-theme" type="button" aria-label="Toggle color theme">
\t\t\t\t\t<span class="theme-ic-sun">☀</span>
\t\t\t\t\t<span class="theme-ic-moon">☾</span>
\t\t\t\t</button>
\t\t\t</div>
\t\t</header>`;

const SITE_FOOTER = `\t\t<footer class="site-footer">
\t\t\t<div class="footer-links">
\t\t\t\t<a href="../index.html#writing">More writing</a>
\t\t\t\t<a href="https://github.com/asuka-405" target="_blank" rel="noopener">GitHub</a>
\t\t\t</div>
\t\t\t<p>© <span id="year"></span> <strong>Suryansh Kapil</strong></p>
\t\t</footer>`;

function headBlock({ title, description, adsConfig, seo }) {
	const adsScript = adsConfig ? adsHeadScript(adsConfig) : "";
	const seoTags = seo ? buildSeoTags(seo) : "";
	return `\t<head>
\t\t<meta charset="UTF-8" />
\t\t<meta name="darkreader-lock" />
\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />
\t\t<meta name="description" content="${escapeHtml(description)}" />
\t\t<meta name="color-scheme" content="dark light" />
\t\t<title>${escapeHtml(title)} · Suryansh Kapil</title>
${THEME_FLASH_SCRIPT}
\t\t<link rel="stylesheet" href="../styles.css" />
${seoTags ? seoTags + "\n" : ""}${adsScript ? adsScript + "\n" : ""}\t</head>`;
}

function metaLine({ dateLabel, readTimeLabel, tagsLabel }) {
	const parts = [dateLabel, readTimeLabel, tagsLabel].filter(Boolean);
	return parts
		.map((p, i) => (i === 0 ? `<span>${escapeHtml(p)}</span>` : `<span class="sep">·</span><span>${escapeHtml(p)}</span>`))
		.join("");
}

/** Renders one generated article page, byte-structurally matching articles/*.html. */
export function renderArticlePage({
	title,
	description,
	eyebrowLabel,
	dateLabel,
	readTimeLabel,
	tagsLabel,
	taglineHtml,
	sectionsHtml,
	adsConfig = { enabled: false },
	canonicalPath,
	ogImage,
	publishedTimeIso,
	tags,
}) {
	const seo = canonicalPath
		? { title, description, canonicalPath, ogImage, type: "article", publishedTime: publishedTimeIso, tags }
		: null;
	const sections = sectionsHtml.map(
		(s) => `\t\t\t<section class="doc-section">
${s.kicker ? `\t\t\t\t<p class="doc-kicker">${escapeHtml(s.kicker)}</p>\n` : ""}${s.heading ? `\t\t\t\t<h2>${s.heading}</h2>\n` : ""}${s.bodyHtml}
\t\t\t</section>`
	);
	// One in-article ad slot after the second section, if there's enough content to not feel intrusive.
	if (sections.length > 2) {
		sections.splice(2, 0, adSlotHtml(adsConfig, "midArticle"));
	}
	const sectionsBlock = sections.filter(Boolean).join("\n\n");

	return `<!DOCTYPE html>
<html lang="en">
${headBlock({ title, description, adsConfig, seo })}
\t<body>
${BG_STACK}

${SITE_HEADER}

\t\t<main>
\t\t\t<section class="doc-hero">
\t\t\t\t<div class="hero-ambient" aria-hidden="true"><div class="hero-orbit"></div></div>
\t\t\t\t<a class="back-link reveal" href="../index.html#writing">← Writing</a>
\t\t\t\t<p class="doc-status reveal" style="--d: 0.04s">${escapeHtml(eyebrowLabel)}</p>
\t\t\t\t<h1 class="doc-title reveal" style="--d: 0.08s">${escapeHtml(title)}</h1>
\t\t\t\t<p class="doc-tagline reveal" style="--d: 0.12s">${taglineHtml}</p>
\t\t\t\t<div class="article-meta reveal" style="--d: 0.16s">${metaLine({ dateLabel, readTimeLabel, tagsLabel })}</div>
\t\t\t</section>

${adSlotHtml(adsConfig, "hero")}

${sectionsBlock}
\t\t</main>

${SITE_FOOTER}

\t\t<script src="../app.js" defer></script>
\t</body>
</html>
`;
}

function articleCardHtml(article) {
	const tagsAttr = escapeHtml((article.tags || []).join(","));
	const featuredBadge = article.featured ? `<span class="featured-badge">★ Featured</span>` : "";
	return `\t\t<a class="article-card reveal" href="${escapeHtml(article.href)}" data-tags="${tagsAttr}" data-title="${escapeHtml(article.title.toLowerCase())}">
\t\t\t<div class="a-meta">
\t\t\t\t<span class="tag">${escapeHtml(article.tag)}</span><span>${escapeHtml(article.readTime)}</span>${featuredBadge}
\t\t\t</div>
\t\t\t<h3>${escapeHtml(article.title)}</h3>
\t\t\t<p>${escapeHtml(article.summary)}</p>
\t\t\t<span class="a-more">Read →</span>
\t\t</a>`;
}

/** Renders the homepage's teaser article-list block (the region between the ARTICLES markers). */
export function renderHomepageListFragment(articles) {
	const cards = articles.map(articleCardHtml).join("\n");
	return `\t\t\t\t\t<div class="article-list">
${cards}
\t\t\t\t\t</div>
\t\t\t\t\t<p class="view-all-link">
\t\t\t\t\t\t<a href="articles/index.html">View all articles →</a>
\t\t\t\t\t\t<a href="articles/featured.html">★ Featured →</a>
\t\t\t\t\t</p>`;
}

function filterBarHtml(allTags) {
	const chips = allTags
		.map((t) => `\t\t\t\t\t<button type="button" class="tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
		.join("\n");
	return `\t\t\t\t<div class="article-search">
\t\t\t\t\t<input type="search" id="article-search-input" placeholder="Search articles…" aria-label="Search articles" />
\t\t\t\t</div>
\t\t\t\t<div class="tag-filter-bar" id="tag-filter-bar">
\t\t\t\t\t<button type="button" class="tag-chip tag-chip--all active" data-tag="">All</button>
${chips}
\t\t\t\t</div>
\t\t\t\t<p class="search-empty" id="search-empty" hidden>No articles match your search.</p>`;
}

function uniqueTags(articles) {
	const set = new Set();
	articles.forEach((a) => (a.tags || []).forEach((t) => set.add(t)));
	return [...set].sort();
}

function listingPage({ pageTitle, description, headingLabel, introHtml, backHref, backLabel, articles, adsConfig, canonicalPath, ogImage }) {
	const cards = articles.map(articleCardHtml).join("\n");
	const allTags = uniqueTags(articles);
	const seo = canonicalPath ? { title: pageTitle, description, canonicalPath, ogImage, type: "website" } : null;
	return `<!DOCTYPE html>
<html lang="en">
${headBlock({ title: pageTitle, description, adsConfig, seo })}
\t<body>
${BG_STACK}

${SITE_HEADER}

\t\t<main>
\t\t\t<section class="section" id="writing" style="padding-top: clamp(2rem, 5vw, 3.5rem)">
\t\t\t\t<div class="section-head reveal">
\t\t\t\t\t<a class="back-link reveal" href="${backHref}">← ${escapeHtml(backLabel)}</a>
\t\t\t\t\t<p class="section-eyebrow">Writing</p>
\t\t\t\t\t<h2>${escapeHtml(headingLabel)}</h2>
\t\t\t\t\t<p class="section-intro">${introHtml}</p>
\t\t\t\t</div>
${filterBarHtml(allTags)}
${adSlotHtml(adsConfig, "hub")}
\t\t\t\t<div class="article-list" id="article-list">
${cards}
\t\t\t\t</div>
\t\t\t</section>
\t\t</main>

${SITE_FOOTER}

\t\t<script src="../app.js" defer></script>
\t\t<script src="hub.js" defer></script>
\t</body>
</html>
`;
}

/** Renders the standalone articles hub page listing every article, with search + tag filters. */
export function renderHubPage(articles, adsConfig = { enabled: false }, ogImage = null) {
	return listingPage({
		pageTitle: "Writing",
		description: "All articles by Suryansh Kapil — identity, AI, Linux, and where the craft is heading.",
		headingLabel: "All articles",
		introHtml: "Everything I've written — identity, AI, Linux, and where the craft is heading. Search by phrase or filter by tag.",
		backHref: "../index.html#writing",
		backLabel: "Home",
		articles,
		adsConfig,
		canonicalPath: "articles/index.html",
		ogImage,
	});
}

/** Renders the featured-articles page — only articles with Featured checked in Notion (or "featured": true in data/legacy-articles.json). */
export function renderFeaturedPage(articles, adsConfig = { enabled: false }, ogImage = null) {
	return listingPage({
		pageTitle: "Featured Writing",
		description: "Hand-picked articles by Suryansh Kapil.",
		headingLabel: "★ Featured",
		introHtml: "The pieces I'd point you to first.",
		backHref: "index.html",
		backLabel: "All articles",
		articles,
		adsConfig,
		canonicalPath: "articles/featured.html",
		ogImage,
	});
}
