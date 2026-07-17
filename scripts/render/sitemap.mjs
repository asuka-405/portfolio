import { SITE_URL } from "./seo.mjs";

// Hand-written pages that exist outside the Notion pipeline — update this list if you add
// another hand-written page (the build script never discovers these automatically).
const STATIC_PAGES = [
	"",
	"arch-setup.html",
	"projects/auditflow.html",
	"projects/blog-bits.html",
	"projects/sutrix.html",
];

export function urlEntry(pathname, lastmod) {
	const loc = pathname ? `${SITE_URL}/${pathname}` : `${SITE_URL}/`;
	const lastmodTag = lastmod ? `\n\t\t<lastmod>${lastmod}</lastmod>` : "";
	return `\t<url>\n\t\t<loc>${loc}</loc>${lastmodTag}\n\t</url>`;
}

/** Builds sitemap.xml covering static pages + every legacy/Notion article + the hub/featured pages. */
export function buildSitemap(articles) {
	const staticEntries = STATIC_PAGES.map((p) => urlEntry(p));
	const articleEntries = articles.map((a) => urlEntry(a.hrefRoot, a.date));
	const listingEntries = [urlEntry("articles/index.html"), urlEntry("articles/featured.html")];

	const body = [...staticEntries, ...articleEntries, ...listingEntries].join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** Inserts extra `<url>` entries (already-built strings from urlEntry()) into an existing
 * sitemap.xml string, just before </urlset>. Used by build-docs.mjs to append docs URLs
 * to the sitemap build-articles.mjs already wrote, without duplicating the static/article lists. */
export function insertSitemapEntries(xml, entries) {
	if (entries.length === 0) return xml;
	const closeTag = "</urlset>";
	const idx = xml.lastIndexOf(closeTag);
	if (idx === -1) throw new Error("sitemap.xml is missing a </urlset> closing tag.");
	return `${xml.slice(0, idx)}${entries.join("\n")}\n${xml.slice(idx)}`;
}
