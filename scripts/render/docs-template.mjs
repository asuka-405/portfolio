import { escapeHtml } from "../lib/html.mjs";
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

/** Same header as article-template.mjs's SITE_HEADER, but parameterized by how many
 * directories deep the page lives (docs/index.html is 1 deep, docs/<topic>/*.html is 2 deep). */
function siteHeader(rootPrefix) {
	return `\t\t<header class="site-header">
\t\t\t<a class="site-logo" href="${rootPrefix}index.html">suryansh<span class="dot">.</span></a>
\t\t\t<div class="header-right">
\t\t\t\t<nav class="site-nav">
\t\t\t\t\t<a href="${rootPrefix}index.html#about">About</a>
\t\t\t\t\t<a href="${rootPrefix}index.html#projects">Projects</a>
\t\t\t\t\t<a href="${rootPrefix}articles/index.html">Writing</a>
\t\t\t\t\t<a href="${rootPrefix}docs/index.html">Docs</a>
\t\t\t\t\t<a href="${rootPrefix}index.html#contact">Contact</a>
\t\t\t\t</nav>
\t\t\t\t<button class="site-theme" type="button" aria-label="Toggle color theme">
\t\t\t\t\t<span class="theme-ic-sun">☀</span>
\t\t\t\t\t<span class="theme-ic-moon">☾</span>
\t\t\t\t</button>
\t\t\t</div>
\t\t</header>`;
}

function siteFooter(rootPrefix) {
	return `\t\t<footer class="site-footer">
\t\t\t<div class="footer-links">
\t\t\t\t<a href="${rootPrefix}docs/index.html">More docs</a>
\t\t\t\t<a href="https://github.com/asuka-405" target="_blank" rel="noopener">GitHub</a>
\t\t\t</div>
\t\t\t<p>© <span id="year"></span> <strong>Suryansh Kapil</strong></p>
\t\t</footer>`;
}

function headBlock({ title, description, seo, rootPrefix }) {
	const seoTags = seo ? buildSeoTags(seo) : "";
	return `\t<head>
\t\t<meta charset="UTF-8" />
\t\t<meta name="darkreader-lock" />
\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />
\t\t<meta name="description" content="${escapeHtml(description)}" />
\t\t<meta name="color-scheme" content="dark light" />
\t\t<title>${escapeHtml(title)} · Suryansh Kapil</title>
${THEME_FLASH_SCRIPT}
\t\t<link rel="stylesheet" href="${rootPrefix}styles.css" />
${seoTags ? seoTags + "\n" : ""}\t</head>`;
}

function topicCardHtml(topic) {
	const icon = topic.icon || "📄";
	return `\t\t<a class="article-card reveal" href="${escapeHtml(topic.slug)}/index.html">
\t\t\t<div class="a-meta">
\t\t\t\t<span class="tag">${escapeHtml(icon)}</span>
\t\t\t</div>
\t\t\t<h3>${escapeHtml(topic.title)}</h3>
\t\t\t<p>${escapeHtml(topic.summary)}</p>
\t\t\t<span class="a-more">Open →</span>
\t\t</a>`;
}

/** Renders docs/index.html — one card per Published topic in the Site Docs database. */
export function renderDocsHubPage(topics, ogImage = null) {
	const rootPrefix = "../";
	const cards = topics.map(topicCardHtml).join("\n");
	const seo = {
		title: "Documentation",
		description: "Deep-dive documentation and full learning courses by Suryansh Kapil.",
		canonicalPath: "docs/index.html",
		ogImage,
		type: "website",
	};
	return `<!DOCTYPE html>
<html lang="en">
${headBlock({ title: "Documentation", description: seo.description, seo, rootPrefix })}
\t<body>
${BG_STACK}

${siteHeader(rootPrefix)}

\t\t<main>
\t\t\t<section class="section" id="docs" style="padding-top: clamp(2rem, 5vw, 3.5rem)">
\t\t\t\t<div class="section-head reveal">
\t\t\t\t\t<a class="back-link reveal" href="../index.html">← Home</a>
\t\t\t\t\t<p class="section-eyebrow">Documentation</p>
\t\t\t\t\t<h2>Docs &amp; courses</h2>
\t\t\t\t\t<p class="section-intro">Deep-dive notes, full courses, and documentation for things I build.</p>
\t\t\t\t</div>
\t\t\t\t<div class="article-list" id="docs-topic-list">
${cards || "\t\t\t\t\t<p class=\"section-intro\">Nothing published yet, check back soon.</p>"}
\t\t\t\t</div>
\t\t\t</section>
\t\t</main>

${siteFooter(rootPrefix)}

\t\t<script src="../app.js" defer></script>
\t</body>
</html>
`;
}

