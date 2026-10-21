// Browser UI for the JSON and XML diff tool. Runs fully in the browser.
// Text from files and engine output goes through h() or textContent. Nothing is parsed as HTML.

import { h, $, setStatus, downloadText, bindDropZone, readTextFile, storageGet, storageSet, plural, fmtSize, errText, flash } from "../shared/kit.js";
import { diff, diffMarkdown, toJsonPatch, detectFormat, SAMPLE, IIQ_VOLATILE_ATTRS } from "./diff.js";

const PAGE = 500; // change cards rendered per page
const VALUE_MAX = 20000; // characters of one value shown in a card; the search still sees all of it
const LARGE_FILE = 5 * 1024 * 1024;
const OPTS_KEY = "sk-diff-options";
const ALL_OPS = ["add", "remove", "replace"];
const OP = {
	add: { label: "ADD", cls: "add" },
	remove: { label: "REMOVE", cls: "remove" },
	replace: { label: "CHANGE", cls: "change" },
};
const MODE_LABEL = { key: "By key field", index: "By position", set: "As unordered set" };
const SIDES = {
	left: { ta: "diff-left", file: "diff-left-file", drop: "diff-left-drop", size: "diff-left-size" },
	right: { ta: "diff-right", file: "diff-right-file", drop: "diff-right-drop", size: "diff-right-size" },
};

// Option controls. kind: "select", "text" (comma lists are split on read) or "check".
const FIELDS = [
	{ id: "opt-format", key: "format", kind: "select", def: "auto" },
	{ id: "opt-array-mode", key: "arrayMode", kind: "select", def: "key" },
	{ id: "opt-array-key", key: "arrayKey", kind: "text", def: "" },
	{ id: "opt-ignore-keys", key: "ignoreKeys", kind: "text", def: "" },
	{ id: "opt-ignore-case", key: "ignoreCase", kind: "check", def: false },
	{ id: "opt-trim-strings", key: "trimStrings", kind: "check", def: false },
	{ id: "opt-key-attrs", key: "keyAttrs", kind: "text", def: "name,id,key" },
	{ id: "opt-ignore-attrs", key: "ignoreAttrs", kind: "text", def: "" },
	{ id: "opt-ignore-elements", key: "ignoreElements", kind: "text", def: "" },
	{ id: "opt-iiq", key: "iiq", kind: "check", def: false },
	{ id: "opt-collapse", key: "collapseWhitespace", kind: "check", def: true },
	{ id: "opt-respect-order", key: "respectOrder", kind: "check", def: false },
];

// Module state. `result` is the last engine result, `opts` the options used for it.
let result = null;
let opts = null;
let entries = []; // [{ change, hay }] for the last successful result
let shown = []; // entries that pass the filters and search
let rendered = 0; // how many of `shown` have cards in the list
let ops = new Set(ALL_OPS);
let timer = null;
const fileNames = { left: null, right: null };

// ------------------------------------------------------------------ helpers

const splitList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
const show = (el, on) => {
	el.hidden = !on;
};
const sideText = (side) => $(SIDES[side].ta).value;

// Plain text for a value. XML values are strings and are shown as they are. JSON values are pretty printed.
function valueText(v, format) {
	if (v === undefined) return "";
	if (format === "xml" && typeof v === "string") return v;
	const s = JSON.stringify(v, null, 2);
	return s === undefined ? String(v) : s;
}

function haystack(c) {
	return [c.path || "", valueText(c.before, result.format), valueText(c.after, result.format), c.typeChange || ""].join("\n").toLowerCase();
}

// ------------------------------------------------------------------ options

function currentValues() {
	const v = {};
	for (const f of FIELDS) v[f.key] = f.kind === "check" ? $(f.id).checked : $(f.id).value;
	return v;
}

function readOptions() {
	const v = currentValues();
	return {
		format: v.format,
		arrayMode: v.arrayMode,
		arrayKey: String(v.arrayKey).trim(),
		ignoreKeys: splitList(v.ignoreKeys),
		ignoreCase: v.ignoreCase,
		trimStrings: v.trimStrings,
		keyAttrs: splitList(v.keyAttrs),
		ignoreAttrs: splitList(v.ignoreAttrs),
		ignoreElements: splitList(v.ignoreElements),
		iiq: v.iiq,
		collapseWhitespace: v.collapseWhitespace,
		respectOrder: v.respectOrder,
	};
}

