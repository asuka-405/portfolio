// SailPoint rule and transform templates UI. Runs fully in the browser.
import { h, $, setStatus, downloadZip, storageGet, storageSet, bindDropZone, readTextFile, errText } from "../shared/kit.js";
import { field, segmented, chips, codeBlock, findings, countPills, section, bindHelp, debounce, button, kvTable, emptyState } from "../shared/fx.js";
import { TEMPLATES, GROUPS, RULE_NAMES, defaultValues, renderTemplate, checkRule, SAMPLE_CHECK } from "./rules.js";

const MODE_KEY = "sk-rules-mode";
let mode = storageGet(MODE_KEY) === "check" ? "check" : "templates";
let group = "All";
let selected = TEMPLATES[0].id;
let values = defaultValues(TEMPLATES[0]);
let ruleName = "";
const refresh = debounce(() => render(), 120);

const RUNS = {
	"Cloud rules": "SailPoint cloud, read-only, reviewed by SailPoint before deployment",
	"Connector rules": "Virtual appliance (connector executed), no data model access",
	Transforms: "SailPoint cloud, as JSON",
};

const search = field({ label: "Search templates", placeholder: "lifecycle, correlation, JDBC...", onInput: () => { drawList(); } });
const listBox = h("div", { class: "rt-list", role: "listbox", "aria-label": "Templates" });
const groupBox = h("div", { class: "tool-field" });
const paramBox = h("div", { class: "tool-form" });

const current = () => TEMPLATES.find((t) => t.id === selected) || TEMPLATES[0];

function drawGroups() {
	groupBox.replaceChildren(h("label", { text: "Kind" }), chips(["All", ...GROUPS].map((g) => ({ label: g, g })), (it) => { group = it.g; drawGroups(); drawList(); }, { label: "Kind" }));
	for (const b of groupBox.querySelectorAll(".fx-chip")) b.classList.toggle("is-on", b.textContent === group);
}

function drawList() {
	const q = search.input.value.trim().toLowerCase();
	const items = TEMPLATES.filter((t) => (group === "All" || t.group === group) && (!q || `${t.title} ${t.type} ${t.summary}`.toLowerCase().includes(q)));
	listBox.replaceChildren(
		...(items.length
			? items.map((t) => {
					const b = h("button", { class: "rt-item", type: "button", role: "option", "aria-selected": t.id === selected ? "true" : "false" }, h("span", { class: "rt-title", text: t.title }), h("span", { class: "rt-type", text: t.type }));
					b.addEventListener("click", () => select(t.id));
					return b;
			  })
			: [h("p", { class: "tool-muted rt-none", text: "No template matches." })]),
	);
}

function select(id) {
	selected = id;
	values = defaultValues(current());
	ruleName = "";
	drawList();
	drawParams();
	render();
}

function drawParams() {
	const t = current();
	paramBox.replaceChildren();
	if (t.reference) {
		paramBox.append(h("p", { class: "tool-hint", text: "This is a reference card. There is nothing to generate." }));
		return;
	}
	if (t.group !== "Transforms") {
		const rn = field({ label: "Rule name", value: RULE_NAMES[t.id] || t.title, hint: "Used in the XML and in the file name.", onInput: () => { ruleName = rn.input.value; refresh(); } });
		paramBox.append(rn.el);
	}
	for (const p of t.params) {
		const f = field({ label: p.label, value: values[p.key], mono: p.kind !== "string", hint: p.hint, onInput: () => { values[p.key] = f.input.value; refresh(); } });
		f.input.dataset.key = p.key;
		paramBox.append(f.el);
	}
}

function deployHint(t, files) {
	if (t.group === "Transforms") return `curl -X POST "$ISC_URL/v3/transforms" \\\n  -H "Authorization: Bearer $ISC_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d @${files[0].name}`;
	if (t.group === "Connector rules") return `# create the rule, then attach it to the source (see the connector rules documentation)\ncurl -X POST "$ISC_URL/beta/connector-rules" \\\n  -H "Authorization: Bearer $ISC_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d @${files[1].name}`;
	return "# Cloud rules are submitted to SailPoint for review (support portal), with the rule file and validator output.\n# Approved rules can then be promoted from sandbox to production with the sp-config API.";
}

