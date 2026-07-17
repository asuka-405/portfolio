import { getNotionClient, getDocsDatabaseId } from "./notion-client.mjs";
import { richTextToPlain, slugify } from "../lib/html.mjs";
import { fetchChildren } from "./blocks-to-html.mjs";

function extractTopicMeta(page) {
	const props = page.properties;

	const title = richTextToPlain(props.Title?.title);
	const slug = richTextToPlain(props.Slug?.rich_text).trim();
	const status = props.Status?.select?.name ?? null;
	const summary = richTextToPlain(props.Summary?.rich_text);
	const icon = richTextToPlain(props.Icon?.rich_text);
	const order = typeof props.Order?.number === "number" ? props.Order.number : 0;

	return { id: page.id, title, slug, status, summary, icon, order };
}

/** Fetches every Published topic's metadata from the Site Docs database, sorted by Order. */
export async function fetchPublishedDocTopics() {
	const databaseId = getDocsDatabaseId();
	const client = getNotionClient();

	const results = [];
	let cursor = undefined;
	do {
		const response = await client.databases.query({
			database_id: databaseId,
			start_cursor: cursor,
			filter: { property: "Status", select: { equals: "Published" } },
		});
		results.push(...response.results.map(extractTopicMeta));
		cursor = response.has_more ? response.next_cursor : undefined;
	} while (cursor);

	const invalid = results.filter((t) => !t.title || !t.slug);
	if (invalid.length > 0) {
		const names = invalid.map((t) => t.title || t.id).join(", ");
		throw new Error(`Doc topic(s) missing required fields (Title/Slug): ${names}`);
	}

	return results.sort((a, b) => a.order - b.order);
}

/**
 * Walks a topic's Notion page tree via native `child_page` blocks. A page's own non-child_page
 * blocks become its rendered body; each child_page block becomes a nested node, recursively.
 * Nested pages flatten into one flat slug namespace per topic (deduped), matching the docs/
 * URL scheme where nesting is shown via the sidebar, not the URL.
 */
export async function walkDocTopic(client, topicMeta) {
	const usedSlugs = new Set();

	function uniqueSlug(title) {
		const base = slugify(title) || "page";
		let slug = base;
		let i = 2;
		while (usedSlugs.has(slug)) {
			slug = `${base}-${i}`;
			i += 1;
		}
		usedSlugs.add(slug);
		return slug;
	}

	async function walkNode(pageId, title) {
		const blocks = await fetchChildren(client, pageId);
		const childPageBlocks = blocks.filter((b) => b.type === "child_page");
		const bodyBlocks = blocks.filter((b) => b.type !== "child_page");

		const node = { id: pageId, title, slug: uniqueSlug(title), bodyBlocks, children: [] };
		for (const cb of childPageBlocks) {
			node.children.push(await walkNode(cb.id, cb.child_page.title));
		}
		return node;
	}

	return walkNode(topicMeta.id, topicMeta.title);
}

/** Flattens a doc tree (topic root + all descendants) into a single array, document order. */
export function flattenDocTree(node) {
	const out = [node];
	for (const child of node.children) out.push(...flattenDocTree(child));
	return out;
}
