import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

export const ARTICLES_DIR = path.join(ROOT, "articles");
export const GENERATED_DIR = path.join(ARTICLES_DIR, "generated");
export const IMG_DIR = path.join(GENERATED_DIR, "img");
export const HUB_PATH = path.join(ARTICLES_DIR, "index.html");
export const HOMEPAGE_PATH = path.join(ROOT, "index.html");
export const LEGACY_DATA_PATH = path.join(ROOT, "data", "legacy-articles.json");

export const MARKER_START = "<!-- ARTICLES:START -->";
export const MARKER_END = "<!-- ARTICLES:END -->";

export const HOMEPAGE_TEASER_COUNT = 6;
