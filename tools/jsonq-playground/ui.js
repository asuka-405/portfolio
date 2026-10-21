// JSONPath and jq playground UI. Runs fully in the browser; the JSON never leaves the page.
import { h, $, setStatus, downloadText, storageGet, storageSet, plural, fmtSize, errText, bindDropZone, readTextFile } from "../shared/kit.js";
import { field, segmented, chips, bindHelp, debounce, emptyState, button } from "../shared/fx.js";
import { queryJsonPath, runJq, SAMPLE, JQ_FUNCTIONS } from "./jsonq.js";

const SHOW = 1000;
const MODE_KEY = "sk-jsonq-mode";
let mode = storageGet(MODE_KEY) === "jq" ? "jq" : "jsonpath";
let last = null; // {values: any[], text}

const jsonField = field({ label: "JSON", type: "textarea", rows: 8, mono: true, placeholder: "Paste JSON, or drop a file", hint: "" });
const queryField = field({ label: "Query", type: "textarea", rows: 3, mono: true, placeholder: "$.store.books[*].title" });
const modeSeg = segmented("jq-mode", [{ value: "jsonpath", label: "JSONPath" }, { value: "jq", label: "jq" }], mode, (v) => setMode(v));
const exampleBox = h("div", { class: "tool-field" });
const compact = field({ label: "Compact output (one result per line)", type: "checkbox", value: false, onInput: () => run() });
const dropZone = h("div", { class: "tool-drop", role: "button", tabindex: "0" }, h("span", { class: "tool-drop-title", text: "Drop a .json file here" }), h("span", { class: "tool-muted", text: "or press Enter to choose a file" }));
const picker = h("input", { type: "file", accept: ".json,application/json,text/plain", hidden: true });

function setMode(v) {
	mode = v;
	storageSet(MODE_KEY, v);
	queryField.input.placeholder = v === "jq" ? ".store.books[] | select(.price < 10) | .title" : "$.store.books[*].title";
	queryField.input.value = (SAMPLE[v][0] || {}).q || "";
	renderExamples();
	run();
}

function renderExamples() {
	exampleBox.replaceChildren(
		h("label", { text: "Examples" }),
		chips(SAMPLE[mode], (it) => {
			queryField.input.value = it.q;
			if (!jsonField.input.value.trim()) loadSample(false);
			run();
		}),
	);
}

function loadSample(runAfter = true) {
	jsonField.input.value = JSON.stringify(SAMPLE.data, null, 2);
	sizeHint();
	if (runAfter) run();
}

function sizeHint() {
	const v = jsonField.input.value;
	const hint = jsonField.el.querySelector(".tool-hint") || jsonField.el.appendChild(h("span", { class: "tool-hint" }));
	hint.textContent = v ? `${fmtSize(new TextEncoder().encode(v).length)} · ${plural(v.split("\n").length, "line")}` : "Empty";
}

function parseInput() {
	const text = jsonField.input.value;
	if (!text.trim()) return { empty: true };
	try {
		return { data: JSON.parse(text) };
	} catch (e) {
		return { error: `The JSON is not valid: ${e.message}` };
	}
}

const pretty = (v, c) => (c ? JSON.stringify(v) : JSON.stringify(v, null, 2));