/** Recursively renders the nested `<ul>` sidebar tree for one topic. `nodes` are the topic
 * root's children; the topic root itself is rendered separately as the sidebar's top link. */
function sidebarChildrenHtml(nodes, activeId) {
	if (!nodes || nodes.length === 0) return "";
	const items = nodes
		.map((node) => {
			const active = node.id === activeId ? " active" : "";
			const nested = sidebarChildrenHtml(node.children, activeId);
			return `\t\t\t\t\t<li>\n\t\t\t\t\t\t<a href="${escapeHtml(node.slug)}.html" class="${active.trim()}">${escapeHtml(node.title)}</a>\n${nested}\t\t\t\t\t</li>`;
		})
		.join("\n");
	return `\t\t\t\t<ul>\n${items}\n\t\t\t\t</ul>\n`;
}

function sidebarHtml(topicRoot, activeId) {
	const active = topicRoot.id === activeId ? " active" : "";
	return `\t\t\t<nav class="docs-sidebar" id="docs-sidebar">
\t\t\t\t<div class="docs-sidebar-topic-title">
\t\t\t\t\t<a href="index.html" class="${active.trim()}">${escapeHtml(topicRoot.icon || "📄")} ${escapeHtml(topicRoot.title)}</a>
\t\t\t\t</div>
${sidebarChildrenHtml(topicRoot.children, activeId)}\t\t\t</nav>`;
}

/** Renders one docs page: either a topic's own overview (docs/<topic>/index.html, node === topicRoot)
 * or a nested doc page (docs/<topic>/<page-slug>.html). Both share the same sidebar + two-column layout. */
export function renderDocsPage({ topic, topicRoot, node, bodyHtml, ogImage = null }) {
	const rootPrefix = "../../";
	const isOverview = node.id === topicRoot.id;
	const filename = isOverview ? "index.html" : `${node.slug}.html`;
	const pageTitle = isOverview ? topic.title : node.title;
	const description = isOverview ? topic.summary : `${node.title}: ${topic.title}`;
	const seo = {
		title: pageTitle,
		description,
		canonicalPath: `docs/${topic.slug}/${filename}`,
		ogImage,
		type: "article",
	};

	return `<!DOCTYPE html>
<html lang="en">
${headBlock({ title: pageTitle, description, seo, rootPrefix })}
\t<body>
${BG_STACK}

${siteHeader(rootPrefix)}

\t\t<main>
\t\t\t<section class="section docs-page">
\t\t\t\t<div class="docs-layout">
${sidebarHtml(topicRoot, node.id)}
\t\t\t\t\t<button type="button" class="docs-sidebar-toggle" id="docs-sidebar-toggle" aria-expanded="false" aria-controls="docs-sidebar">Contents ▾</button>
\t\t\t\t\t<div class="docs-content">
\t\t\t\t\t\t<a class="back-link reveal" href="${isOverview ? "../index.html" : "index.html"}">← ${
		isOverview ? "All docs" : escapeHtml(topic.title)
	}</a>
\t\t\t\t\t\t<header class="docs-page-head reveal">
\t\t\t\t\t\t\t<p class="doc-kicker">${escapeHtml(topic.title)}</p>
\t\t\t\t\t\t\t<h1>${escapeHtml(pageTitle)}</h1>
\t\t\t\t\t\t</header>
\t\t\t\t\t\t<div class="doc-section">
${bodyHtml || "\t\t\t\t\t\t\t<div class=\"prose reveal\"><p>Nothing here yet.</p></div>"}
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t</div>
\t\t\t</section>
\t\t</main>

${siteFooter(rootPrefix)}

\t\t<script src="../../app.js" defer></script>
\t\t<script src="../docs.js" defer></script>
\t</body>
</html>
`;
}