// Only the options are saved. Documents are never stored.
function saveOptions() {
	storageSet(OPTS_KEY, JSON.stringify(currentValues()));
}

function loadOptions() {
	let saved = null;
	try {
		saved = JSON.parse(storageGet(OPTS_KEY) || "null");
	} catch (e) {
		saved = null;
	}
	if (!saved || typeof saved !== "object") return;
	for (const f of FIELDS) {
		const el = $(f.id);
		const v = saved[f.key];
		if (f.kind === "check" && typeof v === "boolean") el.checked = v;
		else if (f.kind === "text" && typeof v === "string") el.value = v;
		else if (f.kind === "select" && typeof v === "string" && [...el.options].some((o) => o.value === v)) el.value = v;
	}
}

// Which option groups apply: the chosen format, or the detected one when Auto. Both when nothing is detected.
function shownFormat() {
	const f = $("opt-format").value;
	if (f !== "auto") return f;
	const a = detectFormat(sideText("left"));
	const b = detectFormat(sideText("right"));
	const d = a !== "unknown" ? a : b;
	return d === "unknown" ? "both" : d;
}

function syncOptionGroups() {
	const f = shownFormat();
	show($("diff-opts-json"), f === "json" || f === "both");
	show($("diff-opts-xml"), f === "xml" || f === "both");
}

// ------------------------------------------------------------------ inputs

function refreshSize(side) {
	const v = sideText(side);
	let s = "Empty";
	if (v) {
		const bytes = new TextEncoder().encode(v).length;
		s = `${fmtSize(bytes)} · ${plural(v.split("\n").length, "line")}`;
	}
	if (fileNames[side]) s = `${fileNames[side]} · ${s}`;
	$(SIDES[side].size).textContent = s;
}

function setSide(side, value, name) {
	$(SIDES[side].ta).value = value;
	fileNames[side] = name || null;
	refreshSize(side);
}

function setMsg(t) {
	$("diff-input-msg").textContent = t;
}

async function loadFile(side, fileList) {
	const file = fileList && fileList[0];
	if (!file) return;
	try {
		const value = await readTextFile(file);
		setSide(side, value, file.name);
		const notes = [];
		if (fileList.length > 1) notes.push("Only the first file is used.");
		if (file.size > LARGE_FILE) notes.push("The file is large, so comparing it may be slow.");
		setMsg([`Loaded ${file.name}.`, ...notes].join(" "));
		run();
	} catch (e) {
		setMsg(`Could not read ${file ? file.name : "the file"}: ${errText(e)}`);
	}
}

function loadSample(kind) {
	const [l, r] = SAMPLE[kind];
	setSide("left", l, null);
	setSide("right", r, null);
	setMsg(`Loaded the ${kind.toUpperCase()} sample.`);
	run();
}

// ------------------------------------------------------------------ running the diff

function scheduleRun() {
	clearTimeout(timer);
	timer = setTimeout(run, 300);
}

function run() {
	clearTimeout(timer);
	timer = null;
	syncOptionGroups();
	const left = sideText("left");
	const right = sideText("right");
	if (!left.trim() || !right.trim()) {
		result = null;
		const msg = (left.trim() || right.trim())
			? "Add a document to the other side to compare."
			: "Paste or drop a JSON or XML document into both sides, or load a sample.";
		showEmpty(msg);
		return;
	}
	opts = readOptions();
	try {
		result = diff(left, right, opts);
	} catch (e) {
		result = { ok: false, error: errText(e) };
	}
	render();
}

function showEmpty(msg) {
	$("diff-empty-msg").textContent = msg;
	show($("diff-empty"), true);
	show($("diff-error"), false);
	show($("diff-result"), false);
	entries = [];
	shown = [];
	updateActions();
	setStatus(msg);
}

function statCard(label, n, mod) {
	return h(
		"div",
		{ class: `tool-stat ${mod}` },
		h("span", { class: "tool-stat-label", text: label }),
		h("span", { class: "tool-stat-num", text: String(n) }),
	);
}

