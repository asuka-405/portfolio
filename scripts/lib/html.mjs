export function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function slugify(str) {
	return String(str)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Converts a Notion rich_text array into an inline HTML string, preserving bold/italic/code/strikethrough/links. */
export function richTextToHtml(richText) {
	if (!richText || richText.length === 0) return "";
	return richText
		.map((rt) => {
			let text = escapeHtml(rt.plain_text ?? "");
			const a = rt.annotations || {};
			if (a.code) text = `<code>${text}</code>`;
			if (a.italic) text = `<em>${text}</em>`;
			if (a.bold) text = `<strong>${text}</strong>`;
			if (a.strikethrough) text = `<s>${text}</s>`;
			if (a.underline) text = `<u>${text}</u>`;
			const href = rt.href || rt.text?.link?.url;
			if (href) {
				const safeHref = escapeHtml(href);
				text = `<a href="${safeHref}" target="_blank" rel="noopener">${text}</a>`;
			}
			return text;
		})
		.join("");
}

/** Plain-text extraction (no markup), used for word counts, alt text, titles. */
export function richTextToPlain(richText) {
	if (!richText || richText.length === 0) return "";
	return richText.map((rt) => rt.plain_text ?? "").join("");
}

/** Strips HTML tags and collapses whitespace — used for word counts and the search index. */
export function stripHtml(html) {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/\s+/g, " ")
		.trim();
}
