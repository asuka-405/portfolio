// Transform lab: runs a transform through the offline simulator and checks test cases.
// Every value from JSON inputs is shown through textContent, never as markup.

import { simulate, runCases, collectWarnings, SIMULATED, NOT_SIMULATED } from "./transform-sim.js";
import {
	$,
	h,
	plural,
	parseJson,
	isPlainObject,
	setInlineError,
	setStatus,
	storageGet,
	storageSet,
	copyButton,
	lastMigration,
} from "./ui-common.js";
import { setBadge } from "./ui-tabs.js";

const STORE_KEY = "sailpoint-workbench:transforms";

// lower(concat(first letter of firstname, lastname)): "Priya Shah" gives "pshah".
const EXAMPLE_TRANSFORM = `{
  "type": "lower",
  "attributes": {
    "input": {
      "type": "concat",
      "attributes": {
        "values": [
          {
            "type": "substring",
            "attributes": {
              "input": { "type": "identityAttribute", "attributes": { "name": "firstname" } },
              "begin": 0,
              "end": 1
            }
          },
          { "type": "identityAttribute", "attributes": { "name": "lastname" } }
        ]
      }
    }
  }
}`;
const EXAMPLE_IDENTITY = `{"firstname":"Priya","lastname":"Shah"}`;
const EXAMPLE_ACCOUNTS = `{}`;

const short = (v) => {
	const s = v === undefined ? "undefined" : JSON.stringify(v) ?? String(v);
	return s.length > 120 ? s.slice(0, 119) + "…" : s;
};

const pretty = (v) => (v === undefined ? "undefined" : JSON.stringify(v, null, 2) ?? String(v));

let lastOutput = "";

// ------------------------------------------------------------------ input validation

// Returns {ok, value}. Shows the inline error for that field when invalid.
function check(taId, errId, { required = false, object = false, label }) {
	const text = $(taId).value.trim();
	const fail = (msg) => {
		setInlineError($(errId), msg);
		return { ok: false };
	};
	if (!text) {
		if (required) return fail(`${label} is required.`);
		setInlineError($(errId), "");
		return { ok: true, value: undefined };
	}
	const p = parseJson(text);
	if (!p.ok) return fail(`Not valid JSON: ${p.error}`);
	if (object && !isPlainObject(p.value)) return fail(`${label} must be a JSON object.`);
	setInlineError($(errId), "");
	return { ok: true, value: p.value };
}

// Reads all four JSON inputs. Returns null when any is invalid, after showing every inline error.
function readInputs() {
	const t = check("tx-transform", "tx-err-transform", { required: true, object: true, label: "Transform JSON" });
	const id = check("tx-identity", "tx-err-identity", { object: true, label: "Sample identity" });
	const ac = check("tx-accounts", "tx-err-accounts", { object: true, label: "Sample accounts" });
	const lib = check("tx-library", "tx-err-library", { object: true, label: "Library" });
	if (t.ok && typeof t.value.type !== "string") {
		setInlineError($("tx-err-transform"), 'Transform JSON needs a "type" string, for example {"type": "lower", "attributes": {...}}.');
		t.ok = false;
	}
	if (!(t.ok && id.ok && ac.ok && lib.ok)) return null;
	return { transform: t.value, identity: id.value || {}, accounts: ac.value || {}, library: lib.value };
}

// ------------------------------------------------------------------ single run

function traceItem(n) {
	const head = [h("span", { class: "tool-trace-type", text: n.type }), " output ", h("code", { text: short(n.output) })];
	const warns = (n.warnings || []).map((w) => h("li", { class: "tool-muted", text: `Warning: ${w}` }));
	const kids = (n.children || []).map(traceItem);
	if (!kids.length && !warns.length) return h("li", null, ...head);
	return h(
		"li",
		null,
		h(
			"details",
			{ open: true },
			h("summary", null, ...head),
			warns.length ? h("ul", { class: "tool-trace-warns" }, ...warns) : null,
			kids.length ? h("ul", { class: "tool-trace-kids" }, ...kids) : null,
		),
	);
}

function renderWarnings(list) {
	const box = $("tx-warnings");
	if (!list.length) {
		box.replaceChildren(h("p", { text: "No warnings." }));
		return;
	}
	box.replaceChildren(h("ul", { class: "tool-items-list" }, ...list.map((w) => h("li", { text: `Warning: ${w}` }))));
}

