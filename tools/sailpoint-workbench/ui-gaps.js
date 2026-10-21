// Gap analysis module: scores the last Migrate conversion. Read-only over the shared result.

import { analyzeGaps, gapMarkdown } from "./gap.js";
import { $, h, plural, errText, downloadText, setInlineError, setStatus, lastMigration } from "./ui-common.js";
import { activateTab, setBadge } from "./ui-tabs.js";
import { loadSample } from "./ui-migrate.js";

const RISKS = [
	["high", "High risk"],
	["medium", "Medium risk"],
	["low", "Low risk"],
];

let lastGaps = null;

const th = (text, num) => h("th", { scope: "col", class: num ? "is-num" : "", text });
const td = (text, num) => h("td", { class: num ? "is-num" : "", text: String(text) });

function renderSummary(g) {
	const count = (risk) => g.findings.filter((f) => f.risk === risk && !f.informational).length;
	const band = g.band.toLowerCase();
	$("gaps-summary").replaceChildren(
		h(
			"div",
			{ class: "tool-score" },
			h("span", { class: "tool-score-label", text: "Score" }),
			h("span", { class: "tool-score-num", text: String(g.score) }),
			h("span", { class: "tool-score-band" }, "Band ", h("span", { class: `tool-pill tool-pill--${band}`, text: g.band })),
		),
		h("p", { class: "tool-muted", text: "Relative effort ranking, not a time estimate." }),
		h("p", { text: `${plural(count("high"), "high risk finding")}, ${count("medium")} medium and ${count("low")} low.` }),
	);
}

function renderWeights(g) {
	const table = $("gaps-weights");
	table.replaceChildren(
		h("thead", null, h("tr", null, th("Item"), th("Count", true), th("Weight", true), th("Points", true))),
		h(
			"tbody",
			null,
			...g.points.map((p) => h("tr", null, td(p.key), td(p.count, true), td(p.each, true), td(p.total, true))),
		),
		h(
			"tfoot",
			null,
			h("tr", null, h("th", { scope: "row", text: "Score" }), h("td", { colspan: 2, text: "" }), td(g.score, true)),
		),
	);
}

function findingEl(f) {
	const summaryParts = [
		h("span", { class: `tool-pill tool-pill--${f.risk}`, text: RISKS.find((r) => r[0] === f.risk)[1] }),
		h("span", { class: "tool-finding-title", text: f.title }),
	];
	summaryParts.push(
		f.informational ? h("span", { class: "tool-finding-count", text: "Note" }) : h("span", { class: "tool-finding-count", text: `${f.count} item${f.count === 1 ? "" : "s"}` }),
	);
	const objects = f.objects.length
		? h("ul", { class: "tool-objects" }, ...f.objects.map((o) => h("li", { text: o })))
		: h("p", { class: "tool-muted", text: "No objects listed." });
	return h(
		"details",
		{ class: "tool-finding" },
		h("summary", { class: "tool-finding-sum" }, ...summaryParts),
		h("div", { class: "tool-finding-body" }, h("p", { text: f.advice }), objects),
	);
}

function renderFindings(g) {
	const blocks = RISKS.map(([risk, label]) => {
		const list = g.findings.filter((f) => f.risk === risk);
		return h(
			"div",
			{ class: "tool-risk-group" },
			h("h4", { class: "tool-risk-title", text: `${label} (${list.length})` }),
			list.length ? h("div", { class: "tool-items" }, ...list.map(findingEl)) : h("p", { class: "tool-muted", text: "None." }),
		);
	});
	$("gaps-findings").replaceChildren(...blocks);
}

// Re-reads the shared Migrate result and redraws the whole panel.
export function renderGaps() {
	const m = lastMigration;
	const n = m ? m.result.stats.total || 0 : 0;
	$("gaps-source").textContent = m ? `Using the last conversion: ${plural(n, "object")} from ${plural(m.files.length, "file")}.` : "No conversion yet.";
	$("gaps-run").disabled = !m;
	$("gaps-empty").hidden = !!m;
	$("gaps-body").hidden = !m;
	setInlineError($("gaps-error"), "");
	$("gaps-download").disabled = true;
	lastGaps = null;
	if (!m) {
		setBadge("gaps", null);
		return;
	}
	let g;
	try {
		g = analyzeGaps(m.result, m.files);
	} catch (e) {
		setInlineError($("gaps-error"), `Gap analysis failed: ${errText(e)}`);
		$("gaps-body").hidden = true;
		setBadge("gaps", null);
		return;
	}
	lastGaps = g;
	renderSummary(g);
	renderWeights(g);
	renderFindings(g);
	$("gaps-download").disabled = false;
	const actionable = g.findings.filter((f) => !f.informational).length;
	setBadge("gaps", actionable);
}

export function initGaps() {
	$("gaps-go").addEventListener("click", () => activateTab("migrate", { focus: true }));
	const sample = () => {
		loadSample();
		renderGaps();
		setStatus("Loaded the sample and analysed it.");
	};
	$("gaps-sample").addEventListener("click", sample);
	$("gaps-empty-sample").addEventListener("click", sample);
	$("gaps-run").addEventListener("click", () => {
		renderGaps();
		if (lastGaps) setStatus(`Gap score ${lastGaps.score} (${lastGaps.band}).`);
	});
	$("gaps-download").addEventListener("click", () => {
		if (!lastGaps) return;
		downloadText("gap-report.md", gapMarkdown(lastGaps), "text/markdown;charset=utf-8");
		setStatus("Downloaded gap-report.md.");
	});
}
