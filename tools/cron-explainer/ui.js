// Browser UI for the Quartz and cron explainer. The engine is ./cron.js; shared helpers come from ../shared/kit.js.
// Expression text and engine output go through textContent only. Nothing is parsed as HTML.

import { explain, EXAMPLES } from "./cron.js";
import { $, h, setStatus, copyButton, storageGet, storageSet } from "../shared/kit.js";

const STORE_KEY = "cron-explainer:state";
const DEBOUNCE_MS = 150;
const REL_REFRESH_MS = 30000;

const FIELD_NAMES = ["second", "minute", "hour", "dom", "month", "dow", "year"];
const FIELD_LABELS = {
	second: "Second",
	minute: "Minute",
	hour: "Hour",
	dom: "Day of month",
	month: "Month",
	dow: "Day of week",
	year: "Year",
};
const FLAVOR_LABELS = { unix: "Unix 5-field", quartz: "Quartz 6/7-field" };
const FLAVORS = ["auto", "unix", "quartz"];
const COUNTS = ["5", "10", "20"];
const DEFAULTS = { expr: EXAMPLES[0].expr, flavor: "auto", zone: "UTC", count: "10" };

// Common IANA zones. The browser's own zone is added in front of them when it is not already listed.
const COMMON_ZONES = [
	"Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago",
	"America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Asia/Dubai", "Asia/Kolkata",
	"Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];

const browserZone = (() => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
	} catch (e) {
		return "";
	}
})();

function zoneOptions() {
	const list = [{ value: "UTC", label: "UTC" }];
	if (browserZone && browserZone !== "UTC") list.push({ value: browserZone, label: `Browser (${browserZone})` });
	for (const z of COMMON_ZONES) {
		if (z !== browserZone) list.push({ value: z, label: z });
	}
	return list;
}

// ------------------------------------------------------------------ small helpers

function selectedFlavor() {
	const checked = document.querySelector('input[name="flavor"]:checked');
	return checked ? checked.value : "auto";
}

function setFlavor(value) {
	const radio = document.querySelector(`input[name="flavor"][value="${value}"]`);
	if (radio) radio.checked = true;
}

function zoneName() {
	const opt = $("zone").selectedOptions[0];
	return opt ? opt.textContent : $("zone").value;
}

// "in 3 h 12 min" or "5 min ago", computed from the run time and the current time.
function relative(ms, now) {
	const diff = ms - now;
	if (Math.abs(diff) < 1000) return "now";
	const secs = Math.round(Math.abs(diff) / 1000);
	let text;
	if (secs < 60) {
		text = `${secs} s`;
	} else {
		const mins = Math.floor(secs / 60);
		if (mins < 60) {
			text = `${mins} min`;
		} else {
			const hours = Math.floor(mins / 60);
			const restMin = mins % 60;
			if (hours < 24) {
				text = restMin ? `${hours} h ${restMin} min` : `${hours} h`;
			} else {
				const days = Math.floor(hours / 24);
				const restHours = hours % 24;
				text = restHours ? `${days} d ${restHours} h` : `${days} d`;
			}
		}
	}
	return diff < 0 ? `${text} ago` : `in ${text}`;
}

function refreshRelative() {
	const now = Date.now();
	for (const el of document.querySelectorAll(".cron-rel")) {
		el.textContent = relative(Number(el.dataset.ms), now);
	}
}

// ------------------------------------------------------------------ options and persistence

function fillZones() {
	const zones = zoneOptions();
	$("zone").replaceChildren(...zones.map((z) => h("option", { value: z.value, text: z.label })));
}

function fillCounts() {
	$("count").replaceChildren(...COUNTS.map((c) => h("option", { value: c, text: `${c} runs` })));
}

function fillExamples() {
	$("examples").replaceChildren(
		...EXAMPLES.map((ex) =>
			h("button", {
				class: "btn btn--ghost wb-btn tool-small",
				type: "button",
				title: ex.expr,
				text: ex.label,
				onclick: () => useExample(ex),
			}),
		),
	);
}

function restoreState() {
	let saved = {};
	try {
		saved = JSON.parse(storageGet(STORE_KEY) || "{}") || {};
	} catch (e) {
		saved = {};
	}
	const zoneValues = zoneOptions().map((z) => z.value);
	$("expr").value = typeof saved.expr === "string" ? saved.expr : DEFAULTS.expr;
	setFlavor(FLAVORS.includes(saved.flavor) ? saved.flavor : DEFAULTS.flavor);
	$("zone").value = zoneValues.includes(saved.zone) ? saved.zone : DEFAULTS.zone;
	$("count").value = COUNTS.includes(String(saved.count)) ? String(saved.count) : DEFAULTS.count;
}

