import { SITE_URL } from "./seo.mjs";

// Hand-written pages that exist outside the Notion pipeline - update this list if you add
// another hand-written page (the build script never discovers these automatically).
const STATIC_PAGES = [
	"",
	"arch-setup.html",
	"tools/index.html",
	"tools/sailpoint-workbench/index.html",
	"tools/arch-installer/index.html",
	"tools/diff-tool/index.html",
	"tools/regex-tester/index.html",
	"tools/ldap-toolkit/index.html",
	"tools/cron-explainer/index.html",
	"works/index.html",
	"works/brew-and-bean/about.html",
	"works/brew-and-bean/catering.html",
	"works/brew-and-bean/index.html",
	"works/brew-and-bean/locations.html",
	"works/brew-and-bean/menu.html",
	"works/brew-and-bean/order.html",
	"works/brew-and-bean/rewards.html",
	"works/brew-and-bean/track.html",
	"works/fitforge/classes.html",
	"works/fitforge/coaches.html",
	"works/fitforge/facilities.html",
	"works/fitforge/index.html",
	"works/fitforge/join.html",
	"works/fitforge/memberships.html",
	"works/fitforge/tools.html",
	"works/harbor-realty/agents.html",
	"works/harbor-realty/compare.html",
	"works/harbor-realty/emi.html",
	"works/harbor-realty/index.html",
	"works/harbor-realty/listings.html",
	"works/harbor-realty/neighbourhoods.html",
	"works/clinicdesk/index.html",
	"works/coachdesk/index.html",
	"works/counterpos/index.html",
	"works/filepilot/index.html",
	"works/filepilot/portal.html",
	"works/fixtrack/index.html",
	"works/fixtrack/track.html",
	"works/givetrack/donate.html",
	"works/givetrack/index.html",
	"works/khatalite/index.html",
	"works/leadnest/form.html",
	"works/leadnest/index.html",
	"works/paydesk/index.html",
	"works/rentdesk/index.html",
	"works/salondesk/book.html",
	"works/salondesk/index.html",
	"works/schooldesk/index.html",
	"works/societyhub/index.html",
	"works/tabletap/index.html",
	"works/tabletap/menu.html",
	"works/harbor-realty/property.html",
	"works/harbor-realty/sell.html",
	"works/harbor-realty/shortlist.html",
	"works/invoicekit/index.html",
	"works/kiln-and-clay/care.html",
	"works/kiln-and-clay/cart.html",
	"works/kiln-and-clay/collections.html",
	"works/kiln-and-clay/index.html",
	"works/kiln-and-clay/journal.html",
	"works/kiln-and-clay/order.html",
	"works/kiln-and-clay/product.html",
	"works/kiln-and-clay/shop.html",
	"works/kiln-and-clay/story.html",
	"works/kiln-and-clay/wholesale.html",
	"works/kiln-and-clay/wishlist.html",
	"works/kiln-and-clay/workshops.html",
	"works/lendwise/apply.html",
	"works/lendwise/index.html",
	"works/lumen-dental/book.html",
	"works/lumen-dental/contact.html",
	"works/lumen-dental/financing.html",
	"works/lumen-dental/index.html",
	"works/lumen-dental/service.html",
	"works/lumen-dental/services.html",
	"works/lumen-dental/smile-quiz.html",
	"works/lumen-dental/team.html",
	"works/orderlink/index.html",
	"works/orderlink/shop.html",
	"works/queuelite/index.html",
	"works/salesboard/index.html",
	"works/shiftboard/index.html",
	"works/stockpulse/index.html",
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
