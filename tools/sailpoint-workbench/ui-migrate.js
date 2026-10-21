// Migrate module: IIQ XML in, ISC output out. Same behaviour as the original single-page tool.
// The last successful conversion is stored with setLastMigration so Gap analysis and Transform lab can use it.

import { convert, STATUS } from "./engine.js";
import { SAMPLE_FILES } from "./sample.js";
import {
	$,
	h,
	plural,
	fmtSize,
	basename,
	errText,
	download,
	downloadZip,
	bindDropZone,
	bindTablist,
	readTextFile,
	setLastMigration,
	setStatus,
	storageGet,
	storageSet,
} from "./ui-common.js";
import { setBadge } from "./ui-tabs.js";

const STATUS_KEYS = ["converted", "review", "manual", "unsupported"];
const FOLDER_ORDER = ["sources", "transforms", "identity-profiles", "access-profiles", "roles", "sod-policies", "schedules", "workflows", "rules"];
const OPTS_KEY = "iiq-to-isc:options";
const OPT_FIELDS = {
	defaultOwner: "opt-owner",
	clusterId: "opt-cluster",
	prefix: "opt-prefix",
	tenant: "opt-tenant",
};

const state = {
	files: [], // [{ name, text, size }]
	result: null,
	statuses: new Set(), // empty set means "All"
	kind: "",
	query: "",
	selected: "", // output path shown in the viewer
	pasteCount: 0,
	sub: "summary",
};

const chipButtons = new Map(); // "all" | status -> button
const treeButtons = new Map(); // output path -> button

// ------------------------------------------------------------------ options (Settings popover)

export function readOptions() {
	const out = {};
	for (const [key, id] of Object.entries(OPT_FIELDS)) out[key] = $(id).value.trim();
	return out;
}

function saveOptions() {
	storageSet(OPTS_KEY, JSON.stringify(readOptions()));
}

function loadOptions() {
	const raw = storageGet(OPTS_KEY);
	if (!raw) return;
	try {
		const saved = JSON.parse(raw);
		for (const [key, id] of Object.entries(OPT_FIELDS)) {
			if (typeof saved[key] === "string") $(id).value = saved[key];
		}
	} catch (e) {
		// Ignore unreadable saved options.
	}
}

// ------------------------------------------------------------------ input

function setMsg(text) {
	$("input-msg").textContent = text || "";
}

function showBanner(text) {
	const b = $("banner");
	b.textContent = text;
	b.hidden = false;
}

function hideBanner() {
	const b = $("banner");
	b.textContent = "";
	b.hidden = true;
}

// Stores a file entry, replacing any entry with the same name.
function upsertFile(entry) {
	const i = state.files.findIndex((f) => f.name === entry.name);
	if (i >= 0) state.files[i] = entry;
	else state.files.push(entry);
}

async function addFiles(fileList) {
	const problems = [];
	let added = 0;
	for (const file of Array.from(fileList || [])) {
		if (!/\.xml$/i.test(file.name)) {
			problems.push(`${file.name} is not an .xml file`);
			continue;
		}
		let text = null;
		try {
			text = await readTextFile(file);
		} catch (e) {
			text = null;
		}
		if (text === null) {
			problems.push(`${file.name} could not be read as text`);
			continue;
		}
		upsertFile({ name: file.name, text, size: file.size });
		added++;
	}
	refreshFiles();
	const parts = [];
	if (added) parts.push(`Added ${plural(added, "file")}.`);
	if (problems.length) parts.push(`Skipped: ${problems.join("; ")}.`);
	setMsg(parts.join(" "));
}

function nextPasteName() {
	let name;
	do {
		state.pasteCount++;
		name = `pasted-${state.pasteCount}.xml`;
	} while (state.files.some((f) => f.name === name));
	return name;
}

