import { getNotionClient, getDatabaseId } from "./notion-client.mjs";
import { richTextToPlain } from "../lib/html.mjs";

function firstFileUrl(filesProp) {
	const file = filesProp?.[0];
	if (!file) return null;
	return file.type === "external" ? file.external.url : file.file?.url ?? null;
}

function extractArticleMeta(page) {
	const props = page.properties;

	const title = richTextToPlain(props.Title?.title);
	const slug = richTextToPlain(props.Slug?.rich_text).trim();
	const status = props.Status?.select?.name ?? null;
	const summary = richTextToPlain(props.Summary?.rich_text);
	const tags = (props.Tags?.multi_select ?? []).map((t) => t.name);
	const eyebrow = richTextToPlain(props.Eyebrow?.rich_text) || tags.slice(0, 2).join(" · ");
	const publishDate = props.PublishDate?.date?.start ?? null;
	const cover = firstFileUrl(props.Cover?.files);
	const readTimeOverride = typeof props.ReadTimeOverride?.number === "number"
		? props.ReadTimeOverride.number
		: null;
	const featured = props.Featured?.checkbox === true;

	return { id: page.id, kind: "notion", title, slug, status, summary, tags, eyebrow, publishDate, cover, readTimeOverride, featured };
}

/** Fetches every Published article's metadata from the Notion database (paginated). */
export async function fetchPublishedArticles() {
	const client = getNotionClient();
	const databaseId = getDatabaseId();

	const results = [];
	let cursor = undefined;

	do {
		const response = await client.databases.query({
			database_id: databaseId,
			start_cursor: cursor,
			filter: { property: "Status", select: { equals: "Published" } },
		});
		results.push(...response.results.map(extractArticleMeta));
		cursor = response.has_more ? response.next_cursor : undefined;
	} while (cursor);

	const invalid = results.filter((a) => !a.title || !a.slug || !a.publishDate);
	if (invalid.length > 0) {
		const names = invalid.map((a) => a.title || a.id).join(", ");
		throw new Error(
			`Article(s) missing required fields (Title/Slug/PublishDate): ${names}`
		);
	}

	return results;
}
