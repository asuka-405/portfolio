/**
 * Builds an embeddable OneCompiler (onecompiler.com) iframe for a runnable Go snippet.
 * Unlike the Compiler Explorer (godbolt.org) embed used for C++, OneCompiler exposes a real
 * documented embed contract: a plain query-string for options (including theme=dark/light,
 * which is why Go uses this instead) plus a postMessage API for delivering source code,
 * rather than a hand-reverse-engineered hash format. Confirmed live via onecompiler.com's own
 * embed docs and the official onecompiler/editor-embed-demo GitHub Pages demo.
 */

const BASE_URL = "https://onecompiler.com/embed/go";

/**
 * @param {object} [opts]
 * @param {"dark"|"light"} [opts.theme]
 */
export function buildOneCompilerEmbedUrl({ theme = "dark" } = {}) {
	const params = new URLSearchParams({
		theme,
		listenToEvents: "true",
		hideNew: "true",
		hideLanguageSelection: "true",
	});
	return `${BASE_URL}?${params.toString()}`;
}
