// Campaigns module: identity CSV in, size-limited campaign payloads and a run kit out.
// Nothing is sent to ISC from the browser. The kit creates campaigns but does not activate them.

import { splitCampaigns } from "./campaigns.js";
import { parseCsv } from "./csv.js";
import {
	$,
	h,
	plural,
	errText,
	parseJson,
	setInlineError,
	setStatus,
	downloadText,
	downloadZip,
	bindDropZone,
	readTextFile,
} from "./ui-common.js";
import { setBadge } from "./ui-tabs.js";

const ID_COLUMNS = ["id", "uid"];
const EXAMPLE_DEPARTMENTS = ["Finance", "Sales", "Engineering"];
const EXAMPLE_REGIONS = ["EMEA", "AMER", "APAC"];

let lastResult = null;
let pendingDefaultGroup = "";

// Deterministic example: 40 identities over three departments, with an items column.
function exampleCsv() {
	const rows = ["uid,department,region,items"];
	for (let i = 0; i < 40; i++) {
		const uid = `user${String(i + 1).padStart(2, "0")}`;
		const dept = EXAMPLE_DEPARTMENTS[i % 3];
		const region = EXAMPLE_REGIONS[(i * 7) % 3];
		const items = ((i * 7) % 13) + 1;
		rows.push(`${uid},${dept},${region},${items}`);
	}
	return rows.join("\n") + "\n";
}

function currentHeaders() {
	const text = $("cp-csv").value;
	if (!text.trim()) return [];
	try {
		return parseCsv(text).headers.filter(Boolean);
	} catch (e) {
		return [];
	}
}

// Rebuilds the Group by checkboxes and the Weight select from the CSV header row.
// Checked groups survive a refresh when their column still exists.
function refreshColumns() {
	const headers = currentHeaders();
	const checked = new Set([...$("cp-groups").querySelectorAll("input:checked")].map((i) => i.value));
	if (pendingDefaultGroup) {
		checked.add(pendingDefaultGroup);
		pendingDefaultGroup = "";
	}
	const weightPrev = $("cp-weight").value;
	const weightOpts = [h("option", { value: "", text: "None (1 per identity)" }), ...headers.map((c) => h("option", { value: c, text: c }))];
	$("cp-weight").replaceChildren(...weightOpts);
	$("cp-weight").value = headers.includes(weightPrev) ? weightPrev : "";

	const weight = $("cp-weight").value;
	const groupable = headers.filter((c) => !ID_COLUMNS.includes(c) && c !== weight);
	$("cp-groups").replaceChildren(
		...groupable.map((c, i) => {
			const id = `cp-group-${i}`;
			return h(
				"label",
				{ class: "tool-check" },
				h("input", { id, type: "checkbox", value: c, checked: checked.has(c) }),
				h("span", { text: c }),
			);
		}),
	);
	$("cp-groups-empty").hidden = headers.length > 0;
	$("cp-groups-empty").textContent = headers.length ? "" : "Load a CSV to choose columns.";
	if (headers.length && !groupable.length) {
		$("cp-groups").replaceChildren(h("p", { class: "tool-hint", text: "No columns left to group by." }));
	}
}

// Reads the options. Returns null after showing an inline error when one is invalid.
function readOptions() {
	const constraintsText = $("cp-constraints").value.trim();
	let accessConstraints;
	if (constraintsText) {
		const p = parseJson(constraintsText);
		if (!p.ok) {
			setInlineError($("cp-err-constraints"), `Not valid JSON: ${p.error}`);
			return null;
		}
		if (!Array.isArray(p.value)) {
			setInlineError($("cp-err-constraints"), "Access constraints must be a JSON array.");
			return null;
		}
		accessConstraints = p.value;
	}
	setInlineError($("cp-err-constraints"), "");

	let deadline;
	const dl = $("cp-deadline").value;
	if (dl) {
		try {
			deadline = new Date(dl).toISOString();
		} catch (e) {
			setStatus("The deadline is not a valid date and time.");
			return null;
		}
	}

	const groupBy = [...$("cp-groups").querySelectorAll("input:checked")].map((i) => i.value);
	const reviewerName = $("cp-reviewer-name").value.trim();
	return {
		groupBy,
		weightColumn: $("cp-weight").value || undefined,
		maxSize: Number($("cp-max").value) || 5000,
		namePrefix: $("cp-prefix").value.trim() || "Certification",
		description: $("cp-desc").value.trim() || undefined,
		deadline,
		searchType: $("cp-type").value === "ACCESS" ? "ACCESS" : "IDENTITY",
		accessConstraints,
		reviewer: reviewerName ? { type: $("cp-reviewer-type").value, name: reviewerName } : undefined,
	};
}

const stat = (label, value) =>
	h("div", { class: "tool-stat" }, h("span", { class: "tool-stat-label", text: label }), h("strong", { class: "tool-stat-num", text: String(value) }));

