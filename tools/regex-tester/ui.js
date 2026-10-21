// Regex tester UI. JavaScript runs in regex-worker.js under a time limit. Java and Go are checked, never run.
// User text only reaches the page through kit h() and text nodes. No innerHTML anywhere.

import { $, h, setStatus, copyButton, storageGet, storageSet, setInlineError, plural, errText } from "../shared/kit.js";
import { analyze, translateToJs, analyzeReplacement, asJava, asGo, asJs, FLAVORS, FLAVOR_LABEL, BEHAVIOUR_DIFFS, EXAMPLES } from "./regex.js";

const STORE_KEY = "sk-regex-tester";
const DEBOUNCE_MS = 200;
const TIMEOUT_MS = 1500;
const FLAG_IDS = ["g", "i", "m", "s", "u", "y", "d"];
const STATUS_TEXT = { compatible: "Compatible", differs: "Differs", incompatible: "Incompatible", risky: "Risky" };
const STATUS_CLASS = { compatible: "tool-pill--pass", differs: "tool-pill--medium", incompatible: "tool-pill--high", risky: "rx-pill--risky" };
const STATUS_SENTENCE = {
	compatible: "No construct on the known list is rejected or changed.",
	differs: "The pattern compiles, but some constructs mean something else or are ignored.",
	incompatible: "At least one construct is rejected, so the pattern will not compile in this flavor.",
	risky: "No other issue found, but the pattern can backtrack catastrophically in JavaScript and Java.",
};
const VERDICT_TEXT = { no: "Rejected", diff: "Different" };
const TIMEOUT_TEXT = "Timed out after 1.5 s: this pattern may backtrack catastrophically in JavaScript and Java. Go (RE2) would finish in linear time.";
const DEFAULTS = { pattern: EXAMPLES[0].pattern, flavor: "js", flags: EXAMPLES[0].flags, input: EXAMPLES[0].input, replacement: "" };

const els = {
	pattern: $("rx-pattern"),
	flavor: $("rx-flavor"),
	flags: Object.fromEntries(FLAG_IDS.map((f) => [f, $(`rx-flag-${f}`)])),
	input: $("rx-input"),
	replacement: $("rx-replacement"),
	examples: $("rx-examples"),
	run: $("rx-run"),
	clear: $("rx-clear"),
	empty: $("rx-empty"),
	results: $("rx-results"),
	banner: $("rx-banner"),
	bannerTitle: $("rx-banner-title"),
	bannerText: $("rx-banner-text"),
	bannerLists: $("rx-banner-lists"),
	tryBtn: $("rx-try"),
	cards: $("rx-cards"),
	alert: $("rx-alert"),
	notice: $("rx-notice"),
	matches: $("rx-matches"),
	summary: $("rx-summary"),
	highlight: $("rx-highlight"),
	tableWrap: $("rx-table-wrap"),
	rows: $("rx-rows"),
	noMatches: $("rx-no-matches"),
	replSec: $("rx-repl-sec"),
	replBody: $("rx-repl-body"),
	code: $("rx-code"),
	diffBody: $("rx-diff-body"),
	help: $("rx-help"),
	helpBtn: $("rx-help-btn"),
	helpClose: $("rx-help-close"),
};

const state = {
	translate: false, // true when "Try in JS" is active for the current pattern
	debounce: 0,
	timer: 0,
	seq: 0,
	current: null, // the run whose result is still wanted: {id, v, translation, translated}
	inFlight: false,
	worker: null,
	lastTrigger: null,
};

// ------------------------------------------------------------------ inputs and storage

function readInputs() {
	return {
		pattern: els.pattern.value,
		flavor: els.flavor.value,
		flags: FLAG_IDS.filter((f) => els.flags[f].checked).join(""),
		input: els.input.value,
		replacement: els.replacement.value,
	};
}

function setFlags(flags) {
	for (const f of FLAG_IDS) els.flags[f].checked = flags.includes(f);
}

function applyInputs(v) {
	els.pattern.value = v.pattern;
	els.flavor.value = v.flavor;
	setFlags(v.flags);
	els.input.value = v.input;
	els.replacement.value = v.replacement;
}