function render() {
	updateActions();
	if (!result.ok) {
		show($("diff-empty"), false);
		show($("diff-result"), false);
		const box = $("diff-error");
		box.replaceChildren(
			h("p", { class: "tool-alert-title", text: "Cannot compare these documents" }),
			h("p", { text: result.error }),
		);
		show(box, true);
		entries = [];
		shown = [];
		setStatus("Cannot compare. See the message in the result pane.");
		return;
	}

	show($("diff-empty"), false);
	show($("diff-error"), false);
	show($("diff-result"), true);

	const s = result.stats;
	$("diff-format").replaceChildren(
		h("span", { text: "Format" }),
		h("span", { class: "tool-pill tool-pill--neutral", text: result.format.toUpperCase() }),
	);
	$("diff-summary").replaceChildren(
		statCard("Total", s.total, ""),
		statCard("Added", s.added, "tool-stat--converted"),
		statCard("Removed", s.removed, "tool-stat--manual"),
		statCard("Changed", s.changed, "tool-stat--review"),
	);
	$("diff-notes").replaceChildren(...result.notes.map((n) => h("p", { class: "tool-alert", role: "note", text: `Note: ${n}` })));

	const none = s.total === 0;
	show($("diff-identical"), none);
	show($("diff-toolbar"), !none);
	setStatus(none ? "Identical" : plural(s.total, "difference"));

	entries = result.changes.map((change) => ({ change, hay: haystack(change) }));
	applyFilter();
}

// ------------------------------------------------------------------ change list

function card(c) {
	const meta = OP[c.op];
	const blocks = [];
	if (c.op !== "add") blocks.push(valueBlock("Before", c.before));
	if (c.op !== "remove") blocks.push(valueBlock("After", c.after));
	return h(
		"article",
		{ class: `diff-card diff-card--${meta.cls}` },
		h(
			"div",
			{ class: "diff-card-head" },
			h("span", { class: `diff-badge diff-badge--${meta.cls}`, text: meta.label }),
			h("code", { class: "diff-path", text: c.path || "/" }),
		),
		c.typeChange ? h("p", { class: "diff-type", text: `Type changed: ${c.typeChange}` }) : null,
		blocks,
	);
}

function valueBlock(label, v) {
	let s = valueText(v, result.format);
	if (s === "") s = "(empty)";
	else if (s.length > VALUE_MAX) s = `${s.slice(0, VALUE_MAX)}\n... (${s.length - VALUE_MAX} more characters)`;
	return h(
		"div",
		{ class: "diff-val" },
		h("span", { class: "diff-val-label", text: label }),
		h("pre", { class: "diff-pre", tabindex: "0", text: s }),
	);
}

function applyFilter() {
	const q = $("diff-search").value.trim().toLowerCase();
	shown = entries.filter((e) => ops.has(e.change.op) && (!q || e.hay.includes(q)));
	rendered = 0;
	$("diff-list").replaceChildren();
	updateChips();
	renderMore();
}

function renderMore() {
	const end = Math.min(shown.length, rendered + PAGE);
	const frag = document.createDocumentFragment();
	for (let i = rendered; i < end; i++) frag.append(card(shown[i].change));
	$("diff-list").append(frag);
	rendered = end;

	show($("diff-more"), rendered < shown.length);
	show($("diff-nomatch"), entries.length > 0 && shown.length === 0);
	const total = entries.length;
	let txt = shown.length === total ? plural(total, "change") : `${shown.length} of ${plural(total, "change")} match`;
	if (rendered < shown.length) txt += `. Showing the first ${rendered}`;
	$("diff-count").textContent = txt;
}

function updateChips() {
	const all = ops.size === ALL_OPS.length;
	for (const b of $("diff-chips").querySelectorAll("[data-op]")) {
		const op = b.dataset.op;
		const on = op === "all" ? all : ops.has(op);
		b.classList.toggle("is-on", on);
		b.setAttribute("aria-pressed", on ? "true" : "false");
	}
}

// ------------------------------------------------------------------ output actions

function patchHint(ok, canPatch) {
	if (!result) return "JSON Patch is available after a diff of two JSON documents.";
	if (!ok) return "JSON Patch needs two valid JSON documents.";
	if (result.format !== "json") return "JSON Patch is only available for JSON. XML results have no JSON Patch form.";
	if (canPatch) return "RFC 6902 patch from left to right. Arrays were compared by position.";
	return `JSON Patch is off because Arrays compared is "${MODE_LABEL[opts.arrayMode] || opts.arrayMode}". Choose "By position" to build a patch, because patch paths are array positions.`;
}