function run() {
	const out = $("jq-out");
	const actions = $("jq-actions");
	actions.replaceChildren();
	last = null;
	const input = parseInput();
	const q = queryField.input.value.trim();
	if (input.empty) {
		out.replaceChildren(emptyState("Paste some JSON on the left, or load the sample.", button("Load sample", () => loadSample())));
		setStatus("");
		return;
	}
	if (input.error) {
		out.replaceChildren(h("div", { class: "tool-alert", role: "alert" }, h("p", { class: "tool-alert-title", text: "Cannot read the JSON" }), h("p", { text: input.error })));
		setStatus("Invalid JSON");
		return;
	}
	if (!q) {
		out.replaceChildren(emptyState("Type a query. The examples under the query box fill one in."));
		setStatus("");
		return;
	}
	let values;
	let paths = null;
	if (mode === "jsonpath") {
		const r = queryJsonPath(input.data, q);
		if (!r.ok) return showError(r.error);
		values = r.matches.map((m) => m.value);
		paths = r.matches.map((m) => m.path);
	} else {
		const r = runJq(q, input.data);
		if (!r.ok) return showError(r.error);
		values = r.results;
	}
	last = { values };
	const asc = compact.input.checked;
	const shown = values.slice(0, SHOW);
	const head = h(
		"p",
		{ class: "fx-count" },
		h("strong", { text: plural(values.length, mode === "jsonpath" ? "match" : "result") }),
		values.length > SHOW ? h("span", { class: "tool-muted", text: ` · showing the first ${SHOW}` }) : null,
	);
	if (!values.length) {
		out.replaceChildren(head, h("p", { class: "tool-muted", text: mode === "jsonpath" ? "Nothing matches. Check the path against the structure on the left, and remember names are case-sensitive." : "The program produced no output. empty, select(false) and a missing path all end here." }));
	} else if (paths) {
		out.replaceChildren(
			head,
			h("ol", { class: "jq-matches" }, shown.map((v, i) => h("li", { class: "jq-match" }, h("code", { class: "jq-path", text: paths[i] }), h("pre", { class: "fx-pre jq-val", tabindex: "0", text: pretty(v, asc) })))),
		);
	} else {
		out.replaceChildren(head, h("ol", { class: "jq-matches" }, shown.map((v, i) => h("li", { class: "jq-match" }, h("span", { class: "jq-idx", text: String(i + 1) }), h("pre", { class: "fx-pre jq-val", tabindex: "0", text: pretty(v, asc) })))));
	}
	actions.append(
		button("Copy", async (e) => {
			const b = e.currentTarget;
			try {
				await navigator.clipboard.writeText(toText());
				b.textContent = "Copied";
			} catch (err) {
				b.textContent = "Copy blocked";
			}
			setTimeout(() => (b.textContent = "Copy"), 1500);
		}),
		button("Download", () => downloadText("results.json", toText(), "application/json;charset=utf-8")),
	);
	setStatus(`${plural(values.length, mode === "jsonpath" ? "match" : "result")}`);
}

function toText() {
	if (!last) return "";
	return mode === "jq" && compact.input.checked ? last.values.map((v) => JSON.stringify(v)).join("\n") : JSON.stringify(last.values, null, 2);
}

function showError(msg) {
	$("jq-out").replaceChildren(h("div", { class: "tool-alert", role: "alert" }, h("p", { class: "tool-alert-title", text: mode === "jsonpath" ? "JSONPath error" : "jq error" }), h("p", { text: msg })));
	setStatus("Query error");
}

function init() {
	window.addEventListener("dragover", (e) => e.preventDefault());
	window.addEventListener("drop", (e) => e.preventDefault());
	const body = $("jq-in");
	body.append(
		h("div", { class: "tool-field" }, h("label", { text: "Language" }), modeSeg.el),
		jsonField.el,
		h("div", { class: "tool-row" }, dropZone, picker, button("Load sample", () => loadSample()), button("Clear", () => { jsonField.input.value = ""; sizeHint(); run(); })),
		queryField.el,
		exampleBox,
		compact.el,
	);
	bindDropZone(dropZone, picker, async (files) => {
		const f = files && files[0];
		if (!f) return;
		try {
			jsonField.input.value = await readTextFile(f);
			sizeHint();
			run();
			setStatus(`Loaded ${f.name}`);
		} catch (e) {
			setStatus(errText(e));
		}
	});
	$("jq-foot").hidden = false;
	$("jq-foot").append(h("button", { class: "btn btn--primary wb-btn", type: "button", text: "Run", onclick: () => run() }), h("p", { class: "tool-muted", text: "Runs as you type. Ctrl+Enter runs now." }));
	const slow = debounce(run, 250);
	jsonField.input.addEventListener("input", () => { sizeHint(); slow(); });
	queryField.input.addEventListener("input", slow);
	document.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			run();
		}
	});
	$("jq-fn-list").append(h("strong", { text: "Functions: " }), h("code", { text: JQ_FUNCTIONS.join(", ") }));
	$("jq-outtitle").textContent = "Results";
	bindHelp("jq");
	renderExamples();
	queryField.input.value = SAMPLE[mode][0].q;
	loadSample(false);
	sizeHint();
	run();
}

init();
