// Regex flavor analysis for JavaScript, Java and Go (RE2), plus a JavaScript test runner.
// Only JavaScript can be executed in a browser; Java and Go are checked statically against known syntax differences.
// Verdicts are conservative: "no" means the construct is rejected or means something else in that flavor.

export const FLAVORS = ["js", "java", "go"];
export const FLAVOR_LABEL = { js: "JavaScript", java: "Java", go: "Go (RE2)" };

const ok = "ok";
const no = "no";
const diff = "diff";

// ------------------------------------------------------------------ construct detection

/** Each rule: test(pattern, i, ctx) -> {len, ...} | null. ctx = {inClass}. */
function scan(pattern) {
	const found = [];
	const add = (index, text, id, verdict, note, severity) => found.push({ index, text, id, verdict, note, severity: severity || (Object.values(verdict).includes(no) ? "error" : "warn") });
	const n = pattern.length;
	let inClass = 0;
	for (let i = 0; i < n; i++) {
		const c = pattern[i];
		const rest = pattern.slice(i);
		if (c === "\\") {
			const d = pattern[i + 1];
			let m;
			if (d === undefined) { add(i, "\\", "trailing-backslash", { js: no, java: no, go: no }, "Pattern ends with a backslash."); break; }
			if (d === "Q") {
				const e = pattern.indexOf("\\E", i + 2);
				const end = e < 0 ? n : e + 2;
				add(i, pattern.slice(i, end), "quote", { js: diff, java: ok, go: ok }, "\\Q...\\E literal quoting is not JavaScript: there \\Q is just the letter Q.");
				i = end - 1;
				continue;
			}
			if (!inClass && d === "A") add(i, "\\A", "start-anchor", { js: diff, java: ok, go: ok }, "\\A (start of input) is not JavaScript: it matches the letter A.");
			else if (!inClass && d === "z") add(i, "\\z", "end-anchor-z", { js: diff, java: ok, go: ok }, "\\z (end of input) is not JavaScript: it matches the letter z.");
			else if (!inClass && d === "Z") add(i, "\\Z", "end-anchor-Z", { js: diff, java: ok, go: no }, "\\Z is Java-only; JavaScript reads it as the letter Z and Go rejects it. Go uses \\z.");
			else if (d === "h" || d === "H") add(i, `\\${d}`, "horizontal-space", { js: diff, java: ok, go: no }, "\\h (horizontal whitespace) is Java-only.");
			else if (!inClass && (d === "R" || d === "X" || d === "G")) add(i, `\\${d}`, "java-escape", { js: diff, java: ok, go: no }, `\\${d} is Java-only.`);
			else if (d === "p" || d === "P") {
				const name = /^\\[pP](\{[^}]*\}|[A-Za-z])/.exec(rest);
				add(i, name ? name[0] : `\\${d}`, "unicode-property", { js: ok, java: ok, go: ok }, "Unicode properties: JavaScript needs the u (or v) flag, otherwise \\p is just the letter p. Property names differ: Java has POSIX-style \\p{Alpha} and \\p{IsLatin}; Go uses \\p{L} and \\p{Latin}.", "info");
				if (name) i += name[0].length - 1; else i++;
				continue;
			} else if ((m = /^\\u([0-9a-fA-F]{4})/.exec(rest))) add(i, m[0], "unicode-escape", { js: ok, java: ok, go: no }, "\\uXXXX is not Go syntax: use \\x{XXXX}.");
			else if ((m = /^\\u\{[0-9a-fA-F]+\}/.exec(rest))) add(i, m[0], "unicode-brace-js", { js: ok, java: no, go: no }, "\\u{...} needs the JavaScript u flag; Java and Go use \\x{...}.");
			else if ((m = /^\\x\{[0-9a-fA-F]+\}/.exec(rest))) add(i, m[0], "hex-brace", { js: no, java: ok, go: ok }, "\\x{...} is not JavaScript: use \\u{...} with the u flag.");
			else if (d === "c") add(i, "\\c", "control-char", { js: ok, java: ok, go: no }, "\\cX control escapes are not supported by Go.");
			else if (!inClass && (m = /^\\k<([A-Za-z_][A-Za-z0-9_]*)>/.exec(rest))) { add(i, m[0], "named-backref", { js: ok, java: ok, go: no }, "Backreferences are not supported by Go (RE2)."); i += m[0].length - 1; continue; }
			else if (!inClass && /[1-9]/.test(d)) add(i, `\\${d}`, "backref", { js: ok, java: ok, go: no }, "Backreferences are not supported by Go (RE2).");
			else if (!inClass && d === "e") add(i, "\\e", "escape-char", { js: diff, java: ok, go: no }, "\\e (escape character) is not supported by JavaScript or Go.");
			i++; // skip escaped char
			continue;
		}
		if (inClass) {
			if (c === "[") {
				if (pattern[i + 1] === ":" ) {
					const m = /^\[:\^?[a-z]+:\]/.exec(rest);
					if (m) { add(i, m[0], "posix-class", { js: diff, java: diff, go: ok }, "POSIX classes like [[:alpha:]] work in Go only. JavaScript and Java read them as plain characters or nested sets; Java uses \\p{Alpha}.", "warn"); i += m[0].length - 1; continue; }
				}
				add(i, "[", "nested-class", { js: diff, java: ok, go: diff }, "Nested character classes union in Java. In JavaScript (without the v flag) and Go the inner [ is a literal.");
			} else if (c === "&" && pattern[i + 1] === "&") add(i, "&&", "class-intersection", { js: diff, java: ok, go: diff }, "Class intersection [a-z&&[^aeiou]] is Java syntax (JavaScript needs the v flag). Go treats && as literal characters.");
			else if (c === "]") inClass = 0;
			continue;
		}
		if (c === "[") {
			inClass = 1;
			if (pattern[i + 1] === "^") i++;
			if (pattern[i + 1] === "]") i++; // leading ] is literal in Java/Go, ends the (empty) class in JS
			continue;
		}
		if (c === "(" && pattern[i + 1] === "?") {
			let m;
			if (pattern.startsWith("(?:", i)) { i += 2; continue; }
			if (pattern.startsWith("(?=", i) || pattern.startsWith("(?!", i)) add(i, pattern.slice(i, i + 3), "lookahead", { js: ok, java: ok, go: no }, "Lookahead is not supported by Go (RE2).");
			else if (pattern.startsWith("(?<=", i) || pattern.startsWith("(?<!", i)) add(i, pattern.slice(i, i + 4), "lookbehind", { js: ok, java: ok, go: no }, "Lookbehind is not supported by Go (RE2). Java requires a bounded length.");
			else if (pattern.startsWith("(?>", i)) add(i, "(?>", "atomic", { js: no, java: ok, go: no }, "Atomic groups are Java only.");
			else if ((m = /^\(\?P<([A-Za-z_][A-Za-z0-9_]*)>/.exec(rest))) add(i, m[0], "named-group-P", { js: no, java: no, go: ok }, "(?P<name>...) is Go (and Python) syntax. Java and JavaScript use (?<name>...).");
			else if ((m = /^\(\?<([A-Za-z_][A-Za-z0-9_]*)>/.exec(rest))) {
				const bad = m[1].includes("_");
				add(i, m[0], "named-group", { js: ok, java: bad ? no : ok, go: ok }, bad ? "Java group names allow letters and digits only: underscores are rejected. Go accepts (?<name>) from Go 1.22; earlier versions need (?P<name>)." : "Named groups: Go accepts (?<name>) from Go 1.22; earlier versions need (?P<name>).", bad ? "error" : "info");
			} else if ((m = /^\(\?([imsxuUdn]*)(?:-([imsxuUdn]*))?([:)])/.exec(rest)) && (m[1] || m[2])) {
				const flags = (m[1] || "") + (m[2] || "");
				const scoped = m[3] === ":";
				const goBad = /[xudn]/.test(flags);
				add(i, m[0], scoped ? "scoped-flags" : "inline-flags", { js: scoped ? diff : no, java: ok, go: goBad ? no : ok }, `${scoped ? "Scoped" : "Inline"} flags ${m[0]}: ${scoped ? "only very recent JavaScript engines accept (?i:...)" : "JavaScript has no inline flags, set them on the regex literal"}. Go supports i, m, s and U only${goBad ? ` (rejects: ${[...flags].filter((f) => /[xudn]/.test(f)).join("")})` : ""}.`);
			} else if (/^\(\?\(/.test(rest)) add(i, "(?(", "conditional", { js: no, java: no, go: no }, "Conditional groups are not supported by any of the three.");
			else if (/^\(\?[R0-9&+-]/.test(rest)) add(i, "(?R", "recursion", { js: no, java: no, go: no }, "Recursion and subroutine calls are not supported by any of the three.");
			else if (pattern.startsWith("(?#", i)) add(i, "(?#", "comment-group", { js: no, java: no, go: no }, "(?#comment) groups are not supported; use the x flag (Java) or remove the comment.");
			continue;
		}
		// quantifiers
		if (c === "{") {
			const m = /^\{(\d+)(?:,(\d*))?\}/.exec(rest);
			if (m) {
				const hi = m[2] === undefined ? Number(m[1]) : m[2] === "" ? Infinity : Number(m[2]);
				if (Math.max(Number(m[1]), hi === Infinity ? 0 : hi) > 1000) add(i, m[0], "repeat-limit", { js: ok, java: ok, go: no }, "Go rejects repeat counts above 1000.");
				if (pattern[i + m[0].length] === "+") { add(i, m[0] + "+", "possessive", { js: no, java: ok, go: no }, "Possessive quantifiers are Java only."); i += m[0].length; continue; }
				i += m[0].length - 1;
			} else {
				add(i, "{", "literal-brace", { js: ok, java: no, go: ok }, "An unescaped { that is not a valid quantifier is an error in Java ('Illegal repetition'); JavaScript (non-unicode mode) and Go treat it as a literal. Escape it as \\{.");
			}
			continue;
		}
		if ((c === "*" || c === "+" || c === "?") && pattern[i + 1] === "+") {
			add(i, c + "+", "possessive", { js: no, java: ok, go: no }, "Possessive quantifiers are Java only.");
			i++;
			continue;
		}
	}
	return found;
}

// ------------------------------------------------------------------ catastrophic backtracking heuristics

function redosRisks(pattern) {
	const risks = [];
	const nested = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*]|\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\{\d+,\d*\}/.exec(pattern);
	if (nested) risks.push({ text: nested[0], why: "A quantified group that itself contains a quantifier (for example (a+)+). On a failing input this can take exponential time in JavaScript and Java. Go (RE2) runs in linear time and is not affected." });
	const alt = /\(([^()|\\]+)\|\1\)[+*]/.exec(pattern);
	if (alt) risks.push({ text: alt[0], why: "Alternation with identical branches under a quantifier, such as (a|a)*, can backtrack exponentially in JavaScript and Java." });
	const dotstar = /(\.\*){2,}/.exec(pattern);
	if (dotstar) risks.push({ text: dotstar[0], why: "Adjacent .* repeats multiply the work on a failing match in JavaScript and Java." });
	return risks;
}

// ------------------------------------------------------------------ behaviour differences (always shown)

export const BEHAVIOUR_DIFFS = [
	{ topic: "Matching engine", js: "Backtracking; catastrophic patterns can hang.", java: "Backtracking; catastrophic patterns can hang.", go: "RE2: linear time, no backtracking, so no lookaround or backreferences." },
	{ topic: "$ without multiline", js: "End of input only.", java: "End of input, or before a final line terminator.", go: "End of text only (like \\z)." },
	{ topic: ". (dot)", js: "Not \\n, \\r, \\u2028, \\u2029 (unless the s flag).", java: "Not any line terminator (\\n, \\r, \\u0085, \\u2028, \\u2029) unless DOTALL.", go: "Not \\n unless the s flag." },
	{ topic: "\\s", js: "Includes Unicode spaces such as no-break space.", java: "[ \\t\\n\\x0B\\f\\r] only.", go: "[\\t\\n\\f\\r ] (no vertical tab)." },
	{ topic: "\\d \\w \\b", js: "ASCII.", java: "ASCII unless UNICODE_CHARACTER_CLASS.", go: "ASCII." },
	{ topic: "Case-insensitive", js: "i flag; Unicode folding only with u.", java: "ASCII only unless (?u) or UNICODE_CASE.", go: "(?i) uses Unicode simple folding." },
	{ topic: "Whole-string match", js: "Anchor with ^ and $; test() searches.", java: "matches() requires the whole string; find() searches.", go: "Anchor yourself; MatchString searches." },
	{ topic: "Replacement syntax", js: "$1  $<name>  $&  $$", java: "$1  ${name}  \\ escapes", go: "$1  ${1}  ${name}  $$ (note: $1x means group named 1x)" },
];

// ------------------------------------------------------------------ analysis entry point

/**
 * @param {string} pattern
 * @returns {{constructs:object[], compat:Record<string,{status:string, issues:object[]}>, redos:object[]}}
 */
export function analyze(pattern) {
	const constructs = scan(pattern);
	const redos = redosRisks(pattern);
	const compat = {};
	for (const f of FLAVORS) {
		const issues = constructs.filter((c) => c.verdict[f] === no || c.verdict[f] === diff);
		const errors = issues.filter((c) => c.verdict[f] === no);
		compat[f] = { status: errors.length ? "incompatible" : issues.length ? "differs" : "compatible", issues: issues.map((c) => ({ text: c.text, index: c.index, verdict: c.verdict[f], note: c.note })) };
		if (f !== "go" && redos.length) compat[f].redos = redos;
	}
	if (f2(compat.js) === "compatible" && redos.length) compat.js.status = "risky";
	if (f2(compat.java) === "compatible" && redos.length) compat.java.status = "risky";
	return { constructs, compat, redos };
}
const f2 = (x) => x.status;

// ------------------------------------------------------------------ pattern as source literals

export function asJava(pattern) {
	return '"' + pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
}
export function asGo(pattern) {
	if (!pattern.includes("`")) return "`" + pattern + "`";
	return '"' + pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
}
export function asJs(pattern, flags = "") {
	return "/" + pattern.replace(/(^|[^\\])\//g, "$1\\/").replace(/\n/g, "\\n") + "/" + flags;
}

// ------------------------------------------------------------------ Java/Go -> JavaScript best-effort translation

/**
 * Rewrites a few non-JS constructs so the pattern can be run in the browser.
 * Anything it cannot translate is listed in `unsupported`.
 */
export function translateToJs(pattern, flags = "") {
	const notes = [];
	const unsupported = [];
	let p = pattern;
	let fl = new Set(flags.split(""));
	// leading inline flags
	const lead = /^\(\?([imsx]+)\)/.exec(p);
	if (lead) {
		for (const f of lead[1]) {
			if (f === "x") unsupported.push("(?x) comments mode");
			else fl.add(f);
		}
		p = p.slice(lead[0].length);
		notes.push(`Moved leading ${lead[0]} to the ${[...lead[1]].filter((f) => f !== "x").join("")} flag.`);
	}
	p = p.replace(/\(\?P</g, () => { notes.push("(?P<name> rewritten to (?<name>."); return "(?<"; });
	p = p.replace(/\\Q([\s\S]*?)(?:\\E|$)/g, (_, lit) => { notes.push("\\Q...\\E expanded to an escaped literal."); return lit.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&"); });
	if (/\\A/.test(p)) { p = p.replace(/\\A/g, "(?<![\\s\\S])"); notes.push("\\A rewritten to (?<![\\s\\S])."); }
	if (/\\z/.test(p)) { p = p.replace(/\\z/g, "(?![\\s\\S])"); notes.push("\\z rewritten to (?![\\s\\S])."); }
	if (/\\Z/.test(p)) { p = p.replace(/\\Z/g, "(?=\\n?(?![\\s\\S]))"); notes.push("\\Z rewritten to (?=\\n?(?![\\s\\S]))."); }
	if (/\\x\{[0-9a-fA-F]+\}/.test(p)) { p = p.replace(/\\x\{([0-9a-fA-F]+)\}/g, "\\u{$1}"); fl.add("u"); notes.push("\\x{...} rewritten to \\u{...} with the u flag."); }
	if (/\(\?>/.test(p)) unsupported.push("atomic groups (?>...)");
	if (/(?<!\\)(?:[*+?]|\{\d+(?:,\d*)?\})\+/.test(p)) unsupported.push("possessive quantifiers");
	if (/\(\?[imsxuUdn-]+[:)]/.test(p)) unsupported.push("inline flag groups other than a leading (?flags)");
	if (/\\[hHRXG]/.test(p)) unsupported.push("Java-only escapes (\\h \\R \\X \\G)");
	if (/\[:\^?[a-z]+:\]/.test(p)) unsupported.push("POSIX classes");
	if (/&&/.test(p.replace(/\\&/g, ""))) { /* only meaningful inside classes; left to the JS error */ }
	return { pattern: p, flags: [...fl].filter((f) => "dgimsuvy".includes(f)).join(""), notes, unsupported };
}

// ------------------------------------------------------------------ JavaScript runner

/**
 * @param {{pattern:string, flags?:string, input:string, replacement?:string, maxMatches?:number}} o
 */
export function runJs({ pattern, flags = "", input, replacement, maxMatches = 500 }) {
	let re;
	try {
		re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
	} catch (e) {
		return { ok: false, error: e.message };
	}
	const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
	const matches = [];
	let truncated = false;
	let m;
	while ((m = re.exec(input)) !== null) {
		if (matches.length >= maxMatches) { truncated = true; break; }
		matches.push({
			index: m.index,
			end: m.index + m[0].length,
			text: m[0],
			groups: m.slice(1).map((g) => (g === undefined ? null : g)),
			named: m.groups ? { ...m.groups } : {},
			indices: m.indices ? m.indices.slice(1).map((r) => (r ? { start: r[0], end: r[1] } : null)) : null,
		});
		if (m[0].length === 0) re.lastIndex++; // step past an empty match so the loop cannot repeat it
	}
	let replaced = null;
	if (replacement !== undefined && replacement !== "") {
		try { replaced = input.replace(new RegExp(pattern, flags.includes("g") ? flags : flags + "g"), replacement); } catch (e) { replaced = null; }
	}
	const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
	return { ok: true, matches, truncated, replaced, ms: +(t1 - t0).toFixed(2), groupCount: matches.length ? matches[0].groups.length : countGroups(pattern) };
}
function countGroups(pattern) {
	try { return new RegExp(pattern + "|").exec("").length - 1; } catch { return 0; }
}

// ------------------------------------------------------------------ replacement strings

/** Warnings about a replacement string per flavor, and a conversion of a JS replacement. */
export function analyzeReplacement(repl) {
	const out = { js: [], java: [], go: [], convert: { java: null, go: null } };
	if (!repl) return out;
	if (/\\\d/.test(repl)) {
		out.js.push("\\1 is not a backreference in a JavaScript replacement; use $1.");
		out.java.push("\\1 is not a group reference in a Java replacement: the backslash escapes the next character, giving a literal 1. Use $1.");
		out.go.push("\\1 is not a group reference in Go; use ${1}.");
	}
	if (/\$[A-Za-z_][A-Za-z0-9_]*|\$\d+[A-Za-z_]/.test(repl)) {
		out.go.push("In Go, $name takes the longest run of letters, digits and underscores: $1x means a group called 1x, which does not exist and expands to empty. Write ${1}x.");
	}
	if (/\$<[^>]+>/.test(repl)) {
		out.java.push("$<name> is JavaScript. Java uses ${name}.");
		out.go.push("$<name> is JavaScript. Go uses ${name}.");
	}
	if (/\$&/.test(repl)) {
		out.java.push("$& (whole match) is JavaScript only. Java uses $0.");
		out.go.push("$& (whole match) is JavaScript only. Go uses ${0}.");
	}
	if (/\$[`']/.test(repl)) {
		out.java.push("$` and $' are JavaScript only.");
		out.go.push("$` and $' are JavaScript only.");
	}
	if (/(?<!\$)\$(?![\d<&`'$])/.test(repl) && !/\$\{/.test(repl)) out.java.push("A lone $ in a Java replacement throws an exception; escape it as \\$.");
	out.convert.java = repl.replace(/\$<([^>]+)>/g, "${$1}").replace(/\$&/g, "$0");
	out.convert.go = repl.replace(/\$<([^>]+)>/g, "${$1}").replace(/\$&/g, "${0}").replace(/\$(\d+)/g, "${$1}");
	return out;
}

export const EXAMPLES = [
	{ label: "Email (portable)", pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", flags: "g", input: "Contact ann@example.test or bob.smith@corp.example.org." },
	{ label: "Lookbehind (no Go)", pattern: "(?<=USD )\\d+(?:\\.\\d{2})?", flags: "g", input: "Total USD 120.50, tax USD 9, fee EUR 4.00" },
	{ label: "Named groups (Java underscore)", pattern: "(?<first_name>\\w+) (?<last>\\w+)", flags: "g", input: "Priya Shah and Omar Haddad" },
	{ label: "Java anchors \\A \\z", pattern: "\\Afoo\\d+\\z", flags: "", input: "foo123" },
	{ label: "Backtracking risk", pattern: "^(a+)+$", flags: "", input: "aaaaaaaaaaaaaaaaaaaaaaaa!" },
	{ label: "POSIX class (Go)", pattern: "[[:alpha:]]+", flags: "g", input: "abc 123 def" },
];
