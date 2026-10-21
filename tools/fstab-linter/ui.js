// fstab linter UI. Runs fully in the browser.
import { h, $, setStatus, bindDropZone, readTextFile, errText } from "../shared/kit.js";
import { field, codeBlock, findings, countPills, section, bindHelp, debounce, button, emptyState } from "../shared/fx.js";
import { parseFstab, lintFstab, explainEntry, optionHelp, formatFstab, SAMPLE_FSTAB } from "./fstab.js";

const text = field({ label: "/etc/fstab", type: "textarea", rows: 16, mono: true, placeholder: "Paste the contents of /etc/fstab" });
const dropZone = h("div", { class: "tool-drop", role: "button", tabindex: "0" }, h("span", { class: "tool-drop-title", text: "Drop a file here" }), h("span", { class: "tool-muted", text: "or press Enter to choose one" }));
const picker = h("input", { type: "file", hidden: true });

function entryCard(e) {
	const opts = e.optionList.map((o) => ({ o, help: optionHelp(o) }));
	return h(
		"li",
		{ class: "ft-entry" },
		h("div", { class: "ft-head" }, h("span", { class: "fx-where", text: `line ${e.line}` }), h("span", { class: "ft-says", text: explainEntry(e) })),
		opts.length
			? h("dl", { class: "ft-opts" }, opts.flatMap(({ o, help }) => [h("dt", {}, h("code", { text: o })), h("dd", { text: help || "No description here. Check the mount(8) page for this filesystem." })]))
			: null,
	);
}

function run() {
	const out = $("ft-out");
	const src = text.input.value;
	if (!src.trim()) {
		out.replaceChildren(emptyState("Paste an fstab on the left, or load the sample.", button("Load sample", () => { text.input.value = SAMPLE_FSTAB; run(); })));
		setStatus("");
		$("ft-actions").replaceChildren();
		return;
	}
	const parsed = parseFstab(src);
	const issues = lintFstab(parsed);
	const withLine = issues.filter((i) => i.line > 0);
	const general = issues.filter((i) => i.line === 0);
	out.replaceChildren(
		section("Findings", countPills(issues), findings([...general, ...withLine], { empty: "No findings. Run findmnt --verify before you reboot." })),
		section("Entries", h("ol", { class: "ft-entries" }, parsed.entries.map(entryCard))),
		section("Aligned", codeBlock({ title: "fstab, columns aligned (comments kept)", text: formatFstab(src), filename: "fstab" })),
	);
	const errors = issues.filter((i) => i.level === "error").length;
	setStatus(`${parsed.entries.length} ${parsed.entries.length === 1 ? "entry" : "entries"} · ${errors} error${errors === 1 ? "" : "s"} · ${issues.filter((i) => i.level === "warn").length} warning(s)`);
}

function init() {
	window.addEventListener("dragover", (e) => e.preventDefault());
	window.addEventListener("drop", (e) => e.preventDefault());
	text.input.value = SAMPLE_FSTAB;
	$("ft-in").append(
		text.el,
		h("div", { class: "tool-row" }, dropZone, picker, button("Load sample", () => { text.input.value = SAMPLE_FSTAB; run(); }), button("Clear", () => { text.input.value = ""; run(); })),
		h("p", { class: "tool-hint", text: "Static check only. Confirm UUIDs with blkid, then findmnt --verify." }),
	);
	bindDropZone(dropZone, picker, async (files) => {
		const f = files && files[0];
		if (!f) return;
		try {
			text.input.value = await readTextFile(f);
			run();
			setStatus(`Loaded ${f.name}`);
		} catch (e) {
			setStatus(errText(e));
		}
	});
	const foot = $("ft-foot");
	foot.hidden = false;
	foot.append(h("button", { class: "btn btn--primary wb-btn", type: "button", text: "Check", onclick: run }), h("p", { class: "tool-muted", text: "Runs as you type. Ctrl+Enter checks now." }));
	text.input.addEventListener("input", debounce(run, 250));
	document.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			run();
		}
	});
	$("ft-outtitle").textContent = "Report";
	bindHelp("ft");
	run();
}

init();