function loadInputs() {
	const raw = storageGet(STORE_KEY);
	if (!raw) return { ...DEFAULTS };
	try {
		const v = JSON.parse(raw);
		const str = (x, fallback) => (typeof x === "string" ? x : fallback);
		return {
			pattern: str(v.pattern, DEFAULTS.pattern),
			flavor: FLAVORS.includes(v.flavor) ? v.flavor : DEFAULTS.flavor,
			flags: [...new Set(str(v.flags, "").split(""))].filter((f) => FLAG_IDS.includes(f)).join(""),
			input: str(v.input, ""),
			replacement: str(v.replacement, ""),
		};
	} catch (e) {
		return { ...DEFAULTS };
	}
}

function saveInputs(v) {
	storageSet(STORE_KEY, JSON.stringify(v));
}

// ------------------------------------------------------------------ worker lifecycle

function ensureWorker() {
	if (state.worker) return state.worker;
	const w = new Worker(new URL("./regex-worker.js", import.meta.url), { type: "module" });
	w.onmessage = (event) => onWorkerMessage(event.data);
	w.onerror = (event) => {
		if (event && event.preventDefault) event.preventDefault();
		if (state.worker !== w) return;
		const ctx = state.current;
		killWorker();
		state.current = null;
		clearTimeout(state.timer);
		state.timer = 0;
		if (ctx) showError(ctx.v, `The matching worker failed: ${event && event.message ? event.message : "unknown error"}`);
		setStatus("The matching worker failed.");
	};
	state.worker = w;
	return w;
}

function killWorker() {
	if (state.worker) state.worker.terminate();
	state.worker = null;
	state.inFlight = false;
}

// Stops any run in progress. A job stuck in the worker is killed, so the next job is not queued behind it.
function cancelRun() {
	if (state.inFlight) killWorker();
	clearTimeout(state.timer);
	state.timer = 0;
	state.current = null;
}

function onWorkerMessage(data) {
	const ctx = state.current;
	if (!ctx || !data || data.id !== ctx.id) return; // stale response from an older run
	state.current = null;
	state.inFlight = false;
	clearTimeout(state.timer);
	state.timer = 0;
	finishRun(ctx, data.result);
}

function onTimeout(id) {
	const ctx = state.current;
	if (!ctx || ctx.id !== id) return;
	state.current = null;
	state.timer = 0;
	killWorker();
	renderBanner(ctx.v, ctx.translation, null);
	showError(ctx.v, TIMEOUT_TEXT);
	setStatus("Timed out after 1.5 s.");
}

// ------------------------------------------------------------------ run

function targetFor(v, translation) {
	if (state.translate) return { pattern: translation.pattern, flags: translation.flags };
	if (v.flavor === "js") return { pattern: v.pattern, flags: v.flags };
	return null; // Java or Go, not translated: checked only
}

function runNow() {
	clearTimeout(state.debounce);
	cancelRun();
	const v = readInputs();
	saveInputs(v);
	if (!v.pattern) {
		showEmpty();
		return;
	}
	showResults();
	const analysis = analyze(v.pattern);
	const translation = translateToJs(v.pattern, v.flags);
	renderCards(v, analysis);
	renderCode(v);

	const target = targetFor(v, translation);
	if (!target) {
		renderBanner(v, translation, null);
		showNotice(`${FLAVOR_LABEL[v.flavor]} is checked, not run. Use Try in JS to run a translated copy.`);
		renderReplacement(v, null);
		setStatus(`${FLAVOR_LABEL[v.flavor]} pattern checked, not run. Use Try in JS.`);
		return;
	}

	const id = ++state.seq;
	state.current = { id, v, translation, translated: state.translate };
	try {
		const worker = ensureWorker();
		state.inFlight = true;
		worker.postMessage({ id, pattern: target.pattern, flags: target.flags, input: v.input, replacement: v.replacement });
	} catch (err) {
		state.current = null;
		killWorker();
		showError(v, `Could not start the matching worker: ${errText(err)}`);
		setStatus("Could not start the matching worker.");
		return;
	}
	state.timer = setTimeout(() => onTimeout(id), TIMEOUT_MS);
}

function scheduleRun() {
	clearTimeout(state.debounce);
	state.debounce = setTimeout(runNow, DEBOUNCE_MS);
}

function finishRun(ctx, result) {
	const { v, translation, translated } = ctx;
	if (!result || !result.ok) {
		const error = result && result.error ? result.error : "unknown error";
		renderBanner(v, translation, error);
		showError(v, `${translated ? "The translated pattern" : "Invalid pattern in JavaScript"}: ${error}`);
		setStatus(translated ? "Translated pattern does not compile." : "Invalid pattern in JavaScript.");
		return;
	}
	setInlineError(els.alert, "");
	hideNotice();
	renderBanner(v, translation, null);
	renderMatches(v, result, translated);
	renderReplacement(v, result);
	const n = result.matches.length;
	let text = `${plural(n, "match")} in ${result.ms} ms${translated ? " (translated)" : ""}`;
	if (result.truncated) text += `, first ${n} shown`;
	setStatus(text);
}