function addPasted() {
	const ta = $("paste");
	if (!ta.value.trim()) {
		setMsg("Paste some XML first.");
		return;
	}
	const name = nextPasteName();
	upsertFile({ name, text: ta.value, size: ta.value.length });
	ta.value = "";
	refreshFiles();
	setMsg(`Added ${name}.`);
}

function removeFile(name) {
	state.files = state.files.filter((f) => f.name !== name);
	refreshFiles();
}

function renderFileList() {
	const rows = state.files.map((f) =>
		h(
			"li",
			{ class: "tool-filerow" },
			h("span", { class: "tool-name", text: f.name }),
			h("span", { class: "tool-muted", text: fmtSize(f.size) }),
			h("button", {
				class: "btn btn--ghost wb-btn tool-small",
				type: "button",
				"aria-label": `Remove ${f.name}`,
				text: "Remove",
				onclick: () => removeFile(f.name),
			}),
		),
	);
	if (!rows.length) rows.push(h("li", { class: "tool-muted tool-filerow", text: "No files loaded yet." }));
	$("file-list").replaceChildren(...rows);
}

function refreshFiles() {
	renderFileList();
	const n = state.files.length;
	$("convert").disabled = n === 0;
	$("convert-hint").textContent = n ? `${plural(n, "file")} ready to convert.` : "Load at least one file to convert.";
}

function clearAll() {
	state.files = [];
	state.result = null;
	setLastMigration(null);
	showEmpty(true);
	hideBanner();
	setMsg("");
	setBadge("migrate", null);
	refreshFiles();
	setStatus("Cleared all files.");
}

export function loadSample() {
	state.files = SAMPLE_FILES.map((f) => ({ name: f.name, text: f.text, size: f.text.length }));
	refreshFiles();
	setMsg(`Loaded ${plural(state.files.length, "sample file")}.`);
	runConvert();
}

// ------------------------------------------------------------------ convert

function showEmpty(empty) {
	$("mig-empty").hidden = !empty;
	$("results").hidden = empty;
	for (const id of ["dl-zip", "dl-report", "dl-deploy"]) $(id).disabled = empty;
}

function runConvert() {
	if (!state.files.length) return;
	hideBanner();
	saveOptions();
	const input = state.files.map(({ name, text }) => ({ name, text }));
	let result;
	try {
		result = convert(input, readOptions());
	} catch (e) {
		state.result = null;
		setLastMigration(null);
		showEmpty(true);
		setBadge("migrate", null);
		showBanner(`Conversion failed: ${errText(e)}`);
		setStatus("Conversion failed.");
		return;
	}
	state.result = result;
	setLastMigration({ result, files: input });
	state.selected = "";
	state.statuses = new Set();
	state.kind = "";
	state.query = "";
	$("search").value = "";
	showEmpty(false);
	renderResults();
	setBadge("migrate", result.stats.total || 0);
	setStatus(`Converted ${plural(result.stats.total || 0, "object")}, ${plural(result.files.length, "output file")}.`);
}

function renderResults() {
	const r = state.result;
	renderSummary(r);
	buildFilterControls(r);
	renderItems();
	renderTree();
	renderViewer();
}

function stat(label, value, cls) {
	return h(
		"div",
		{ class: `tool-stat${cls ? " tool-stat--" + cls : ""}` },
		h("span", { class: "tool-stat-label", text: label }),
		h("strong", { class: "tool-stat-num", text: String(value) }),
	);
}