function renderRun(r) {
	setInlineError($("tx-error"), r.ok ? "" : `Simulation failed: ${r.error}`);
	lastOutput = r.ok ? pretty(r.output) : "";
	$("tx-output").textContent = r.ok ? lastOutput : "No output, because the simulation failed. See the message above.";
	$("tx-trace").replaceChildren(
		r.trace ? h("ul", { class: "tool-trace", "aria-label": "Trace" }, traceItem(r.trace)) : h("p", { class: "tool-muted", text: "No trace for this run." }),
	);
	renderWarnings(collectWarnings(r.trace));
}

function runSingle() {
	const inp = readInputs();
	if (!inp) {
		$("tx-status").textContent = "Fix the highlighted input first.";
		return;
	}
	const r = simulate(inp.transform, { identity: inp.identity, accounts: inp.accounts, library: inp.library });
	renderRun(r);
	const warns = collectWarnings(r.trace).length;
	const msg = r.ok ? `Ran. ${plural(warns, "warning")}.` : "Simulation failed.";
	$("tx-status").textContent = msg;
	setStatus(msg);
}

// ------------------------------------------------------------------ test cases

function caseInput(label, value) {
	return h("input", { class: "tool-input tool-input--cell", type: "text", "aria-label": label, value: value || "", spellcheck: "false" });
}

function addCaseRow(c = {}) {
	const tr = h(
		"tr",
		null,
		h("td", null, caseInput("Case name", c.name)),
		h("td", null, caseInput("Identity JSON for this case", c.identity)),
		h("td", null, caseInput("Accounts JSON for this case", c.accounts)),
		h("td", null, caseInput("Expected output", c.expected)),
		h("td", { class: "tool-result" }, h("span", { class: "tool-muted", text: "Not run" })),
		h("td", null, h("button", { class: "btn btn--ghost wb-btn tool-small", type: "button", text: "Remove", onclick: () => tr.remove() })),
	);
	$("tx-cases-body").append(tr);
	return tr;
}

function parseRowJson(text, label) {
	const t = text.trim();
	if (!t) return { ok: true, value: undefined };
	const p = parseJson(t);
	if (!p.ok) return { ok: false, error: `${label} is not valid JSON: ${p.error}` };
	if (!isPlainObject(p.value)) return { ok: false, error: `${label} must be a JSON object.` };
	return { ok: true, value: p.value };
}

// Runs one table row. Blank identity or accounts cells fall back to the global sample.
function runRow(tr, inp) {
	const [nameI, idI, accI, expI] = tr.querySelectorAll("input");
	const hasExpected = expI.value.trim() !== "";
	const id = parseRowJson(idI.value, "Identity JSON");
	const ac = parseRowJson(accI.value, "Accounts JSON");
	let res;
	if (!id.ok || !ac.ok) {
		res = { ok: false, error: !id.ok ? id.error : ac.error, output: null, pass: false, warnings: [] };
	} else {
		[res] = runCases(
			inp.transform,
			[{ name: nameI.value, identity: id.value || inp.identity, accounts: ac.value || inp.accounts, expected: hasExpected ? expI.value : undefined }],
			inp.library,
		);
	}
	paintResult(tr.querySelector(".tool-result"), res, hasExpected);
	return { res, hasExpected };
}

function paintResult(cell, res, hasExpected) {
	let status;
	let cls;
	let detail;
	if (!res.ok) {
		status = "ERROR";
		cls = "error";
		detail = res.error;
	} else if (!hasExpected) {
		status = "RAN";
		cls = "neutral";
		detail = `Output ${short(res.output)}`;
	} else if (res.pass) {
		status = "PASS";
		cls = "pass";
		detail = `Output ${short(res.output)}`;
	} else {
		status = "FAIL";
		cls = "fail";
		detail = `Expected "${res.expected}", got ${short(res.output)}`;
	}
	cell.replaceChildren(h("span", { class: `tool-pill tool-pill--${cls}`, text: status }), h("span", { class: "tool-result-detail", text: detail }));
}

