// Permissions and sudoers UI. Runs fully in the browser.
import { h, $, setStatus, storageGet, storageSet } from "../shared/kit.js";
import { field, segmented, chips, codeBlock, findings, countPills, section, bindHelp, debounce, button, kvTable, emptyState } from "../shared/fx.js";
import { parseModeInput, describeMode, toOctal, toSymbolic, umaskResult, parseOctal, COMMON_MODES, parseSudoers, lintSudoers, explainEntry, SAMPLE_SUDOERS } from "./perms.js";

const MODES = [
	{ value: "mode", label: "Mode" },
	{ value: "umask", label: "Umask" },
	{ value: "sudoers", label: "Sudoers" },
];
const KEY = "sk-perms-mode";
let mode = MODES.some((m) => m.value === storageGet(KEY)) ? storageGet(KEY) : "mode";
const forms = {};
const refresh = debounce(() => render(), 150);

function modeForm() {
	const el = h("div", { class: "tool-form" });
	const input = field({ label: "Mode or chmod expression", value: "u=rwx,g=rx,o=", mono: true, placeholder: "755, rwxr-xr-x or u+x,g-w", hint: "Octal, a symbolic string such as -rwsr-xr-x, or an expression applied to the starting mode.", onInput: refresh });
	const base = field({ label: "Starting mode (for an expression)", value: "644", mono: true, onInput: refresh });
	const umask = field({ label: "Umask (for clauses without u, g, o, a)", value: "022", mono: true, onInput: refresh });
	const kind = segmented("pm-kind", [{ value: "file", label: "File" }, { value: "dir", label: "Directory" }], "file", refresh);
	el.append(
		input.el,
		h("div", { class: "fx-grid2" }, base.el, umask.el),
		h("div", { class: "tool-field" }, h("label", { text: "Applies to" }), kind.el),
		h("div", { class: "tool-field" }, h("label", { text: "Common modes" }), chips(COMMON_MODES.map((m) => ({ label: m.mode, title: m.use, mode: m.mode })), (it) => { input.input.value = it.mode; render(); }, { label: "Common modes" })),
	);
	return {
		el,
		read: () => ({ text: input.input.value, base: base.input.value, umask: umask.input.value, isDir: kind.get() === "dir" }),
	};
}

function umaskForm() {
	const el = h("div", { class: "tool-form" });
	const u = field({ label: "Umask (octal)", value: "022", mono: true, onInput: refresh });
	el.append(u.el, h("div", { class: "tool-field" }, h("label", { text: "Common umasks" }), chips(["022", "002", "027", "077", "007"].map((x) => ({ label: x, u: x })), (it) => { u.input.value = it.u; render(); }, { label: "Common umasks" })));
	return { el, read: () => u.input.value };
}

function sudoersForm() {
	const el = h("div", { class: "tool-form" });
	const t = field({ label: "sudoers file or drop-in", type: "textarea", rows: 18, mono: true, placeholder: "Paste /etc/sudoers or a file from /etc/sudoers.d", onInput: refresh });
	t.input.value = SAMPLE_SUDOERS;
	el.append(t.el, h("div", { class: "tool-row" }, button("Load sample", () => { t.input.value = SAMPLE_SUDOERS; render(); }), button("Clear", () => { t.input.value = ""; render(); })));
	return { el, read: () => t.input.value };
}

const BUILDERS = { mode: modeForm, umask: umaskForm, sudoers: sudoersForm };

// ------------------------------------------------------------------ render