function saveState() {
	storageSet(
		STORE_KEY,
		JSON.stringify({
			expr: $("expr").value,
			flavor: selectedFlavor(),
			zone: $("zone").value,
			count: $("count").value,
		}),
	);
}

// The start instant. The datetime-local value has no zone, so it is read as the browser's local time.
function startInstant() {
	const value = $("from").value;
	const ms = value ? new Date(value).getTime() : NaN;
	return Number.isNaN(ms) ? Date.now() : ms;
}

// ------------------------------------------------------------------ fields table

// Field rows for a successful parse, taken from the engine.
function rowsFromResult(expr, res) {
	const tokenCount = expr.trim().split(/\s+/).length;
	return FIELD_NAMES.map((name) => {
		const f = res.fields[name];
		let raw = f ? f.raw : "";
		if (name === "second" && res.flavor === "unix") raw = "0 (implied)";
		if (name === "year" && (res.flavor === "unix" || (res.flavor === "quartz" && tokenCount < 7))) raw = "* (implied)";
		return { name, raw: raw || "(not set)", fault: false };
	});
}

// Field rows after a failed parse. The engine returns no fields, so the tokens are split by layout.
function rowsFromTokens(expr, flavor, faultField) {
	const text = expr.trim();
	const toks = text ? text.split(/\s+/) : [];
	const quartz = flavor === "quartz" || (flavor === "auto" && (toks.length >= 6 || /[?LW#]/.test(text.replace(/\b[A-Za-z]{3}\b/g, ""))));
	if (quartz) {
		return FIELD_NAMES.map((name, i) => ({
			name,
			raw: i < toks.length ? toks[i] : "(missing)",
			fault: name === faultField,
		}));
	}
	const unixNames = ["minute", "hour", "dom", "month", "dow"];
	return FIELD_NAMES.map((name) => {
		const i = unixNames.indexOf(name);
		let raw;
		if (name === "second") raw = "0 (implied)";
		else if (name === "year") raw = "* (implied)";
		else raw = i < toks.length ? toks[i] : "(missing)";
		return { name, raw, fault: name === faultField };
	});
}

function renderFields(rows) {
	$("fields-body").replaceChildren(
		...rows.map((r) =>
			h(
				"tr",
				{ class: r.fault ? "is-fault" : null, "data-field": r.name },
				h("th", { scope: "row", text: FIELD_LABELS[r.name] }),
				h("td", { class: "cron-raw", text: r.raw }),
				h("td", { text: r.fault ? "Error in this field" : "" }),
			),
		),
	);
}

// ------------------------------------------------------------------ result sections

function renderChips(res) {
	const chips = [h("span", { class: "cron-chip", text: `Flavor: ${FLAVOR_LABELS[res.flavor]}` })];
	if (res.macro) chips.push(h("span", { class: "cron-chip", text: `Macro: ${res.macro}` }));
	$("chips").replaceChildren(...chips);
}

function renderRuns(res, now) {
	const list = $("runs");
	const hasRuns = res.runs.length > 0;
	list.replaceChildren(
		...res.runs.map((ms, i) =>
			h(
				"li",
				{},
				h("span", { class: "cron-run-time", text: res.formatted[i] }),
				h("span", { class: "cron-rel tool-muted", "data-ms": String(ms), text: relative(ms, now) }),
			),
		),
	);
	list.hidden = !hasRuns;
	$("runs-none").hidden = hasRuns;
}

function renderWarnings(warnings) {
	$("warnings-sec").hidden = warnings.length === 0;
	$("warnings").replaceChildren(...warnings.map((w) => h("li", { text: w })));
}

function renderConvert(res) {
	const section = $("convert-sec");
	if (!res.ok) {
		section.hidden = true;
		return;
	}
	section.hidden = false;
	const conv = res.converted;
	const body = $("convert-body");
	if (!conv) {
		$("convert-title").textContent = "Convert";
		body.replaceChildren(h("p", { class: "tool-muted", text: "No conversion is available for this expression." }));
		return;
	}
	const target = conv.to === "quartz" ? "Quartz" : "Unix";
	$("convert-title").textContent = `Convert to ${target}`;
	const kids = [];
	if (conv.expr) {
		const expr = conv.expr;
		kids.push(
			h(
				"div",
				{ class: "cron-convert-row" },
				h("code", { class: "cron-convert-expr", text: expr }),
				copyButton(() => expr),
			),
		);
	} else {
		kids.push(h("p", { text: `There is no exact ${target} equivalent. The reasons are listed below.` }));
	}
	if (conv.warnings.length) {
		kids.push(h("ul", { class: "cron-list" }, ...conv.warnings.map((w) => h("li", { text: w }))));
	}
	body.replaceChildren(...kids);
}

// ------------------------------------------------------------------ render

function showEmpty() {
	$("alert").hidden = true;
	$("empty").hidden = false;
	$("output").hidden = true;
	$("zone-note").textContent = "";
	setStatus("Type a cron expression to see its next runs.");
}

function render(expr, res, flavor) {
	const now = Date.now();
	$("empty").hidden = true;
	$("output").hidden = false;
	$("zone-note").textContent = `Times in ${zoneName()}`;

	const alert = $("alert");
	alert.textContent = res.ok ? "" : `Error: ${res.error}`;
	alert.hidden = res.ok;

	$("desc").textContent = res.ok
		? res.description
		: "This is not a valid expression yet. The message above says what to fix.";

	if (res.ok) renderChips(res);
	else $("chips").replaceChildren();

	renderFields(res.ok ? rowsFromResult(expr, res) : rowsFromTokens(expr, flavor, res.field));

	if (res.ok) renderRuns(res, now);
	else {
		$("runs").replaceChildren();
		$("runs").hidden = true;
		$("runs-none").hidden = true;
	}

	renderWarnings(res.ok ? res.warnings : []);
	renderConvert(res);

	if (!res.ok) {
		setStatus(`Error: ${res.error}`);
	} else if (res.runs.length) {
		setStatus(`Next run: ${res.formatted[0]} (${zoneName()})`);
	} else {
		setStatus("No upcoming run was found in the search window.");
	}
}

// ------------------------------------------------------------------ run

let timer = 0;

function schedule() {
	clearTimeout(timer);
	timer = setTimeout(run, DEBOUNCE_MS);
}

function run() {
	clearTimeout(timer);
	saveState();
	const expr = $("expr").value;
	if (!expr.trim()) {
		showEmpty();
		return;
	}
	const flavor = selectedFlavor();
	let res;
	try {
		res = explain(expr, {
			flavor,
			tz: $("zone").value,
			count: Number($("count").value),
			from: startInstant(),
		});
	} catch (e) {
		res = { ok: false, error: `Unexpected error: ${e && e.message ? e.message : e}`, field: null };
	}
	render(expr, res, flavor);
}

function useExample(ex) {
	$("expr").value = ex.expr;
	setFlavor(ex.label.startsWith("Quartz") ? "quartz" : "auto");
	run();
	$("expr").focus();
}

// ------------------------------------------------------------------ help drawer

function openHelp() {
	const drawer = $("cron-help");
	drawer.hidden = false;
	$("cron-help-btn").setAttribute("aria-expanded", "true");
	$("cron-help-close").focus({ preventScroll: true });
}

function closeHelp() {
	const drawer = $("cron-help");
	if (drawer.hidden) return;
	drawer.hidden = true;
	$("cron-help-btn").setAttribute("aria-expanded", "false");
	$("cron-help-btn").focus({ preventScroll: true });
}

function onKey(e) {
	const el = e.target instanceof Element ? e.target : null;
	const typing = el && el.closest("input, textarea, select, [contenteditable='true']");

	if (e.key === "Escape") {
		if (!$("cron-help").hidden) closeHelp();
		return;
	}
	if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
		e.preventDefault();
		run();
		return;
	}
	if (e.key === "?" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
		e.preventDefault();
		if ($("cron-help").hidden) openHelp();
	}
}

// ------------------------------------------------------------------ shell

// The site header is in normal flow. Its measured height lets the workspace fill the rest of the viewport.
function fitShell() {
	const header = document.querySelector(".site-header");
	if (!header) return;
	const set = () => document.documentElement.style.setProperty("--wb-top", `${header.offsetHeight}px`);
	set();
	if ("ResizeObserver" in window) new ResizeObserver(set).observe(header);
	else window.addEventListener("resize", set);
}

function init() {
	fillZones();
	fillCounts();
	fillExamples();
	restoreState();
	fitShell();

	$("expr").addEventListener("input", schedule);
	for (const radio of document.querySelectorAll('input[name="flavor"]')) {
		radio.addEventListener("change", run);
	}
	$("zone").addEventListener("change", run);
	$("count").addEventListener("change", run);
	$("from").addEventListener("change", run);
	$("from-clear").addEventListener("click", () => {
		$("from").value = "";
		run();
	});
	$("refresh").addEventListener("click", run);

	$("cron-help-btn").addEventListener("click", () => ($("cron-help").hidden ? openHelp() : closeHelp()));
	$("cron-help-close").addEventListener("click", closeHelp);
	document.addEventListener("keydown", onKey);

	setInterval(refreshRelative, REL_REFRESH_MS);
	run();
}

init();
