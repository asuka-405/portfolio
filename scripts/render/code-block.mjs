import { codeToHtml } from "shiki";

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

/** Renders a Notion code block into build-time syntax-highlighted HTML (no client-side JS). */
export async function renderCodeBlock(code, notionLanguage) {
	const lang = resolveLang(notionLanguage);
	let html;
	try {
		html = await codeToHtml(code, { lang, themes: THEMES, defaultColor: false });
	} catch {
		html = await codeToHtml(code, { lang: "text", themes: THEMES, defaultColor: false });
	}
	return `<div class="code-block reveal">${html}</div>`;
}