function updateActions() {
	const ok = !!(result && result.ok);
	const canPatch = ok && result.format === "json" && !!opts && opts.arrayMode === "index";
	$("dl-md").disabled = !ok;
	$("copy-paths").disabled = !ok;
	$("dl-patch").disabled = !canPatch;
	$("patch-hint").textContent = patchHint(ok, canPatch);
}

// ------------------------------------------------------------------ wiring

function setHelp(open) {
	const help = $("diff-help");
	show(help, open);
	$("diff-help-btn").setAttribute("aria-expanded", open ? "true" : "false");
	(open ? $("diff-help-close") : $("diff-help-btn")).focus();
}

function init() {
	// A file dropped outside a drop zone must not open in the browser tab.
	window.addEventListener("dragover", (e) => e.preventDefault());
	window.addEventListener("drop", (e) => e.preventDefault());

	$("diff-iiq-list").textContent = IIQ_VOLATILE_ATTRS.join(", ");
	loadOptions();

	for (const side of Object.keys(SIDES)) {
		const cfg = SIDES[side];
		$(cfg.ta).addEventListener("input", () => {
			fileNames[side] = null;
			refreshSize(side);
			syncOptionGroups();
			scheduleRun();
		});
		bindDropZone($(cfg.drop), $(cfg.file), (fileList) => loadFile(side, fileList));
		refreshSize(side);
	}

	for (const f of FIELDS) {
		$(f.id).addEventListener(f.kind === "text" ? "input" : "change", () => {
			saveOptions();
			syncOptionGroups();
			scheduleRun();
		});
	}

	$("diff-run").addEventListener("click", run);
	$("diff-swap").addEventListener("click", () => {
		const l = sideText("left");
		const r = sideText("right");
		const nl = fileNames.left;
		const nr = fileNames.right;
		setSide("left", r, nr);
		setSide("right", l, nl);
		setMsg("Swapped the sides.");
		run();
	});
	$("diff-sample-json").addEventListener("click", () => loadSample("json"));
	$("diff-sample-xml").addEventListener("click", () => loadSample("xml"));
	$("diff-empty-json").addEventListener("click", () => loadSample("json"));
	$("diff-empty-xml").addEventListener("click", () => loadSample("xml"));
	$("diff-clear").addEventListener("click", () => {
		setSide("left", "", null);
		setSide("right", "", null);
		setMsg("Cleared both sides.");
		run();
	});

	$("diff-chips").addEventListener("click", (e) => {
		const b = e.target.closest("[data-op]");
		if (!b) return;
		const op = b.dataset.op;
		if (op === "all") {
			ops = new Set(ALL_OPS);
		} else {
			const next = new Set(ops);
			if (next.has(op)) next.delete(op);
			else next.add(op);
			// An empty selection would hide everything, so it falls back to all.
			ops = next.size ? next : new Set(ALL_OPS);
		}
		applyFilter();
	});
	$("diff-search").addEventListener("input", applyFilter);
	$("diff-more").addEventListener("click", renderMore);

	$("dl-md").addEventListener("click", () => {
		if (!result || !result.ok) return;
		downloadText("diff-report.md", diffMarkdown(result), "text/markdown;charset=utf-8");
		setStatus("Report downloaded.");
	});
	$("dl-patch").addEventListener("click", () => {
		if (!result || !result.ok || result.format !== "json" || !opts || opts.arrayMode !== "index") return;
		const patch = toJsonPatch(result.changes);
		downloadText("diff-patch.json", JSON.stringify(patch, null, 2), "application/json;charset=utf-8");
		setStatus(`JSON Patch downloaded: ${plural(patch.length, "operation")}.`);
	});
	$("copy-paths").addEventListener("click", async (e) => {
		const btn = e.currentTarget;
		const paths = shown.map((x) => x.change.path || "/").join("\n");
		if (!paths) {
			flash(btn, "Nothing shown", "Copy paths");
			return;
		}
		try {
			await navigator.clipboard.writeText(paths);
			flash(btn, "Copied", "Copy paths");
		} catch (err) {
			flash(btn, "Copy blocked", "Copy paths");
		}
	});

	const helpBtn = $("diff-help-btn");
	helpBtn.addEventListener("click", () => setHelp($("diff-help").hidden));
	$("diff-help-close").addEventListener("click", () => setHelp(false));

	document.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			run();
		} else if (e.key === "Escape" && !$("diff-help").hidden) {
			setHelp(false);
		}
	});

	syncOptionGroups();
	run();
}

init();
