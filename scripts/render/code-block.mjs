import { codeToHtml } from "shiki";
import { escapeHtml } from "../lib/html.mjs";
import { buildGodboltEmbedUrl } from "./godbolt-embed.mjs";

const LANG_ALIASES = {
	"plain text": "text",
	plaintext: "text",
	shell: "bash",
	sh: "bash",
	"c++": "cpp",
	"c#": "csharp",
	objective_c: "objc",
	docker: "dockerfile",
	ps1: "powershell",
	powershell: "powershell",
	java: "java",
};

function resolveLang(notionLanguage) {
	const raw = (notionLanguage || "text").toLowerCase();
	return LANG_ALIASES[raw] || raw;
}

const THEMES = { dark: "github-dark", light: "github-light" };

const LANG_LABELS = {
	bash: "bash",
	c: "c",
	cpp: "c++",
	csharp: "c#",
	java: "java",
	javascript: "javascript",
	typescript: "typescript",
	python: "python",
	powershell: "powershell",
	dockerfile: "dockerfile",
	json: "json",
	yaml: "yaml",
	text: "text",
};

function langLabel(lang) {
	return LANG_LABELS[lang] || lang;
}

/** Renders a Notion code block into build-time syntax-highlighted HTML (no client-side JS). */
export async function renderCodeBlock(code, notionLanguage) {
	const lang = resolveLang(notionLanguage);
	let html;
	try {
		html = await codeToHtml(code, { lang, themes: THEMES, defaultColor: false });
	} catch {
		html = await codeToHtml(code, { lang: "text", themes: THEMES, defaultColor: false });
	}
	return (
		`<div class="code-block reveal">` +
		`<div class="code-block-head"><span class="code-dots"><span></span><span></span><span></span></span>` +
		`<span class="code-lang">${langLabel(lang)}</span></div>` +
		html +
		`</div>`
	);
}

/** Sentinel: a C/C++ Notion code block whose first line is exactly this comment renders as
 * a live, editable, runnable Compiler Explorer embed instead of a static highlighted block. */
export const GODBOLT_RUN_MARKER = "// godbolt-run";

/** Renders a runnable C++ example: an embedded Compiler Explorer iframe (editable source +
 * execute/output pane), with a static highlighted fallback link for no-JS/print contexts.
 * `options` overrides the default compiler flags (e.g. to target a specific -std=). */
export function renderGodboltEmbed(source, options) {
	const embedUrl = buildGodboltEmbedUrl(options ? { source, options } : { source });
	return (
		`<div class="godbolt-embed reveal">` +
		`<div class="godbolt-embed-head"><span class="code-dots"><span></span><span></span><span></span></span>` +
		`<span class="code-lang">c++ · live, editable, runnable</span>` +
		`<a class="godbolt-embed-open" href="${embedUrl}" target="_blank" rel="noopener">Open in Compiler Explorer ↗</a>` +
		`<button type="button" class="godbolt-embed-fullscreen" aria-label="Toggle fullscreen">⛶</button></div>` +
		`<iframe class="godbolt-embed-frame" src="${embedUrl}" loading="lazy" title="Editable C++ example on Compiler Explorer"></iframe>` +
		`<noscript><pre>${escapeHtml(source)}</pre></noscript>` +
		`</div>`
	);
}
