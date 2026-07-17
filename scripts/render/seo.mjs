import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../lib/paths.mjs";
import { escapeHtml } from "../lib/html.mjs";

export const SITE_URL = "https://archdev.in";
export const SITE_NAME = "Suryansh Kapil";
const DEFAULT_OG_IMAGE_REL = "assets/og-default.png";

let defaultOgImageCache = null;
/** Returns the absolute URL of assets/og-default.png if that file exists, else null. Drop an
 * image there to get a sitewide social-share fallback for pages without their own cover. */
export async function defaultOgImageUrl() {
	if (defaultOgImageCache !== null) return defaultOgImageCache || null;
	try {
		await fs.access(path.join(ROOT, DEFAULT_OG_IMAGE_REL));
		defaultOgImageCache = `${SITE_URL}/${DEFAULT_OG_IMAGE_REL}`;
	} catch {
		defaultOgImageCache = "";
	}
	return defaultOgImageCache || null;
}

/**
 * Builds <link rel="canonical"> + Open Graph + Twitter Card tags for one <head>.
 * canonicalPath is site-root-relative, no leading slash, e.g. "articles/foo.html".
 */
export function buildSeoTags({ title, description, canonicalPath, ogImage, type = "website", publishedTime, tags }) {
	const url = `${SITE_URL}/${canonicalPath}`;
	const safeTitle = escapeHtml(title);
	const safeDesc = escapeHtml(description);
	const lines = [
		`\t\t<link rel="canonical" href="${url}" />`,
		`\t\t<meta property="og:site_name" content="${SITE_NAME}" />`,
		`\t\t<meta property="og:type" content="${type}" />`,
		`\t\t<meta property="og:title" content="${safeTitle}" />`,
		`\t\t<meta property="og:description" content="${safeDesc}" />`,
		`\t\t<meta property="og:url" content="${url}" />`,
	];
	if (publishedTime) {
		lines.push(`\t\t<meta property="article:published_time" content="${escapeHtml(publishedTime)}" />`);
	}
	(tags || []).forEach((t) => lines.push(`\t\t<meta property="article:tag" content="${escapeHtml(t)}" />`));
	if (ogImage) {
		lines.push(`\t\t<meta property="og:image" content="${escapeHtml(ogImage)}" />`);
		lines.push(`\t\t<meta name="twitter:card" content="summary_large_image" />`);
		lines.push(`\t\t<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`);
	} else {
		lines.push(`\t\t<meta name="twitter:card" content="summary" />`);
	}
	lines.push(`\t\t<meta name="twitter:title" content="${safeTitle}" />`);
	lines.push(`\t\t<meta name="twitter:description" content="${safeDesc}" />`);
	return lines.join("\n");
}
