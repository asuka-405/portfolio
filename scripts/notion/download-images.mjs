import fs from "node:fs/promises";
import path from "node:path";
import { IMG_DIR } from "../lib/paths.mjs";

const EXT_BY_CONTENT_TYPE = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/svg+xml": "svg",
};

function extFromUrl(url) {
	const pathname = new URL(url).pathname;
	const match = pathname.match(/\.(jpe?g|png|webp|gif|svg)$/i);
	return match ? match[1].toLowerCase().replace("jpeg", "jpg") : null;
}

/**
 * Downloads a Notion-hosted image (its URL is a presigned S3 link that expires) to a
 * local file under articles/img/<slug>/, so generated pages never hotlink Notion.
 * Returns the relative src to use from articles/<slug>.html.
 */
export async function downloadArticleImage(url, slug, index) {
	const destDir = path.join(IMG_DIR, slug);
	await fs.mkdir(destDir, { recursive: true });

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download image (${response.status}) for "${slug}": ${url}`);
	}

	const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
	const ext = extFromUrl(url) || EXT_BY_CONTENT_TYPE[contentType] || "jpg";
	const filename = `${index}.${ext}`;
	const buffer = Buffer.from(await response.arrayBuffer());
	await fs.writeFile(path.join(destDir, filename), buffer);

	return `img/${slug}/${filename}`;
}
