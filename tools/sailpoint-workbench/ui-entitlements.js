// Entitlements module: CSV in, validated plan and run kit out. Nothing is sent to ISC from the browser.

import { planEntitlements, COLUMNS, TEMPLATE_CSV } from "./entitlements.js";
import {
	$,
	h,
	plural,
	basename,
	errText,
	fmtSize,
	setInlineError,
	setStatus,
	downloadText,
	downloadZip,
	bindDropZone,
	readTextFile,
} from "./ui-common.js";
import { setBadge } from "./ui-tabs.js";

const COLUMN_HELP = {
	source: "Source name. Needed to find the entitlement unless entitlementId is set.",
	entitlement: "Entitlement value, for example a group DN or a role name.",
	attribute: "Attribute that holds the value, for example memberOf. Narrows the lookup.",
	entitlementId: "ISC entitlement id. Skips the lookup when set.",
	owner: "Owner identity. Looked up in ISC by the key chosen in the input pane.",
	description: "New description text.",
	requestable: "true or false (also yes/no, 1/0). Blank leaves it alone.",
	privileged: "true or false (also yes/no, 1/0). Blank leaves it alone.",
};

const EXAMPLE_CSV = TEMPLATE_CSV;

let plan = null;

const stat = (label, value) =>
	h("div", { class: "tool-stat" }, h("span", { class: "tool-stat-label", text: label }), h("strong", { class: "tool-stat-num", text: String(value) }));

function renderSummary(p) {
	const s = p.summary;
	const errors = p.errors;
	$("en-summary").replaceChildren(
		h(
			"div",
			{ class: "tool-stats tool-stats--four" },
			stat("Rows", s.rows),
			stat("Valid", s.valid),
			stat("Owners to set", s.owners),
			stat("Descriptions to set", s.descriptions),
		),
		h("p", { class: "tool-muted", text: `${plural(errors, "error")} and ${p.problems.length - errors} warning${p.problems.length - errors === 1 ? "" : "s"}. Rows with an error are left out of the plan.` }),
	);
}

function renderProblems(p) {
	const box = $("en-problems");
	if (!p.problems.length) {
		box.replaceChildren(h("p", { class: "tool-muted", text: "No problems found." }));
		return;
	}
	box.replaceChildren(
		h(
			"ul",
			{ class: "tool-problems" },
			...p.problems.map((pr) => {
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

function renderPreview(p) {
	const table = $("en-preview");
	if (!p.plan.length) {
		table.replaceChildren(h("tbody", null, h("tr", null, h("td", { text: "No valid rows to plan." }))));
		return;
	}
	const th = (text) => h("th", { scope: "col", text });
	table.replaceChildren(
		h("thead", null, h("tr", null, th("Line"), th("Source"), th("Entitlement"), th("Operations"))),
		h(
			"tbody",
			null,
			...p.plan.map((row) =>
				h(
					"tr",
					null,
					h("td", { text: String(row.line) }),
					h("td", { text: row.source || "(by id)" }),
					h("td", { class: "tool-mono-cell", text: row.entitlement || row.entitlementId }),
					h(
						"td",
						null,
						h(
							"ul",
							{ class: "tool-ops" },
							...row.ops.map((o) => h("li", { class: "tool-mono-cell", text: `${o.op} ${o.path}` })),
						),
					),
				),
			),
		),
	);
}

function renderFiles(p) {
	const list = $("en-files");
	list.replaceChildren(
		...p.files.map((f) =>
			h(
				"li",
				{ class: "tool-filerow" },
				h("span", { class: "tool-name", text: f.path }),
				h("span", { class: "tool-muted", text: fmtSize(f.content.length) }),
				h("button", {
					class: "btn btn--ghost wb-btn tool-small",
					type: "button",
					"aria-label": `Download ${basename(f.path)}`,
					text: "Download",
					onclick: () => downloadText(basename(f.path), f.content, "text/plain;charset=utf-8"),
				}),
			),
		),
	);
}

function showResults(on) {
	$("en-empty").hidden = on;
	$("en-results").hidden = !on;
}

function build() {
	const text = $("en-csv").value;
	if (!text.trim()) {
		setInlineError($("en-input-error"), "Paste a CSV, drop a file, or load the example first.");
		return;
	}
	setInlineError($("en-input-error"), "");
	let p;
	try {
		p = planEntitlements(text, { ownerKey: $("en-owner-key").value });
	} catch (e) {
		setInlineError($("en-input-error"), `Could not read the CSV: ${errText(e)}`);
		return;
	}
	plan = p;
	showResults(true);
	renderSummary(p);
	renderProblems(p);
	renderPreview(p);
	renderFiles(p);
	$("en-kit").disabled = p.summary.valid === 0;
	setBadge("entitlements", p.summary.valid);
	setStatus(`Plan: ${plural(p.summary.valid, "valid row")}, ${plural(p.errors, "error")}.`);
}

async function loadFile(fileList) {
	const file = fileList && fileList[0];
	if (!file) return;
	try {
		$("en-csv").value = await readTextFile(file);
		$("en-msg").textContent = `Loaded ${file.name}. Press Build plan.`;
	} catch (e) {
		$("en-msg").textContent = errText(e);
	}
}

function loadExample() {
	$("en-csv").value = EXAMPLE_CSV;
	$("en-msg").textContent = "Loaded the example. Press Build plan.";
	setInlineError($("en-input-error"), "");
}

export function initEntitlements() {
	$("en-columns").replaceChildren(
		...COLUMNS.flatMap((c) => [h("dt", { text: c }), h("dd", { text: COLUMN_HELP[c] || "" })]),
	);
	bindDropZone($("en-drop"), $("en-file"), loadFile);
	$("en-example").addEventListener("click", loadExample);
	$("en-empty-example").addEventListener("click", () => {
		loadExample();
		build();
	});
	$("en-template").addEventListener("click", () => {
		downloadText("entitlements-template.csv", TEMPLATE_CSV, "text/csv;charset=utf-8");
		setStatus("Downloaded entitlements-template.csv.");
	});
	$("en-build").addEventListener("click", build);
	$("en-kit").addEventListener("click", () => {
		if (!plan) return;
		downloadZip("entitlements-kit.zip", plan.files);
		setStatus("Downloaded entitlements-kit.zip.");
	});
}