function renderSummary(r) {
	const s = r.stats;
	const total = s.total || 0;
	const pct = (k) => (total ? Math.round(((s[k] || 0) / total) * 100) : 0);

	const cards = h("div", { class: "tool-stats" }, stat("Total", total, ""), ...STATUS_KEYS.map((k) => stat(STATUS[k], s[k] || 0, k)));

	const bar = h(
		"div",
		{ class: "tool-bar", "aria-hidden": "true" },
		...STATUS_KEYS.map((k) =>
			h("span", { class: `tool-seg tool-seg--${k}`, style: `width: ${(total ? ((s[k] || 0) / total) * 100 : 0).toFixed(2)}%` }),
		),
	);

	const legend = h(
		"ul",
		{ class: "tool-legend" },
		...STATUS_KEYS.map((k) =>
			h("li", null, h("span", { class: `tool-swatch tool-seg--${k}`, "aria-hidden": "true" }), `${STATUS[k]}: ${s[k] || 0} (${pct(k)}%)`),
		),
	);

	const notes = [];

	if (r.errors.length) {
		notes.push(
			h(
				"div",
				{ class: "tool-alert tool-alert--error" },
				h("p", { class: "tool-alert-title", text: `${plural(r.errors.length, "file")} could not be parsed and ${r.errors.length === 1 ? "was" : "were"} skipped.` }),
				h("ul", null, ...r.errors.map((e) => h("li", null, h("span", { class: "tool-name", text: e.file }), `: ${e.message}`))),
			),
		);
	}

	notes.push(
		h(
			"p",
			null,
			r.placeholders.length ? `${plural(r.placeholders.length, "file")} still contain <<placeholders>> to fill in before deploy. ` : "No placeholders left in the output. ",
			r.placeholders.length
				? h(
						"details",
						{ class: "tool-details" },
						h("summary", { text: "Show files" }),
						h("ul", null, ...r.placeholders.map((p) => h("li", { class: "tool-name", text: p }))),
					)
				: null,
		),
	);

	notes.push(
		h(
			"p",
			null,
			r.secrets.length ? `${plural(r.secrets.length, "secret")} must be supplied at deploy time. ` : "No secrets needed. ",
			r.secrets.length
				? h(
						"details",
						{ class: "tool-details" },
						h("summary", { text: "Show environment variables" }),
						h("ul", null, ...r.secrets.map((sec) => h("li", null, h("code", { text: sec.env }), ` for ${sec.source} (${sec.attribute})`))),
					)
				: null,
		),
	);

	$("summary").replaceChildren(cards, bar, legend, ...notes);
}

// ------------------------------------------------------------------ objects

function buildFilterControls(r) {
	const row = $("chips");
	chipButtons.clear();
	const all = h("button", {
		class: "tool-chip",
		type: "button",
		"aria-pressed": "true",
		text: `All (${r.stats.total || 0})`,
		onclick: () => {
			state.statuses.clear();
			syncChips();
			renderItems();
		},
	});
	chipButtons.set("all", all);
	const chips = [all];
	for (const k of STATUS_KEYS) {
		const b = h("button", {
			class: `tool-chip tool-chip--${k}`,
			type: "button",
			"aria-pressed": "false",
			text: `${STATUS[k]} (${r.stats[k] || 0})`,
			onclick: () => {
				if (state.statuses.has(k)) state.statuses.delete(k);
				else state.statuses.add(k);
				syncChips();
				renderItems();
			},
		});
		chipButtons.set(k, b);
		chips.push(b);
	}
	row.replaceChildren(...chips);
	syncChips();

	const kinds = Object.keys(r.stats.byKind || {}).sort();
	$("kind-filter").replaceChildren(
		h("option", { value: "" }, "All kinds"),
		...kinds.map((k) => h("option", { value: k }, `${k} (${r.stats.byKind[k].total})`)),
	);
	$("kind-filter").value = "";
}

function syncChips() {
	for (const [k, b] of chipButtons) {
		const on = k === "all" ? state.statuses.size === 0 : state.statuses.has(k);
		b.setAttribute("aria-pressed", String(on));
		b.classList.toggle("is-on", on);
	}
}

function matchesFilters(it) {
	if (state.statuses.size && !state.statuses.has(it.status)) return false;
	if (state.kind && it.kind !== state.kind) return false;
	const q = state.query.trim().toLowerCase();
	if (q) {
		const hay = [it.name, it.kind, ...(it.notes || [])].filter(Boolean).join("\n").toLowerCase();
		if (!hay.includes(q)) return false;
	}
	return true;
}

