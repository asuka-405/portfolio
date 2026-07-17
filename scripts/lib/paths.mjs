import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

export const ARTICLES_DIR = path.join(ROOT, "articles");
export const IMG_DIR = path.join(ARTICLES_DIR, "img");
export const HUB_PATH = path.join(ARTICLES_DIR, "index.html");
export const HOMEPAGE_PATH = path.join(ROOT, "index.html");
export const LEGACY_DATA_PATH = path.join(ROOT, "data", "legacy-articles.json");

export const DOCS_DIR = path.join(ROOT, "docs");
export const DOCS_IMG_DIR = path.join(DOCS_DIR, "img");
export const DOCS_HUB_PATH = path.join(DOCS_DIR, "index.html");
export const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");

export const MARKER_START = "<!-- ARTICLES:START -->";
export const MARKER_END = "<!-- ARTICLES:END -->";

export const HOMEPAGE_TEASER_COUNT = 6;
