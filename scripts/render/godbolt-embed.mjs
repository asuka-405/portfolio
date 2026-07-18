/**
 * Builds an embeddable Compiler Explorer (godbolt.org) iframe URL for a runnable
 * C++ snippet: an editable source pane plus an execute/output pane.
 *
 * This is a template-substitution over a known-good, currently-working real embed
 * link (confirmed live via https://github.com/hsf-training/hsf-styles/issues/7 and
 * cross-checked against Compiler Explorer's own /api/shortener response), not a
 * hand-rolled reimplementation of its hash grammar: only the placeholder leaf values
 * are substituted, every structural character is left exactly as observed working.
 */

const DEFAULT_COMPILER = "g122"; // GCC 12.2, verified live via the /api/shortener endpoint
const DEFAULT_OPTIONS = "-std=c++20 -O0 -Wall -Wextra";

/** Matches Compiler Explorer's own string encoding inside its hash state: percent-encode
 * everything encodeURIComponent would, except leave "/" literal and use "+" for space.
 * Verified byte-exact against a real working embed link's encoded source field.
 * Also percent-encodes "'" (which encodeURIComponent leaves literal) since the template
 * below uses '...' as the value delimiter: an unescaped quote (e.g. a char literal like
 * 'a', or a digit separator like 1'000'000) would otherwise terminate the string early. */
function ceEncode(value) {
	return encodeURIComponent(value).replace(/%20/g, "+").replace(/%2F/g, "/").replace(/'/g, "%27");
}

// Real, confirmed-working template (see file header). Placeholders: __SOURCE__,
// __COMPILER__, __OPTIONS__, __EXEC_ARGS__, __EXEC_STDIN__, __EDITOR_TITLE__.
// `wrap:'1'` on the codeEditor pane mirrors the field already present (and confirmed
// meaningful, via CE's own "getCurrentState().wrap" usage) on the executor pane below,
// requesting word-wrap on for the source editor by default.
const TEMPLATE =
	"g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:14,fontUsePx:'0',j:1,lang:c%2B%2B," +
	"selection:(endColumn:1,endLineNumber:1,positionColumn:1,positionLineNumber:1," +
	"selectionStartColumn:1,selectionStartLineNumber:1,startColumn:1,startLineNumber:1)," +
	"source:'__SOURCE__',wrap:'1'),l:'5',n:'0',o:'__EDITOR_TITLE__',t:'0'))," +
	"k:50,l:'4',n:'0',o:'',s:0,t:'0')," +
	"(g:!((h:executor,i:(argsPanelShown:'1',compilationPanelShown:'0',compiler:__COMPILER__," +
	"compilerOutShown:'0',execArgs:'__EXEC_ARGS__',execStdin:'__EXEC_STDIN__',fontScale:14," +
	"fontUsePx:'0',j:1,lang:c%2B%2B,libs:!(),options:'__OPTIONS__',source:1,stdinPanelShown:'1'," +
	"tree:'1',wrap:'1'),l:'5',n:'0',o:'Executor+(C%2B%2B)',t:'0'))," +
	"header:(),k:50,l:'4',n:'0',o:'',s:0,t:'0')),l:'2',n:'0',o:'',t:'0')),version:4";

/**
 * @param {object} opts
 * @param {string} opts.source - C++ source code.
 * @param {string} [opts.compiler] - Compiler Explorer compiler id (default GCC 12.2).
 * @param {string} [opts.options] - Compiler flags.
 * @param {string} [opts.execArgs] - Program argv.
 * @param {string} [opts.execStdin] - Program stdin.
 * @param {string} [opts.title] - Editor pane title.
 */
export function buildGodboltEmbedUrl({
	source,
	compiler = DEFAULT_COMPILER,
	options = DEFAULT_OPTIONS,
	execArgs = "",
	execStdin = "",
	title = "C++ source",
} = {}) {
	const hash = TEMPLATE.replace("__SOURCE__", ceEncode(source))
		.replace("__COMPILER__", compiler)
		.replace("__OPTIONS__", ceEncode(options))
		.replace("__EXEC_ARGS__", ceEncode(execArgs))
		.replace("__EXEC_STDIN__", ceEncode(execStdin))
		.replace("__EDITOR_TITLE__", ceEncode(title));

	// hideEditorToolbars: a real, confirmed embed option (found in Compiler Explorer's own
	// bundle as `options.hideEditorToolbars`) that removes CE's own per-pane toolbar chrome,
	// which is most of what would otherwise clash with this site's own theme. CE's overall
	// color scheme itself is a local-storage setting on godbolt.org's own origin with no
	// documented URL override, so it can't be forced to match the site's light/dark toggle.
	return `https://godbolt.org/e?hideEditorToolbars=true#${hash}`;
}
