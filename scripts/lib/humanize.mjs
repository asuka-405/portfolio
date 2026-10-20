// Copy cleanup applied to every generated page, so regenerating from Notion never brings the
// usual machine-written tells back: em dashes used as punctuation, and filler adverbs.

const DASH = String.fromCharCode(8212);
const EN = String.fromCharCode(8211);
const DASH_SPLIT = new RegExp("\\s*" + DASH + "\\s*");
const SPACED_EN = new RegExp("\\s+" + EN + "\\s+", "g");
const ESC_DASH = "\\" + "u2014"; // the JSON escape for an em dash, as it appears in .json files
const PRONOUN_START = /^(it|it's|it’s|this|that|they|you|we|i|i'm|there|he|she)\b/i;
const SOFT_START = /^(and|but|or|so|which|who|whose|where|when|while|because|though|with|without|from|for|to|in|on|at|as|like|plus|then|yet|including|especially|not|even|only|all|each|often|usually|mostly|typically|sometimes|ideally|e\.g\.|i\.e\.)\b/i;
const CONJ_START = /^(and|but|or|so|which|because|yet|then)\b/i;
const OPAQUE = /(<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<textarea[\s\S]*?<\/textarea>|<[^>]+>)/gi;
const SHORT_CONTAINERS = new Set(["title", "h1", "h2", "h3", "h4", "summary", "th", "dt", "figcaption", "button", "legend"]);

function cap(s) {
	return s.replace(/^(\W*)([a-z])/, (_, a, b) => a + b.toUpperCase());
}

function words(s) {
	return s.trim().split(/\s+/).filter(Boolean).length;
}

function dropFiller(s) {
	return s
		.replace(/\bGenuinely,? +(\w)/g, (_, c) => c.toUpperCase())
		.replace(/,? +genuinely(?=[\s,.;:])/gi, "")
		.replace(/\bgenuinely +/gi, "")
		.replace(/ +actually(?=[\s,.;:])/g, "");
}

/** Rewrites dashes and filler in plain prose. mode: "title" for headings and titles, "text" otherwise. */
export function humanizeText(input, mode = "text") {
	if (!input) return input;
	let s = input.replace(/&mdash;|&#8212;|&#x2014;/gi, DASH).replace(SPACED_EN, ` ${DASH} `);
	s = dropFiller(s);
	if (s.includes(DASH)) {
		const parts = s.split(DASH_SPLIT);
		if (mode === "title") {
			s = parts.reduce((acc, p, i) => (i === 0 ? p : acc + (i === 1 ? ": " : ", ") + p), "");
		} else {
			let out = parts[0];
			let i = 1;
			while (i < parts.length) {
				const before = out;
				const after = parts[i];
				if (i + 1 < parts.length && !before.trim()) {
					// a list set off by a dash at the start of a text run: brackets
					out = `${before} (${after}) ${parts[i + 1]}`.replace(/^ +/, " ");
					i += 2;
					continue;
				}
				if (i + 1 < parts.length && before.trim()) {
					// a pair of dashes around an aside: commas, or brackets when the aside is itself a list
					out = /,/.test(after) ? `${before} (${after}) ${parts[i + 1]}` : `${before}, ${after}, ${parts[i + 1]}`;
					i += 2;
					continue;
				}
				const trimmed = before.replace(/[,;:\s]+$/, "");
				if (CONJ_START.test(after) && before.trim()) out = `${trimmed}, ${after}`;
				else if (words(before.split(/[.!?]\s+/).pop() || before) <= 3 && !/[,;:]$/.test(before.trim())) out = `${before}: ${after}`;
				else if (PRONOUN_START.test(after)) out = `${trimmed}. ${cap(after)}`;
				else if (/^[A-Z][a-z]/.test(after) && !/^(A|An|The)\b/.test(after)) out = `${trimmed}: ${after}`;
				else if (SOFT_START.test(after)) out = `${trimmed}, ${after}`;
				else if (/,/.test(after.split(/[.!?]\s/)[0])) out = `${trimmed}: ${after}`;
				else out = `${trimmed}; ${after}`;
				i += 1;
			}
			s = out;
		}
	}
	s = s.replace(/ {2,}/g, " ").replace(/ +([,.;:])/g, "$1");
	return s;
}

function humanizeAttr(tag) {
	return tag.replace(/((?<![\w:-])(?:content|title|alt|aria-label|placeholder)=|\bdata-title=)"([^"]*)"/g, (m, k, v) => (v.includes(DASH) || /&mdash;|&#8212;/.test(v) ? `${k}"${humanizeText(v, k === "content=" ? "text" : "title")}"` : m));
}

function humanizeJsonLd(block) {
	return block.replace(/"((?:[^"\\]|\\.)*)"/g, (m, v) => (v.includes(DASH) || v.includes(ESC_DASH) ? `"${humanizeText(v.split(ESC_DASH).join(DASH), "text")}"` : m));
}

/** Cleans the visible copy of an HTML document. Code, scripts, styles and tags are left alone. */
export function humanizeHtml(html) {
	const stack = [];
	return html
		.split(OPAQUE)
		.map((tok) => {
			if (!tok) return tok;
			if (tok.startsWith("<!--")) return tok;
			if (/^<script/i.test(tok)) return /ld\+json/i.test(tok.slice(0, 120)) ? humanizeJsonLd(tok) : tok;
			if (/^<(style|pre|code|textarea)/i.test(tok)) return tok;
			if (tok.startsWith("<")) {
				const m = /^<(\/?)([a-z0-9]+)/i.exec(tok);
				if (m) {
					const name = m[2].toLowerCase();
					if (m[1]) {
						const at = stack.lastIndexOf(name);
						if (at >= 0) stack.length = at;
					} else if (!/\/>$/.test(tok) && !["meta", "link", "br", "img", "hr", "input", "source"].includes(name)) stack.push(name);
				}
				return /^<(meta|a|img|button|input)\b/i.test(tok) ? humanizeAttr(tok) : tok;
			}
			const mode = stack.some((n) => SHORT_CONTAINERS.has(n)) ? "title" : "text";
			return humanizeText(tok, mode);
		})
		.join("");
}

/** Same cleanup for strings that go into JSON files such as the search index. */
export function humanizeJson(text) {
	return text.replace(/"((?:[^"\\]|\\.)*)"/g, (m, v) => (v.includes(DASH) || v.includes(ESC_DASH) || /genuinely|\sactually/.test(v) ? `"${humanizeText(v.split(ESC_DASH).join(DASH), "text")}"` : m));
}
