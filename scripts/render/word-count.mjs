import { stripHtml } from "../lib/html.mjs";

const WORDS_PER_MINUTE = 220;

/** Computes a "N min" read-time label from rendered HTML, unless a manual override is given. */
export function computeReadTime(bodyHtmlSections, overrideMinutes) {
	if (overrideMinutes) return `${overrideMinutes} min`;

	const text = stripHtml(bodyHtmlSections.join(" "));
	const words = text.split(/\s+/).filter(Boolean).length;
	const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
	return `${minutes} min`;
}