// ------------------------------------------------------------------ view states

function showEmpty() {
	cancelRun();
	els.empty.hidden = false;
	els.results.hidden = true;
	setStatus("Enter a pattern to start.");
}

function showResults() {
	els.empty.hidden = true;
	els.results.hidden = false;
}

function showNotice(text) {
	setInlineError(els.alert, "");
	els.matches.hidden = true;
	els.notice.textContent = text;
	els.notice.hidden = false;
}

function hideNotice() {
	els.notice.textContent = "";
	els.notice.hidden = true;
}

function showError(v, text) {
	setInlineError(els.alert, text);
	els.matches.hidden = true;
	hideNotice();
	renderReplacement(v, null);
}

// ------------------------------------------------------------------ translation banner

function renderBanner(v, translation, compileError) {
	const translated = state.translate;
	const offer = !translated && (v.flavor !== "js" || Boolean(compileError));
	if (!translated && !offer) {
		els.banner.hidden = true;
		els.bannerLists.replaceChildren();
		return;
	}
	const label = FLAVOR_LABEL[v.flavor];
	let title;
	let text;
	if (translated) {
		title = v.flavor === "js" ? "Running a translated pattern" : `Running a JavaScript translation of this ${label} pattern`;
		text = "The translated pattern is what runs, so the matches are JavaScript results, not a run of the original. Rewrites and gaps are listed below.";
	} else if (v.flavor !== "js") {
		title = `Written for ${label}: checked, not run`;
		text = `${label} patterns cannot run in the browser. Try in JS rewrites the syntax JavaScript does not have and runs the result.`;
	} else {
		title = "Does not compile in JavaScript";
		text = `JavaScript says: ${compileError}. Java or Go syntax may be the cause. Try in JS rewrites what it can and runs the result.`;
	}
	els.bannerTitle.textContent = title;
	els.bannerText.textContent = text;

	const lists = [h("p", null, translated ? "Running: " : "Would run as: ", h("code", { text: translation.pattern }), " flags ", h("code", { text: translation.flags || "none" }))];
	if (translation.notes.length) {
		lists.push(h("p", { text: "Rewritten:" }), h("ul", null, translation.notes.map((n) => h("li", { text: n }))));
	} else {
		lists.push(h("p", { class: "tool-muted", text: "No rewrites needed." }));
	}
	if (translation.unsupported.length) {
		lists.push(h("p", { text: "Not rewritten, so results may differ:" }), h("ul", null, translation.unsupported.map((u) => h("li", { text: u }))));
	}
	els.bannerLists.replaceChildren(...lists);
	els.tryBtn.textContent = translated ? "Use original pattern" : "Try in JS";
	els.banner.hidden = false;
}

// ------------------------------------------------------------------ portability cards

function renderCards(v, analysis) {
	els.cards.replaceChildren(...FLAVORS.map((f) => flavorCard(f, analysis, v.flavor)));
}

function flavorCard(f, analysis, writtenFor) {
	const c = analysis.compat[f];
	const isFor = f === writtenFor;
	const issues = c.issues.map((issue) =>
		h(
			"li",
			null,
			h(
				"div",
				{ class: "rx-issue-head" },
				h("span", { class: "rx-verdict", text: VERDICT_TEXT[issue.verdict] || "Different" }),
				h("code", { class: "rx-construct", text: issue.text }),
				h("span", { class: "tool-hint", text: `at index ${issue.index}` }),
			),
			h("p", { class: "rx-note", text: issue.note }),
		),
	);

	let redos = null;
	if (f === "go") {
		if (analysis.redos.length) redos = h("p", { class: "rx-redos", text: "Go (RE2) is not affected by backtracking risks: it runs in linear time." });
	} else if (c.redos && c.redos.length) {
		redos = h(
			"div",
			{ class: "rx-redos" },
			h("p", { text: "Backtracking risk: this pattern can take exponential time in this flavor on a failing input." }),
			c.redos.map((r) => h("p", null, h("code", { class: "rx-construct", text: r.text }), " ", r.why)),
		);
	}

	return h(
		"article",
		{ class: isFor ? "rx-card rx-card--for" : "rx-card", "aria-labelledby": `rx-card-${f}` },
		h(
			"div",
			{ class: "rx-card-head" },
			h("h4", { id: `rx-card-${f}`, class: "rx-card-title", text: FLAVOR_LABEL[f] }),
			isFor ? h("span", { class: "rx-tag", text: "Written for" }) : null,
			h("span", { class: `tool-pill ${STATUS_CLASS[c.status]}`, text: STATUS_TEXT[c.status] }),
		),
		h("p", { class: "rx-card-sum", text: STATUS_SENTENCE[c.status] }),
		c.issues.length ? h("ul", { class: "rx-issues" }, issues) : null,
		redos,
	);
}