function runAll() {
	const inp = readInputs();
	if (!inp) {
		$("tx-cases-status").textContent = "Fix the highlighted input first.";
		return;
	}
	const rows = [...$("tx-cases-body").querySelectorAll("tr")];
	if (!rows.length) {
		$("tx-cases-status").textContent = "Add a case first.";
		return;
	}
	let pass = 0;
	let counted = 0;
	let errors = 0;
	for (const tr of rows) {
		const { res, hasExpected } = runRow(tr, inp);
		if (!res.ok) errors++;
		else if (hasExpected) {
			counted++;
			if (res.pass) pass++;
		}
	}
	const msg = `${plural(rows.length, "case")}: ${pass} pass, ${counted - pass} fail, ${errors} error.`;
	$("tx-cases-status").textContent = msg;
	setBadge("transforms", counted ? `${pass}/${counted}` : null);
	setStatus(`Test cases: ${msg}`);
}

// ------------------------------------------------------------------ select, persistence, types

function refreshSelect() {
	const sel = $("tx-select");
	const m = lastMigration;
	const opts = [h("option", { value: "", text: m ? "Choose a transform" : "Run Migrate first" })];
	let count = 0;
	if (m) {
		for (const f of m.result.files) {
			if (!f.path.startsWith("transforms/") || !f.path.endsWith(".json")) continue;
			try {
				JSON.parse(f.content);
			} catch (e) {
				continue;
			}
			opts.push(h("option", { value: f.path, text: f.path.slice("transforms/".length) }));
			count++;
		}
	}
	sel.replaceChildren(...opts);
	$("tx-select-hint").textContent = m
		? count
			? `${plural(count, "transform")} from the last migration.`
			: "The last migration has no transforms."
		: "Convert an export on Migrate to list its transforms.";
}

function onSelect() {
	const path = $("tx-select").value;
	const f = path && lastMigration && lastMigration.result.files.find((x) => x.path === path);
	if (!f) return;
	$("tx-transform").value = JSON.stringify(JSON.parse(f.content), null, 2);
	setInlineError($("tx-err-transform"), "");
	saveInputs();
	setStatus(`Loaded ${path} into the Transform JSON box.`);
}

function saveInputs() {
	storageSet(
		STORE_KEY,
		JSON.stringify({ transform: $("tx-transform").value, identity: $("tx-identity").value, accounts: $("tx-accounts").value }),
	);
}

function loadInputs() {
	$("tx-transform").value = EXAMPLE_TRANSFORM;
	$("tx-identity").value = EXAMPLE_IDENTITY;
	$("tx-accounts").value = EXAMPLE_ACCOUNTS;
	const raw = storageGet(STORE_KEY);
	if (!raw) return;
	try {
		const s = JSON.parse(raw);
		for (const [k, id] of [
			["transform", "tx-transform"],
			["identity", "tx-identity"],
			["accounts", "tx-accounts"],
		]) {
			if (typeof s[k] === "string") $(id).value = s[k];
		}
	} catch (e) {
		// Ignore unreadable saved inputs.
	}
}

function renderTypes() {
	const list = (items) => h("ul", { class: "tool-chiplist" }, ...items.map((t) => h("li", null, h("code", { text: t }))));
	$("tx-types").replaceChildren(
		h("p", null, h("strong", { text: "Simulated" })),
		list(SIMULATED),
		h("p", null, h("strong", { text: "Not simulated (reported, not guessed)" })),
		list(NOT_SIMULATED),
	);
}

// ------------------------------------------------------------------ public

// Called when the module is shown: refreshes the migration-driven select.
export function renderTransforms() {
	refreshSelect();
}

export function initTransforms() {
	loadInputs();
	renderTypes();
	refreshSelect();
	addCaseRow({ name: "Priya Shah", expected: "pshah" });
	$("tx-copy-slot").replaceChildren(copyButton(() => lastOutput, "Copy output"));

	$("tx-run").addEventListener("click", runSingle);
	$("tx-run-all").addEventListener("click", runAll);
	$("tx-add").addEventListener("click", () => {
		const tr = addCaseRow();
		tr.querySelector("input").focus();
	});
	$("tx-select").addEventListener("change", onSelect);

	for (const id of ["tx-transform", "tx-identity", "tx-accounts"]) {
		$(id).addEventListener("input", saveInputs);
	}
}