function renderItems() {
	const r = state.result;
	if (!r) return;
	const shown = r.items.filter(matchesFilters);
	$("items").replaceChildren(...shown.map((it) => renderItem(it, r)));
	$("no-match").hidden = shown.length > 0;
	$("filter-count").textContent = `Showing ${shown.length} of ${r.items.length} items.`;
}

function listRow(label, values, cls) {
	return [h("dt", { class: cls || "", text: label }), h("dd", null, h("ul", { class: "tool-items-list" }, ...values.map((v) => h("li", { text: String(v) }))))];
}

function renderItem(it, r) {
	const status = it.status;
	const outputs = (it.files || []).filter((p) => getFile(p, r));
	const rows = [h("dt", { text: "ISC target" }), h("dd", { class: "item-mono", text: it.isc || "None" })];
	rows.push(h("dt", { text: "IIQ type" }), h("dd", { class: "item-mono", text: it.iiqType || "None" }));
	if (it.notes && it.notes.length) rows.push(...listRow("Notes", it.notes));
	if (it.warnings && it.warnings.length) rows.push(...listRow("Warning", it.warnings, "is-warn"));
	if (it.blockers && it.blockers.length) rows.push(...listRow("Blocker", it.blockers, "is-blocker"));
	if (it.usedBy && it.usedBy.length) rows.push(h("dt", { text: "Used by" }), h("dd", { text: it.usedBy.join(", ") }));
	if (outputs.length) {
		rows.push(h("dt", { text: "Output files" }));
		rows.push(
			h(
				"dd",
				{ class: "tool-row" },
				...outputs.map((p) =>
					h("button", {
						class: "btn btn--ghost wb-btn tool-small item-mono",
						type: "button",
						text: p,
						onclick: () => openFile(p),
					}),
				),
			),
		);
	}

	return h(
		"details",
		{ class: "tool-item" },
		h(
			"summary",
			{ class: "tool-item-sum" },
			h("span", { class: `status status--${status}`, text: STATUS[status] || status }),
			h("span", { class: "tool-item-kind", text: it.kind }),
			h("span", { class: "tool-item-name", text: it.name }),
			h("span", { class: "tool-item-target", text: it.isc || "No ISC target" }),
		),
		h("dl", { class: "tool-item-body" }, ...rows),
	);
}

// ------------------------------------------------------------------ files (master-detail inside the Files sub-tab)

function getFile(path, r = state.result) {
	return r ? r.files.find((f) => f.path === path) : undefined;
}

function currentFile() {
	return getFile(state.selected);
}

function groupOf(path) {
	const i = path.indexOf("/");
	return i < 0 ? "" : path.slice(0, i);
}

function groupRank(g) {
	if (g === "") return -1;
	const i = FOLDER_ORDER.indexOf(g);
	return i < 0 ? FOLDER_ORDER.length : i;
}

function renderTree() {
	const r = state.result;
	const nav = $("tree");
	treeButtons.clear();
	if (!r) {
		nav.replaceChildren();
		return;
	}
	const groups = new Map();
	for (const f of r.files) {
		const g = groupOf(f.path);
		if (!groups.has(g)) groups.set(g, []);
		groups.get(g).push(f.path);
	}
	const keys = [...groups.keys()].sort((a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b));
	const blocks = keys.map((g) => {
		const paths = groups.get(g).sort((a, b) => a.localeCompare(b));
		const items = paths.map((p) => {
			const b = h("button", {
				class: "tool-file",
				type: "button",
				text: g ? p.slice(g.length + 1) : p,
				title: p,
				onclick: () => selectFile(p),
			});
			treeButtons.set(p, b);
			return h("li", null, b);
		});
		return h(
			"div",
			{ class: "tool-group" },
			h("p", { class: "tool-group-title", text: `${g || "Top level"} (${paths.length})` }),
			h("ul", { class: "tool-group-list" }, ...items),
		);
	});
	nav.replaceChildren(...blocks);
	syncTree();
}

