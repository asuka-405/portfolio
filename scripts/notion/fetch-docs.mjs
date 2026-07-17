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
 * Notion's API has no way to reorder existing blocks (only append new ones), so when several
 * forks/authors append child pages to the same topic concurrently, their pages interleave in
 * whatever order the API calls happened to land, not the intended reading order. This maps a
 * topic slug to the intended top-level page order (by title); topics not listed here keep their
 * natural Notion order (e.g. topics authored by a single sequential pass need no override).
 */
const PAGE_ORDER_OVERRIDES = {
	cpp: [
		"The Absolute Basics",
		"Functions and Program Structure",
		"Debugging C++ Programs",
		"Fundamental Data Types",
		"Constants, Literals, and Strings",
		"Operators",
		"Scope, Duration, and Linkage",
		"Control Flow",
		"Error Detection and Handling",
		"Type Conversion, Aliases, and Deduction",
		"Function Overloading and Function Templates",
		"Constexpr and Compile-Time Evaluation",
		"References and Pointers",
		"Enums and Structs",
		"Compile-Time and Runtime Polymorphism, Previewed",
		"Introduction to Classes",
		"More on Classes",
		"Dynamic Arrays: std::vector",
		"Fixed-Size Arrays: std::array and C-style Arrays",
		"Iterators and Algorithms",
		"Dynamic Memory Allocation",
		"Lambdas and Function Objects",
		"Operator Overloading",
		"Move Semantics and Smart Pointers",
		"Object Relationships",
		"Inheritance",
		"Virtual Functions and Polymorphism",
		"Templates and Generic Classes",
		"Exceptions",
		"Input and Output Streams",
		"A Tour of Modern C++ (11 Through 23)",
		"Idiomatic C++ and Common Pitfalls",
	],
};

function applyPageOrderOverride(topicSlug, childPageBlocks) {
	const order = PAGE_ORDER_OVERRIDES[topicSlug];
	if (!order) return childPageBlocks;

	const rank = new Map(order.map((title, i) => [title, i]));
	return [...childPageBlocks].sort((a, b) => {
		const ra = rank.has(a.child_page.title) ? rank.get(a.child_page.title) : Infinity;
		const rb = rank.has(b.child_page.title) ? rank.get(b.child_page.title) : Infinity;
		return ra - rb;
	});
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

	async function walkNode(pageId, title, isRoot) {
		const blocks = await fetchChildren(client, pageId);
		let childPageBlocks = blocks.filter((b) => b.type === "child_page");
		const bodyBlocks = blocks.filter((b) => b.type !== "child_page");
		if (isRoot) childPageBlocks = applyPageOrderOverride(topicMeta.slug, childPageBlocks);

		const node = { id: pageId, title, slug: uniqueSlug(title), bodyBlocks, children: [] };
		for (const cb of childPageBlocks) {
			node.children.push(await walkNode(cb.id, cb.child_page.title, false));
		}
		return node;
	}

	return walkNode(topicMeta.id, topicMeta.title, true);
}

/** Flattens a doc tree (topic root + all descendants) into a single array, document order. */
export function flattenDocTree(node) {
	const out = [node];
	for (const child of node.children) out.push(...flattenDocTree(child));
	return out;
}