function renderTemplateOut() {
	const t = current();
	const out = [];
	const r = renderTemplate(t, values, { ruleName: ruleName || undefined });
	out.push(
		h("div", { class: "rt-head" }, h("h2", { class: "rt-h", text: t.title }), h("p", { class: "rt-meta" }, h("code", { text: t.type }), h("span", { class: "fx-pill fx-pill--info", text: t.group }))),
		h("p", { class: "rt-summary", text: t.summary }),
		h("p", { class: "tool-hint", text: `Runs in: ${RUNS[t.group]}` }),
	);
	const actions = $("rt-actions");
	actions.replaceChildren();
	if (!r.ok) {
		out.push(section("Fix these first", findings(r.problems.map((p) => ({ level: "error", message: p.message })))));
	} else {
		for (const f of r.files) out.push(codeBlock({ title: f.name, text: f.text, filename: f.name, mime: f.language === "json" ? "application/json;charset=utf-8" : f.language === "xml" ? "application/xml;charset=utf-8" : "text/plain;charset=utf-8" }));
		if (r.files.length > 1) actions.append(button("Download all (.zip)", () => downloadZip(`${t.id}.zip`, r.files.map((f) => ({ path: f.name, content: f.text }))), { small: false }));
		if (r.warnings.length) out.push(findings(r.warnings.map((m) => ({ level: "info", message: m }))));
		if (r.files.length) out.push(section("Deploy", codeBlock({ title: "How it gets to ISC", text: deployHint(t, r.files), wrap: true })));
	}
	if (t.inputs && t.inputs.length) out.push(section("Inputs the rule receives", kvTable(t.inputs.map((i) => [i[0], i[1], i[2] || ""]), { head: ["Name", "Type", "Purpose"] })));
	if (t.output) out.push(section("Returns", kvTable([[t.output[0], t.output[1], t.output[2]]], { head: ["Name", "Type", "Purpose"] })));
	else if (t.group !== "Transforms") out.push(section("Returns", h("p", { class: "tool-muted", text: "Nothing: the rule changes its input in place." })));
	if (t.notes && t.notes.length) out.push(section("Notes", h("ul", { class: "fx-list" }, t.notes.map((n) => h("li", { text: n })))));
	$("rt-out").replaceChildren(...out);
	$("rt-outtitle").textContent = "Template";
	$("rt-outnote").textContent = "";
	setStatus(r.ok ? `${t.title}` : "Fix the parameters");
}

// ------------------------------------------------------------------ checker

const checkText = field({ label: "Rule to check (XML or script)", type: "textarea", rows: 16, mono: true, placeholder: "Paste a rule", onInput: () => refresh() });
const cloudToggle = field({ label: "Cloud rule: also apply the blocked-code checks", type: "checkbox", value: true, onInput: () => render() });
const dropZone = h("div", { class: "tool-drop", role: "button", tabindex: "0" }, h("span", { class: "tool-drop-title", text: "Drop a rule file here" }), h("span", { class: "tool-muted", text: "or press Enter to choose one" }));
const picker = h("input", { type: "file", hidden: true });

function renderCheck() {
	const src = checkText.input.value;
	const items = checkRule(src, { cloud: cloudToggle.input.checked });
	$("rt-actions").replaceChildren();
	$("rt-outtitle").textContent = "Rule check";
	$("rt-outnote").textContent = "";
	if (!src.trim()) {
		$("rt-out").replaceChildren(emptyState("Paste a rule on the left, or load a sample with problems in it.", button("Load a faulty rule", () => { checkText.input.value = SAMPLE_CHECK; render(); })));
		setStatus("");
		return;
	}
	$("rt-out").replaceChildren(
		section("Findings", countPills(items), findings(items, { empty: "Nothing flagged. SailPoint's review still applies." })),
		h("p", { class: "tool-hint", text: "A pattern check, not a compiler or SailPoint's review. It looks for the blocked fragments named in SailPoint's rule guidelines and for common review rejections." }),
	);
	setStatus(`${items.filter((i) => i.level === "error").length} error(s)`);
}

// ------------------------------------------------------------------ shell

function render() {
	if (mode === "templates") renderTemplateOut();
	else renderCheck();
}

function setMode(m) {
	mode = m;
	storageSet(MODE_KEY, m);
	const body = $("rt-in");
	body.replaceChildren(h("div", { class: "tool-field" }, h("label", { text: "What to do" }), seg.el));
	if (m === "templates") {
		body.append(search.el, groupBox, listBox, h("p", { class: "tool-subhead", text: "Parameters" }), paramBox);
		drawGroups();
		drawList();
		drawParams();
	} else {
		body.append(checkText.el, cloudToggle.el, h("div", { class: "tool-row" }, dropZone, picker, button("Load a faulty rule", () => { checkText.input.value = SAMPLE_CHECK; render(); }), button("Clear", () => { checkText.input.value = ""; render(); })));
	}
	render();
}

const seg = segmented("rt-mode", [{ value: "templates", label: "Templates" }, { value: "check", label: "Rule checker" }], mode, setMode);

bindHelp("rt");
bindDropZone(dropZone, picker, async (files) => {
	const f = files && files[0];
	if (!f) return;
	try {
		checkText.input.value = await readTextFile(f);
		render();
	} catch (e) {
		setStatus(errText(e));
	}
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
setMode(mode);