function renderProblems(problems) {
	const box = $("cp-problems");
	if (!problems.length) {
		box.replaceChildren(h("p", { class: "tool-muted", text: "No problems found." }));
		return;
	}
	box.replaceChildren(
		h(
			"ul",
			{ class: "tool-problems" },
			...problems.map((pr) => {
				const isWarn = pr.level === "warn";
				return h(
					"li",
					null,
					h("span", { class: `tool-tag ${isWarn ? "tool-tag--warn" : "tool-tag--error"}`, text: isWarn ? "Warning" : "Error" }),
					h("span", { class: "tool-muted", text: `Line ${pr.line}` }),
					h("span", { text: pr.message }),
				);
			}),
		),
	);
}

function renderResult(r, opts) {
	$("cp-empty").hidden = true;
	$("cp-results").hidden = false;
	renderProblems(r.problems);
	const table = $("cp-table");
	if (!r.ok) {
		$("cp-summary").replaceChildren(h("p", { text: "No campaigns were built. Fix the errors above and split again." }));
		table.replaceChildren();
		$("cp-kit").disabled = true;
		$("cp-plan").disabled = true;
		setBadge("campaigns", null);
		return;
	}
	const s = r.summary;
	const notes = [];
	if (!opts.deadline) notes.push("No deadline set: the plan holds a placeholder. Set one before you run the kit.");
	if (s.weighted) notes.push(`Weighted by ${opts.weightColumn}. The limit counts weight, not identities.`);
	$("cp-summary").replaceChildren(
		h(
			"div",
			{ class: "tool-stats" },
			stat("Identities", s.identities),
			stat("Groups", s.groups),
			stat("Campaigns", s.campaigns),
			stat("Largest", s.largest),
			stat("Over limit", s.overLimit),
		),
		...notes.map((n) => h("p", { class: "tool-muted", text: n })),
	);

	const th = (text, num) => h("th", { scope: "col", class: num ? "is-num" : "", text });
	table.replaceChildren(
		h("thead", null, h("tr", null, th("Campaign"), th("Group"), th("Identities", true), th("Weight", true), th("Limit"))),
		h(
			"tbody",
			null,
			...r.campaigns.map((c, i) => {
				const over = c.total > s.maxSize;
				return h(
					"tr",
					null,
					h("td", { text: r.payloads[i].name }),
					h("td", { text: c.group }),
					h("td", { class: "is-num", text: String(c.ids.length) }),
					h("td", { class: "is-num", text: String(c.total) }),
					h(
						"td",
						null,
						over ? h("span", { class: "tool-pill tool-pill--fail", text: "Over limit" }) : h("span", { class: "tool-pill tool-pill--neutral", text: "Within limit" }),
					),
				);
			}),
		),
	);
	$("cp-kit").disabled = false;
	$("cp-plan").disabled = false;
	setBadge("campaigns", r.campaigns.length);
}

function split() {
	const text = $("cp-csv").value;
	if (!text.trim()) {
		$("cp-msg").textContent = "Load or paste an identity CSV first.";
		return;
	}
	const opts = readOptions();
	if (!opts) return;
	let r;
	try {
		r = splitCampaigns(text, opts);
	} catch (e) {
		$("cp-msg").textContent = `Could not split: ${errText(e)}`;
		return;
	}
	lastResult = { r, opts };
	renderResult(r, opts);
	if (r.ok) setStatus(`Split into ${plural(r.campaigns.length, "campaign")}.`);
	else setStatus("Split failed. See the problems list.");
}

async function loadFile(fileList) {
	const file = fileList && fileList[0];
	if (!file) return;
	try {
		$("cp-csv").value = await readTextFile(file);
		$("cp-msg").textContent = `Loaded ${file.name}.`;
		refreshColumns();
	} catch (e) {
		$("cp-msg").textContent = errText(e);
	}
}

function loadExample() {
	$("cp-csv").value = exampleCsv();
	$("cp-msg").textContent = "Loaded the example: 40 identities over 3 departments.";
	pendingDefaultGroup = "department";
	refreshColumns();
}

export function initCampaigns() {
	bindDropZone($("cp-drop"), $("cp-file"), loadFile);
	$("cp-example").addEventListener("click", loadExample);
	$("cp-empty-example").addEventListener("click", () => {
		loadExample();
		split();
	});
	$("cp-csv").addEventListener("change", refreshColumns);
	$("cp-weight").addEventListener("change", refreshColumns);
	$("cp-constraints").addEventListener("input", () => {
		const t = $("cp-constraints").value.trim();
		const p = t ? parseJson(t) : { ok: true, value: [] };
		setInlineError($("cp-err-constraints"), !p.ok ? `Not valid JSON: ${p.error}` : Array.isArray(p.value) ? "" : "Access constraints must be a JSON array.");
	});
	$("cp-split").addEventListener("click", split);
	$("cp-kit").addEventListener("click", () => {
		if (!lastResult || !lastResult.r.ok) return;
		downloadZip("campaigns-kit.zip", lastResult.r.files);
		setStatus("Downloaded campaigns-kit.zip.");
	});
	$("cp-plan").addEventListener("click", () => {
		if (!lastResult || !lastResult.r.ok) return;
		const plan = lastResult.r.files.find((f) => f.path === "campaigns/plan.json");
		if (!plan) return;
		downloadText("plan.json", plan.content, "application/json;charset=utf-8");
		setStatus("Downloaded plan.json.");
	});
}
