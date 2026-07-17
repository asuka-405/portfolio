/**
 * Builds the client-side search index (articles/search-index.json).
 * Notion-sourced articles include full body text (phrase-searchable); legacy hand-written
 * articles only index title/summary/tags since their HTML isn't parsed by the build.
 */
export function buildSearchIndex(articles) {
	return articles.map((a) => ({
		title: a.title,
		href: a.href,
		tags: a.tags,
		summary: a.summary,
		bodyText: a.bodyText || "",
		date: a.date,
		featured: !!a.featured,
	}));
}