function renderMode(v) {
	const parts = [];
	const base = parseOctal(v.base);
	const um = parseOctal(v.umask);
	if (v.base.trim() && base === null) parts.push(section("", findings([{ level: "error", message: `The starting mode "${v.base}" is not octal (use digits 0 to 7).` }])));
	if (v.umask.trim() && um === null) parts.push(section("", findings([{ level: "error", message: `The umask "${v.umask}" is not octal.` }])));
	const r = parseModeInput(v.text, { base: base ?? 0o644, isDir: v.isDir, umask: um ?? 0o022 });
	if (!r.ok) {
		parts.push(section("", findings([{ level: "error", message: r.error }])));
		return { parts, status: "Cannot read the mode" };
	}
	const d = describeMode(r.mode, { isDir: v.isDir });
	const kindText = { octal: "Octal", symbolic: "Symbolic string", expression: `Expression applied to ${(base ?? 0o644).toString(8).padStart(3, "0")}` }[r.kind];
	parts.push(
		h("div", { class: "fx-big" }, h("span", { class: "fx-big-num", text: d.octal }), h("span", { class: "fx-big-alt", text: d.symbolic }), h("span", { class: "tool-muted", text: kindText })),
	);
	if (r.steps && r.steps.length) {
		parts.push(section("Steps", kvTable(r.steps.map((s, i) => [`${i + 1}. ${s.clause}`, toOctal(s.mode), toSymbolic(s.mode)]), { head: ["Clause", "Octal", "Symbolic"] })));
	}
	for (const n of r.notes || []) parts.push(h("p", { class: "tool-note", text: n }));
	parts.push(
		section(
			"Who can do what",
			kvTable(d.classes.map((c) => [c.name, h("span", { class: c.read ? "fx-on" : "fx-off", text: c.read ? "r" : "-" }), h("span", { class: c.write ? "fx-on" : "fx-off", text: c.write ? "w" : "-" }), h("span", { class: c.exec ? "fx-on" : "fx-off", text: c.exec ? "x" : "-" }), c.text]), { head: ["Class", "Read", "Write", "Exec", "Allows"] }),
		),
	);
	if (d.special.length) parts.push(section("Special bits", h("ul", { class: "fx-list" }, d.special.map((s) => h("li", {}, h("strong", { text: `${s.bit}: ` }), s.note)))));
	if (d.warnings.length) parts.push(section("Watch out", findings(d.warnings.map((w) => ({ level: "warn", message: w })))));
	const sym = `${["u", "g", "o"].map((c, i) => `${c}=${d.classes[i].text === "no access" ? "" : (d.classes[i].read ? "r" : "") + (d.classes[i].write ? "w" : "") + (d.classes[i].exec ? "x" : "")}`).join(",")}`;
	const cmds = [`chmod ${d.octal} path`, `chmod ${sym} path`];
	if (v.isDir) cmds.push("chmod -R " + d.octal + " path   # applies to every file inside too: usually not wanted");
	cmds.push(`install -m ${d.octal} src dest`, `python3 -c "import os; os.chmod('path', 0o${d.octal})"`);
	parts.push(section("Commands", codeBlock({ title: "Equivalent", text: cmds.join("\n"), wrap: true })));
	return { parts, status: `${d.octal} ${d.symbolic}`, note: v.isDir ? "directory" : "file" };
}

function renderUmask(text) {
	const n = parseOctal(text);
	if (n === null || n > 0o777) return { parts: [section("", findings([{ level: "error", message: "Enter an octal umask from 000 to 777." }]))], status: "Bad umask" };
	const r = umaskResult(n);
	const rows = ["022", "002", "027", "077", "007"].map((x) => { const u = umaskResult(parseInt(x, 8)); return [x, `${u.file.octal} ${u.file.symbolic}`, `${u.dir.octal} ${u.dir.symbolic}`]; });
	return {
		parts: [
			h("div", { class: "fx-big" }, h("span", { class: "fx-big-num", text: r.umask }), h("span", { class: "tool-muted", text: "new files and directories start from 666 and 777, then these bits are removed" })),
			kvTable([["New file", r.file.octal, r.file.symbolic], ["New directory", r.dir.octal, r.dir.symbolic]], { head: ["Created as", "Mode", "Symbolic"] }),
			h("p", { class: "tool-hint", text: "A new file never gets execute bits from the umask, whatever the umask is. Programs can ask for other modes: a process that creates a file with mode 600 is not widened by the umask." }),
			section("Common umasks", kvTable(rows, { head: ["Umask", "File", "Directory"] })),
			section("Setting it", codeBlock({ title: "Shell and systemd", text: `umask ${r.umask}              # current shell and its children\nUMask=${r.umask}             # in a systemd service unit\n# /etc/login.defs: UMASK ${r.umask}`, wrap: true })),
		],
		status: `umask ${r.umask}`,
	};
}

function renderSudoers(text) {
	if (!text.trim()) return { parts: [emptyState("Paste a sudoers file on the left, or load the sample.")], status: "" };
	const p = parseSudoers(text);
	const lint = lintSudoers(p);
	const parts = [
		section("Findings", countPills(lint), findings(lint, { empty: "No findings. Still validate with visudo -c -f." })),
		section(
			"Line by line",
			h("ol", { class: "pm-lines" }, p.entries.map((e) => h("li", { class: "pm-line" }, h("code", { class: "pm-raw", text: `${e.line}  ${e.raw}` }), h("span", { class: "pm-says", text: explainEntry(e) })))),
		),
	];
	return { parts, status: `${p.entries.length} ${p.entries.length === 1 ? "entry" : "entries"}, ${lint.filter((l) => l.level === "error").length} error(s)` };
}

function render() {
	const form = forms[mode];
	if (!form) return;
	const v = form.read();
	const r = mode === "mode" ? renderMode(v) : mode === "umask" ? renderUmask(v) : renderSudoers(v);
	$("pm-out").replaceChildren(...r.parts);
	$("pm-outtitle").textContent = { mode: "Mode", umask: "Umask", sudoers: "Sudoers" }[mode];
	$("pm-outnote").textContent = r.note || "";
	setStatus(r.status || "");
}

function setMode(m) {
	mode = m;
	storageSet(KEY, m);
	const body = $("pm-in");
	body.replaceChildren(h("div", { class: "tool-field" }, h("label", { text: "Tool" }), seg.el));
	if (!forms[m]) forms[m] = BUILDERS[m]();
	body.append(forms[m].el);
	render();
}

const seg = segmented("pm-mode", MODES, mode, setMode);

bindHelp("pm");
setMode(mode);