// ------------------------------------------------------------------ matches

function formatGroups(groups) {
	if (!groups.length) return "none";
	return groups.map((g, i) => `${i + 1}=${g === null || g === undefined ? "(unset)" : JSON.stringify(g)}`).join(", ");
}

function formatNamed(named) {
	const entries = Object.entries(named || {});
	if (!entries.length) return "none";
	return entries.map(([k, val]) => `${k}=${val === null || val === undefined ? "(unset)" : JSON.stringify(val)}`).join(", ");
}

// Builds the highlighted input from text nodes and <mark> elements. Empty matches are skipped visually.
function buildHighlight(input, matches) {
	const nodes = [];
	let pos = 0;
	let k = 0;
	for (const m of matches) {
		if (m.end <= m.index) continue;
		if (m.index < pos) continue;
		if (m.index > pos) nodes.push(document.createTextNode(input.slice(pos, m.index)));
		nodes.push(h("mark", { class: k % 2 ? "rx-mark rx-mark--b" : "rx-mark rx-mark--a", text: m.text }));
		k++;
		pos = m.end;
	}
	if (pos < input.length) nodes.push(document.createTextNode(input.slice(pos)));
	return nodes;
}

function renderMatches(v, result, translated) {
	const n = result.matches.length;
	els.matches.hidden = false;
	els.summary.textContent = `${plural(n, "match")} in ${result.ms} ms (JavaScript${translated ? " translation" : ""}). ${plural(result.groupCount, "capture group")}.${result.truncated ? ` Showing the first ${n}.` : ""}`;

	els.highlight.replaceChildren(...buildHighlight(v.input, result.matches));
	if (!v.input) els.highlight.append(h("span", { class: "tool-muted", text: "Test input is empty." }));

	els.rows.replaceChildren(
		...result.matches.map((m, i) =>
			h(
				"tr",
				null,
				h("td", { text: String(i + 1) }),
				h("td", { text: String(m.index) }),
				h("td", { class: "tool-mono-cell", text: m.text === "" ? "(empty)" : m.text }),
				h("td", { class: "tool-mono-cell", text: formatGroups(m.groups) }),
				h("td", { class: "tool-mono-cell", text: formatNamed(m.named) }),
			),
		),
	);
	els.tableWrap.hidden = n === 0;
	els.noMatches.hidden = n !== 0;
}

// ------------------------------------------------------------------ replacement

function copyBtn(text, what) {
	const b = copyButton(() => text, "Copy");
	b.setAttribute("aria-label", `Copy ${what}`);
	return b;
}

function block(label, text, what) {
	return h(
		"div",
		{ class: "rx-block" },
		h("div", { class: "rx-block-head" }, h("span", { class: "rx-block-label", text: label }), copyBtn(text, what)),
		h("pre", { class: "rx-pre", text }),
	);
}