function syncTree() {
	for (const [p, b] of treeButtons) {
		const on = p === state.selected;
		b.classList.toggle("is-selected", on);
		if (on) b.setAttribute("aria-current", "true");
		else b.removeAttribute("aria-current");
	}
}

function renderViewer() {
	const file = currentFile();
	$("viewer-path").textContent = file ? file.path : "No file selected";
	$("viewer").textContent = file ? file.content : "Pick a file from the list to view it here.";
	$("copy").disabled = !file;
	$("dl-one").disabled = !file;
	syncTree();
}

function selectFile(path) {
	state.selected = path;
	renderViewer();
}

// Used by the "Output files" buttons on each item: open the Files sub-tab on that file.
function openFile(path) {
	selectFile(path);
	selectSub("files", { focus: false });
	$("viewer").focus({ preventScroll: true });
}

async function copyCurrent() {
	const file = currentFile();
	const btn = $("copy");
	if (!file) return;
	try {
		await navigator.clipboard.writeText(file.content);
		btn.textContent = "Copied";
	} catch (e) {
		// Clipboard may be blocked. Select the text so the user can copy it manually.
		const pre = $("viewer");
		const range = document.createRange();
		range.selectNodeContents(pre);
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
		pre.focus();
		btn.textContent = "Press Ctrl+C";
	}
	setTimeout(() => {
		btn.textContent = "Copy";
	}, 1500);
}

function downloadFile(path, type) {
	const file = getFile(path);
	if (!file) return;
	download(basename(file.path), file.content, type);
}

function downloadAll() {
	const r = state.result;
	if (!r) return;
	try {
		// The file name is kept from the original tool.
		downloadZip("iiq-to-isc-output.zip", r.files);
	} catch (e) {
		showBanner(`Could not build the zip: ${errText(e)}`);
	}
}

// ------------------------------------------------------------------ sub-tabs (Summary | Objects | Files)

function selectSub(name, { focus = false } = {}) {
	state.sub = name;
	const tabs = [...document.querySelectorAll(".wb-subtab")];
	for (const t of tabs) {
		const on = t.dataset.sub === name;
		t.setAttribute("aria-selected", String(on));
		t.tabIndex = on ? 0 : -1;
		$(`mig-${t.dataset.sub}`).hidden = !on;
		if (on && focus) t.focus();
	}
}

// ------------------------------------------------------------------ wiring

export function initMigrate() {
	loadOptions();
	const picker = $("file-input");
	bindDropZone($("drop"), picker, (files) => addFiles(files));
	refreshFiles();
	showEmpty(true);

	$("options").addEventListener("input", saveOptions);
	$("paste-add").addEventListener("click", addPasted);
	$("sample").addEventListener("click", loadSample);
	$("mig-empty-sample").addEventListener("click", loadSample);
	$("clear").addEventListener("click", clearAll);
	$("convert").addEventListener("click", runConvert);

	$("kind-filter").addEventListener("change", (e) => {
		state.kind = e.target.value;
		renderItems();
	});
	$("search").addEventListener("input", (e) => {
		state.query = e.target.value;
		renderItems();
	});

	const subList = document.querySelector(".wb-subtabs");
	const subTabs = [...subList.querySelectorAll('[role="tab"]')];
	bindTablist(subList, subTabs, (t, opts) => selectSub(t.dataset.sub, { focus: opts.focus }), "horizontal");
	selectSub("summary");

	$("copy").addEventListener("click", copyCurrent);
	$("dl-one").addEventListener("click", () => downloadFile(state.selected, "text/plain;charset=utf-8"));
	$("dl-zip").addEventListener("click", downloadAll);
	$("dl-report").addEventListener("click", () => downloadFile("REPORT.md", "text/markdown;charset=utf-8"));
	$("dl-deploy").addEventListener("click", () => downloadFile("deploy.mjs", "text/javascript;charset=utf-8"));
}