function renderReplacement(v, result) {
	els.replSec.hidden = !v.replacement;
	if (!v.replacement) {
		els.replBody.replaceChildren();
		return;
	}
	const nodes = [h("h4", { class: "rx-sub", text: "JavaScript result" })];
	if (!result) {
		nodes.push(h("p", { class: "tool-muted", text: "Not run in JavaScript." }));
	} else if (!result.ok) {
		nodes.push(h("p", { class: "tool-muted", text: "Not run: the pattern did not compile in JavaScript." }));
	} else if (result.replaced === null) {
		nodes.push(h("p", { class: "tool-muted", text: "The replacement could not be applied in JavaScript." }));
	} else {
		nodes.push(block("Result", result.replaced, "JavaScript replacement result"));
	}

	const w = analyzeReplacement(v.replacement);
	nodes.push(h("h4", { class: "rx-sub", text: "Warnings by flavor" }));
	nodes.push(
		...FLAVORS.map((f) =>
			h(
				"div",
				{ class: "rx-warn" },
				h("span", { class: "rx-block-label", text: FLAVOR_LABEL[f] }),
				w[f].length ? h("ul", { class: "rx-warn-list" }, w[f].map((t) => h("li", { text: t }))) : h("p", { class: "tool-muted", text: "No warnings." }),
			),
		),
	);

	nodes.push(h("h4", { class: "rx-sub", text: "Converted replacements" }));
	nodes.push(block("Java (converted from JavaScript syntax)", w.convert.java, "converted Java replacement"));
	nodes.push(block("Go (converted from JavaScript syntax)", w.convert.go, "converted Go replacement"));
	els.replBody.replaceChildren(...nodes);
}

// ------------------------------------------------------------------ use in code

function renderCode(v) {
	const items = [
		["Java string literal", asJava(v.pattern)],
		["Go literal", asGo(v.pattern)],
		["JavaScript literal", asJs(v.pattern, v.flags)],
	];
	els.code.replaceChildren(...items.map(([label, text]) => block(label, text, label.toLowerCase())));
}

// ------------------------------------------------------------------ static tables and examples

function renderDiffs() {
	els.diffBody.replaceChildren(
		...BEHAVIOUR_DIFFS.map((d) =>
			h("tr", null, h("th", { scope: "row", text: d.topic }), h("td", { text: d.js }), h("td", { text: d.java }), h("td", { text: d.go })),
		),
	);
}

function renderExamples() {
	els.examples.replaceChildren(
		...EXAMPLES.map((ex) => h("button", { class: "btn btn--ghost wb-btn", type: "button", text: ex.label, onclick: () => loadExample(ex) })),
	);
}

function loadExample(ex) {
	els.pattern.value = ex.pattern;
	els.input.value = ex.input;
	els.flavor.value = "js";
	setFlags(ex.flags);
	state.translate = false;
	runNow();
}

// ------------------------------------------------------------------ help drawer and keys

function openHelp() {
	state.lastTrigger = document.activeElement;
	els.help.hidden = false;
	els.helpBtn.setAttribute("aria-expanded", "true");
	els.helpClose.focus({ preventScroll: true });
}

function closeHelp() {
	if (els.help.hidden) return;
	els.help.hidden = true;
	els.helpBtn.setAttribute("aria-expanded", "false");
	const back = state.lastTrigger && state.lastTrigger.focus ? state.lastTrigger : els.helpBtn;
	back.focus({ preventScroll: true });
}

function toggleHelp() {
	if (els.help.hidden) openHelp();
	else closeHelp();
}

function onKey(e) {
	if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
		e.preventDefault();
		runNow();
		return;
	}
	if (e.key === "Escape") {
		closeHelp();
		return;
	}
	const target = e.target instanceof Element ? e.target : null;
	const typing = target && target.closest("input, textarea, select, [contenteditable='true']");
	if (e.key === "?" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
		e.preventDefault();
		toggleHelp();
	}
}

// ------------------------------------------------------------------ wiring

function bind() {
	els.pattern.addEventListener("input", () => {
		state.translate = false;
		scheduleRun();
	});
	els.pattern.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			runNow();
		}
	});
	els.flavor.addEventListener("change", () => {
		state.translate = false;
		runNow();
	});
	for (const f of FLAG_IDS) {
		els.flags[f].addEventListener("change", () => {
			state.translate = false;
			runNow();
		});
	}
	els.input.addEventListener("input", scheduleRun);
	els.replacement.addEventListener("input", scheduleRun);
	els.replacement.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			runNow();
		}
	});
	els.run.addEventListener("click", runNow);
	els.clear.addEventListener("click", () => {
		els.pattern.value = "";
		els.input.value = "";
		els.replacement.value = "";
		state.translate = false;
		runNow();
		els.pattern.focus();
	});
	els.tryBtn.addEventListener("click", () => {
		state.translate = !state.translate;
		runNow();
		if (els.banner.hidden) els.pattern.focus();
	});
	els.helpBtn.addEventListener("click", toggleHelp);
	els.helpClose.addEventListener("click", closeHelp);
	document.addEventListener("keydown", onKey);
}

function init() {
	renderDiffs();
	renderExamples();
	applyInputs(loadInputs());
	bind();
	runNow();
}

init();
