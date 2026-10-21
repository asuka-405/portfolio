// Browser UI for the Arch installer. The engine (archgen.js) is pure; this file only wires the DOM.
// Text from the user always goes through textContent or h(). Nothing is parsed as HTML.

import { $, h, setStatus, downloadText, downloadZip, copyButton, bindTablist, storageGet, storageSet, plural, errText } from "../shared/kit.js";
import { DEFAULTS, validateConfig, generateInstall, FS_PRESETS, validateFstab, buildFstab, explainOptions } from "./archgen.js";

const STORE_KEY = "arch-installer:v1";
const MODES = ["install", "fstab"];

// ------------------------------------------------------------------ helpers

const clone = (v) => JSON.parse(JSON.stringify(v));
const freshDefaults = () => clone(DEFAULTS);
const isPreset = (t) => Object.prototype.hasOwnProperty.call(FS_PRESETS, t);
const str = (v) => (typeof v === "string" ? v : "");
const num = (v) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isTyping = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// ------------------------------------------------------------------ install state

// Presets set only the fields they name. Everything else comes from DEFAULTS.
const PRESETS = {
	laptop: { boot: "uefi", fs: "btrfs", luks: true, swap: "zram", bootloader: "systemd-boot" },
	simple: { boot: "uefi", fs: "ext4", bootloader: "grub" },
};
const PRESET_LABELS = { laptop: "Laptop preset loaded.", simple: "Simple preset loaded." };

const SUBVOL_SETS = {
	minimal: [
		{ name: "@", mount: "/" },
		{ name: "@home", mount: "/home" },
	],
	snapper: [
		{ name: "@", mount: "/" },
		{ name: "@home", mount: "/home" },
		{ name: "@log", mount: "/var/log" },
		{ name: "@pkg", mount: "/var/cache/pacman/pkg" },
		{ name: "@snapshots", mount: "/.snapshots" },
	],
};

// Form field id to config key. Each group is read and written the same way.
const TEXT_FIELDS = {
	"in-disk": "disk",
	"in-esp-size": "espSize",
	"in-swap-size": "swapSize",
	"in-hostname": "hostname",
	"in-username": "username",
	"in-timezone": "timezone",
	"in-locale": "locale",
	"in-keymap": "keymap",
	"in-extra": "extraPackages",
};
const SELECT_FIELDS = {
	"in-boot": "boot",
	"in-fs": "fs",
	"in-swap": "swap",
	"in-bootloader": "bootloader",
	"in-kernel": "kernel",
	"in-microcode": "microcode",
	"in-network": "network",
};
const MOUNT_CHECKS = { "in-noatime": "noatime", "in-ssd": "ssd" };

let installState = freshDefaults();
let installFiles = [];
let installTimer = null;
let selectedFile = "install.sh";

function writeForm() {
	const s = installState;
	for (const [id, key] of Object.entries(TEXT_FIELDS)) $(id).value = s[key] ?? "";
	for (const [id, key] of Object.entries(SELECT_FIELDS)) $(id).value = s[key] ?? "";
	$("in-luks").checked = s.luks === true;
	for (const [id, key] of Object.entries(MOUNT_CHECKS)) $(id).checked = s.mount[key] === true;
	$("in-compress").value = s.mount.compress || "none";
	$("in-discard").value = s.mount.discard || "none";
}

function readForm() {
	const next = { ...installState, mount: { ...installState.mount } };
	for (const [id, key] of Object.entries(TEXT_FIELDS)) next[key] = $(id).value.trim();
	for (const [id, key] of Object.entries(SELECT_FIELDS)) next[key] = $(id).value;
	next.luks = $("in-luks").checked;
	for (const [id, key] of Object.entries(MOUNT_CHECKS)) next.mount[key] = $(id).checked;
	const compress = $("in-compress").value;
	next.mount.compress = compress === "none" ? "" : compress;
	next.mount.discard = $("in-discard").value;
	installState = next;
}

// Disables or hides the options the engine would reject. Runs before readForm so the state follows the DOM.
function applyConstraints() {
	const bios = $("in-boot").value === "bios";
	const bl = $("in-bootloader");
	bl.querySelector('option[value="systemd-boot"]').disabled = bios;
	if (bios && bl.value === "systemd-boot") bl.value = "grub";
	$("bootloader-hint").textContent = bios ? "BIOS boot uses GRUB. systemd-boot needs UEFI." : "Choosing BIOS switches the bootloader to GRUB.";
	$("in-swap-size").disabled = !["file", "partition"].includes($("in-swap").value);
	$("fs-btrfs").hidden = $("in-fs").value !== "btrfs";
}

function textInput(value, label, onInput) {
	const el = h("input", { class: "tool-input arch-cell", type: "text", spellcheck: "false", autocomplete: "off", "aria-label": label });
	el.value = value ?? "";
	el.addEventListener("input", () => onInput(el.value));
	return el;
}

function renderSubvols() {
	const rows = installState.subvolumes.map((s, i) => {
		const name = textInput(s.name, `Subvolume ${i + 1} name`, (v) => {
			installState.subvolumes[i].name = v;
		});
		const mount = textInput(s.mount, `Subvolume ${i + 1} mount point`, (v) => {
			installState.subvolumes[i].mount = v;
		});
		const del = h("button", { class: "btn btn--ghost wb-btn tool-small", type: "button", "aria-label": `Remove subvolume ${i + 1}`, text: "Remove" });
		del.addEventListener("click", () => {
			installState.subvolumes.splice(i, 1);
			renderSubvols();
			onFormInput();
			$("subvol-add").focus();
		});
		return h("div", { class: "arch-subvol" }, name, mount, del);
	});
	$("subvol-rows").replaceChildren(...rows);
}

// Any edit to the install form. Input events bubble here, including from subvolume rows.
function onFormInput() {
	applyConstraints();
	readForm();
	checkInstall();
	scheduleInstall();
	save();
}

// Immediate: validation list and the Generate button.
function checkInstall() {
	const { errors, warnings } = validateConfig(installState);
	$("install-errors").replaceChildren(...errors.map((e) => h("li", { text: e })));
	$("install-errors-box").hidden = errors.length === 0;
	$("install-generate").disabled = errors.length > 0;
	$("install-status").textContent = errors.length
		? `${plural(errors.length, "error")}. Generate is disabled until they are fixed.`
		: warnings.length
			? `Valid, with ${plural(warnings.length, "warning")}. The script updates as you type.`
			: "Valid. The script updates as you type.";
}

// Debounced: regenerate the output.
function scheduleInstall() {
	clearTimeout(installTimer);
	installTimer = setTimeout(renderInstall, 250);
}

function renderInstall() {
	clearTimeout(installTimer);
	let res;
	try {
		res = generateInstall(installState);
	} catch (e) {
		res = { ok: false, errors: [`Internal error: ${errText(e)}`], warnings: [], files: [] };
	}
	const ok = res.ok;
	installFiles = ok ? res.files : [];
	$("install-empty").hidden = ok;
	$("install-body").hidden = !ok;
	$("install-zip").disabled = !ok;
	$("viewer-download").disabled = !ok;
	viewerCopy.disabled = !ok;
	if (ok) {
		fillPlan(res.parts);
		fillWarnings(res.warnings);
		showFile(selectedFile);
	} else {
		$("viewer-path").textContent = "No file selected";
		$("viewer").textContent = "";
	}
	$("install-result-status").textContent = ok
		? `Generated install.sh, fstab.preview and NOTES.md${res.warnings.length ? `, with ${plural(res.warnings.length, "warning")}` : ""}.`
		: `Not generated. ${plural(res.errors.length, "error")} in the form.`;
}

function generateNow() {
	renderInstall();
	setStatus("Install script generated.");
}

function fillPlan(parts) {
	$("install-plan").replaceChildren(
		...parts.map((p) =>
			h(
				"tr",
				{},
				h("td", { class: "is-num", text: p.n }),
				h("td", { text: p.role }),
				h("td", { text: p.size }),
				h("td", { class: "tool-mono-cell", text: p.type }),
				h("td", { text: p.label }),
				h("td", { text: p.fs }),
				h("td", { text: p.mount || "-" }),
			),
		),
	);
}

function fillWarnings(list) {
	$("install-warn").hidden = list.length === 0;
	$("install-warnings").replaceChildren(...list.map((w) => h("li", { text: w })));
}

function currentFile() {
	return installFiles.find((f) => f.path === selectedFile) || null;
}

function showFile(path, { focus = false } = {}) {
	selectedFile = path;
	for (const t of document.querySelectorAll("#file-tabs [role='tab']")) {
		const on = t.dataset.file === path;
		t.setAttribute("aria-selected", String(on));
		t.tabIndex = on ? 0 : -1;
		if (on && focus) t.focus();
	}
	const f = currentFile();
	$("viewer-path").textContent = f ? f.path : "No file selected";
	$("viewer").textContent = f ? f.content : "";
}

function applyPreset(name) {
	installState = { ...freshDefaults(), ...clone(PRESETS[name]) };
	writeForm();
	renderSubvols();
	onFormInput();
	renderInstall();
	setStatus(PRESET_LABELS[name] || "Preset loaded.");
}

// ------------------------------------------------------------------ fstab state

const EXAMPLE = [
	{ spec: "LABEL=arch", mount: "/", type: "btrfs", options: "noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=@", dump: 0, pass: 0, comment: "Root subvolume" },
	{ spec: "LABEL=arch", mount: "/home", type: "btrfs", options: "noatime,compress=zstd:3,ssd,discard=async,space_cache=v2,subvol=@home", dump: 0, pass: 0, comment: "Home subvolume" },
	{ spec: "LABEL=ESP", mount: "/boot", type: "vfat", options: FS_PRESETS.vfat.options, dump: 0, pass: 0, comment: "EFI system partition" },
	{ spec: "LABEL=SWAP", mount: "none", type: "swap", options: "defaults", dump: 0, pass: 0, comment: "" },
	{ spec: "tmpfs", mount: "/tmp", type: "tmpfs", options: FS_PRESETS.tmpfs.options, dump: 0, pass: 0, comment: "" },
	{ spec: "nas.example.lan:/export/data", mount: "/mnt/nas", type: "nfs", options: FS_PRESETS.nfs.options, dump: 0, pass: 0, comment: "Replace with your NFS server" },
];

// Quick-add rows. Device names are placeholders the user replaces.
const QUICK = {
	"quick-root-ext4": { spec: "LABEL=ROOT", mount: "/", type: "ext4", pass: 1 },
	"quick-root-btrfs": { spec: "LABEL=arch", mount: "/", type: "btrfs", options: `${FS_PRESETS.btrfs.options},subvol=@` },
	"quick-esp": { spec: "LABEL=ESP", mount: "/boot", type: "vfat" },
	"quick-swap": { spec: "LABEL=SWAP", mount: "none", type: "swap" },
	"quick-tmpfs": { spec: "tmpfs", mount: "/tmp", type: "tmpfs" },
	"quick-nfs": { spec: "nas.example.lan:/export/data", mount: "/mnt/nas", type: "nfs" },
	"quick-ntfs": { spec: "LABEL=Data", mount: "/mnt/data", type: "ntfs3" },
};

function quickEntry(def) {
	const preset = FS_PRESETS[def.type];
	return {
		spec: def.spec,
		mount: def.mount,
		type: def.type,
		options: def.options ?? preset.options,
		dump: 0,
		pass: def.pass ?? preset.pass,
		comment: "",
	};
}

function blankEntry() {
	const preset = FS_PRESETS.ext4;
	return { spec: "", mount: "", type: "ext4", options: preset.options, dump: 0, pass: preset.pass, comment: "" };
}

let fstabEntries = [];
let rowRefs = [];
let focusedRow = -1;
let offerRow = -1;
let fstabText = "";

function save() {
	storageSet(STORE_KEY, JSON.stringify({ install: installState, fstab: fstabEntries }));
}

// Restores saved state field by field, so a stale or edited store cannot break the page.
function restoreInstall(raw) {
	const base = freshDefaults();
	const out = { ...base };
	for (const key of ["disk", "boot", "fs", "espSize", "swap", "swapSize", "bootloader", "kernel", "microcode", "hostname", "timezone", "locale", "keymap", "username", "network", "extraPackages"]) {
		if (typeof raw[key] === "string") out[key] = raw[key];
	}
	out.luks = raw.luks === true;
	const m = isObj(raw.mount) ? raw.mount : {};
	out.mount = {
		noatime: m.noatime === true,
		compress: typeof m.compress === "string" ? m.compress : base.mount.compress,
		ssd: m.ssd === true,
		discard: typeof m.discard === "string" ? m.discard : base.mount.discard,
	};
	out.subvolumes = Array.isArray(raw.subvolumes) ? raw.subvolumes.filter(isObj).map((s) => ({ name: str(s.name), mount: str(s.mount) })) : base.subvolumes;
	return out;
}

function restoreEntry(e) {
	return { spec: str(e.spec), mount: str(e.mount), type: str(e.type), options: str(e.options), dump: num(e.dump), pass: num(e.pass), comment: str(e.comment) };
}

function loadSaved() {
	const raw = storageGet(STORE_KEY);
	if (!raw) return;
	let data;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		return;
	}
	if (!isObj(data)) return;
	if (isObj(data.install)) installState = restoreInstall(data.install);
	if (Array.isArray(data.fstab)) fstabEntries = data.fstab.filter(isObj).map(restoreEntry);
}

// ------------------------------------------------------------------ fstab table

function setFocusedRow(i) {
	focusedRow = i;
	renderExplain();
}

function hideOffer() {
	offerRow = -1;
	$("fstab-offer").hidden = true;
}

// Offers the new type's defaults only when the options are empty or still the previous type's preset.
function offerPresetFor(i, prevType) {
	const e = fstabEntries[i];
	const preset = isPreset(e.type) ? FS_PRESETS[e.type] : null;
	const prev = isPreset(prevType) ? FS_PRESETS[prevType] : null;
	if (!preset) return hideOffer();
	const alreadyMatches = e.options === preset.options && Number(e.pass) === preset.pass;
	const untouched = !e.options.trim() || (prev !== null && e.options === prev.options);
	if (alreadyMatches || !untouched) return hideOffer();
	offerRow = i;
	$("fstab-offer-text").textContent = `Row ${i + 1} is now ${e.type}. Use the ${e.type} defaults for options and pass (${preset.pass})?`;
	$("fstab-offer").hidden = false;
}

function numberInput(value, label, min, max, onInput) {
	const el = h("input", { class: "tool-input arch-cell arch-cell--num", type: "number", min: String(min), max: String(max), step: "1", "aria-label": label });
	el.value = String(value ?? 0);
	el.addEventListener("input", () => onInput(el.value.trim() === "" ? 0 : Number(el.value)));
	return el;
}

function buildRow(entry, i) {
	const n = i + 1;
	const tr = h("tr", { "data-index": String(i) });
	tr.addEventListener("focusin", () => setFocusedRow(i));

	const spec = textInput(entry.spec, `Device, row ${n}`, (v) => {
		entry.spec = v;
		afterFstabEdit();
	});

	const type = h("select", { class: "tool-input arch-cell", "aria-label": `Type, row ${n}` });
	if (!entry.type) type.append(h("option", { value: "", text: "Choose" }));
	else if (!isPreset(entry.type)) type.append(h("option", { value: entry.type, text: entry.type }));
	for (const k of Object.keys(FS_PRESETS)) type.append(h("option", { value: k, text: k }));
	type.value = entry.type;
	type.addEventListener("change", () => {
		const prev = entry.type;
		entry.type = type.value;
		offerPresetFor(i, prev);
		afterFstabEdit();
	});

	const mount = textInput(entry.mount, `Mount point, row ${n}`, (v) => {
		entry.mount = v;
		afterFstabEdit();
	});

	const options = textInput(entry.options, `Options, row ${n}`, (v) => {
		entry.options = v;
		afterFstabEdit();
	});

	const dump = numberInput(entry.dump, `Dump, row ${n}`, 0, 1, (v) => {
		entry.dump = v;
		afterFstabEdit();
	});

	const pass = numberInput(entry.pass, `Pass, row ${n}`, 0, 2, (v) => {
		entry.pass = v;
		afterFstabEdit();
	});

	const comment = textInput(entry.comment, `Comment, row ${n}`, (v) => {
		entry.comment = v;
		afterFstabEdit();
	});

	const up = h("button", { class: "btn btn--ghost wb-btn tool-small", type: "button", "aria-label": `Move row ${n} up`, text: "Up" });
	up.disabled = i === 0;
	up.addEventListener("click", () => moveRow(i, -1));
	const down = h("button", { class: "btn btn--ghost wb-btn tool-small", type: "button", "aria-label": `Move row ${n} down`, text: "Down" });
	down.disabled = i === fstabEntries.length - 1;
	down.addEventListener("click", () => moveRow(i, 1));
	const del = h("button", { class: "btn btn--ghost wb-btn tool-small", type: "button", "aria-label": `Delete row ${n}`, text: "Delete" });
	del.addEventListener("click", () => deleteRow(i));

	rowRefs.push({ spec, type, options, pass, up, down });

	tr.append(
		h("td", { class: "is-num", text: n }),
		h("td", {}, spec),
		h("td", {}, mount),
		h("td", {}, type),
		h("td", {}, options),
		h("td", {}, dump),
		h("td", {}, pass),
		h("td", {}, comment),
		h("td", { class: "arch-actions" }, up, down, del),
	);
	return tr;
}

// Rebuilds the table. Only structural changes call this; typing edits the entry objects in place.
function renderFstabRows(after) {
	rowRefs = [];
	$("fstab-body").replaceChildren(...fstabEntries.map((e, i) => buildRow(e, i)));
	$("fstab-none").hidden = fstabEntries.length > 0;
	$("fstab-table-wrap").hidden = fstabEntries.length === 0;
	hideOffer();
	if (focusedRow >= fstabEntries.length) focusedRow = fstabEntries.length - 1;
	if (after) after();
}

function addEntry(entry) {
	fstabEntries.push(entry);
	focusedRow = fstabEntries.length - 1;
	renderFstabRows(() => rowRefs[focusedRow].spec.focus());
	afterFstabEdit();
}

function moveRow(i, dir) {
	const j = i + dir;
	if (j < 0 || j >= fstabEntries.length) return;
	[fstabEntries[i], fstabEntries[j]] = [fstabEntries[j], fstabEntries[i]];
	focusedRow = j;
	renderFstabRows(() => {
		const r = rowRefs[j];
		if (!r) return;
		const b = dir < 0 ? r.up : r.down;
		(b.disabled ? r.spec : b).focus();
	});
	afterFstabEdit();
}

function deleteRow(i) {
	fstabEntries.splice(i, 1);
	renderFstabRows(() => {
		const r = rowRefs[i] || rowRefs[i - 1];
		(r ? r.spec : $("fstab-add")).focus();
	});
	afterFstabEdit();
}

function focusRow(i) {
	if (i < 0 || i >= rowRefs.length) return;
	setFocusedRow(i);
	rowRefs[i].spec.focus();
}

function afterFstabEdit() {
	renderFstabOutput();
	save();
}

function renderFstabOutput() {
	fstabText = buildFstab(fstabEntries);
	$("fstab-output").textContent = fstabText;
	const problems = validateFstab(fstabEntries);
	const errors = problems.filter((p) => p.level === "error").length;
	const warnings = problems.length - errors;
	$("fstab-status").textContent = problems.length ? `${plural(errors, "error")}, ${plural(warnings, "warning")}.` : "No problems found.";
	renderProblems(problems);
	renderExplain();
}

function renderProblems(problems) {
	const list = $("fstab-problems");
	if (!problems.length) {
		list.replaceChildren(h("li", { class: "tool-muted", text: "Nothing to fix." }));
		return;
	}
	list.replaceChildren(
		...problems.map((p) => {
			const isError = p.level === "error";
			const tag = h("span", { class: isError ? "tool-tag tool-tag--error" : "tool-tag tool-tag--warn", text: isError ? "Error" : "Warning" });
			const body = p.line ? `Line ${p.line}: ${p.message}` : p.message;
			let content;
			if (p.line && p.line <= fstabEntries.length) {
				content = h("button", { class: "arch-problem", type: "button", text: body });
				content.addEventListener("click", () => focusRow(p.line - 1));
			} else {
				content = h("span", { text: body });
			}
			return h("li", { class: "arch-problem-item" }, tag, " ", content);
		}),
	);
}

function renderExplain() {
	const note = $("fstab-explain-note");
	const dl = $("fstab-explain");
	const e = fstabEntries[focusedRow];
	if (!e) {
		note.textContent = "Focus a row in the table to see what its options mean.";
		dl.replaceChildren();
		return;
	}
	const items = explainOptions(e.options);
	note.textContent = items.length ? `Row ${focusedRow + 1}, options as typed:` : `Row ${focusedRow + 1} has no options.`;
	dl.replaceChildren(
		...items.flatMap(({ option, help }) => [
			h("dt", { text: option }),
			h("dd", { text: help || "Not described here. See mount(8) or the man page for this filesystem." }),
		]),
	);
}

// ------------------------------------------------------------------ mode tabs, help, keys

let mode = "install";

function setMode(id, { focus = false, writeHash = true } = {}) {
	if (!MODES.includes(id)) return;
	mode = id;
	for (const m of MODES) {
		const on = m === id;
		const tab = $(`tab-${m}`);
		tab.setAttribute("aria-selected", String(on));
		tab.tabIndex = on ? 0 : -1;
		$(`panel-${m}`).hidden = !on;
	}
	if (focus) $(`tab-${id}`).focus();
	if (writeHash && location.hash !== `#${id}`) location.hash = id;
	save();
}

function modeFromHash() {
	const id = location.hash.replace(/^#/, "");
	return MODES.includes(id) ? id : null;
}

function openHelp() {
	const drawer = $("arch-help");
	drawer.hidden = false;
	$("arch-help-btn").setAttribute("aria-expanded", "true");
	for (const sec of drawer.querySelectorAll("[data-help]")) sec.classList.toggle("is-current", sec.dataset.help === mode);
	drawer.focus({ preventScroll: true });
}

function closeHelp() {
	const drawer = $("arch-help");
	if (drawer.hidden) return;
	drawer.hidden = true;
	$("arch-help-btn").setAttribute("aria-expanded", "false");
	$("arch-help-btn").focus({ preventScroll: true });
}

// ------------------------------------------------------------------ start

const viewerCopy = copyButton(() => {
	const f = currentFile();
	return f ? f.content : "";
});

function init() {
	loadSaved();

	// Install form
	writeForm();
	renderSubvols();
	$("install-form").addEventListener("input", onFormInput);
	$("install-form").addEventListener("change", onFormInput);
	for (const [id, label] of [["preset-laptop", "laptop"], ["preset-simple", "simple"]]) {
		$(id).addEventListener("click", () => applyPreset(label));
	}
	$("subvol-preset-minimal").addEventListener("click", () => {
		installState.subvolumes = clone(SUBVOL_SETS.minimal);
		renderSubvols();
		onFormInput();
		setStatus("Minimal subvolume layout set.");
	});
	$("subvol-preset-snapper").addEventListener("click", () => {
		installState.subvolumes = clone(SUBVOL_SETS.snapper);
		renderSubvols();
		onFormInput();
		setStatus("Snapper-friendly subvolume layout set.");
	});
	$("subvol-add").addEventListener("click", () => {
		installState.subvolumes.push({ name: "@data", mount: "/data" });
		renderSubvols();
		onFormInput();
		$("subvol-rows").lastElementChild?.querySelector("input")?.focus();
	});
	$("install-generate").addEventListener("click", generateNow);
	$("install-zip").addEventListener("click", () => {
		if (!installFiles.length) return;
		downloadZip("arch-install-kit.zip", installFiles);
		setStatus("Downloaded arch-install-kit.zip.");
	});

	// Output viewer
	$("viewer-copy-slot").append(viewerCopy);
	$("viewer-download").addEventListener("click", () => {
		const f = currentFile();
		if (!f) return;
		downloadText(f.path, f.content);
		setStatus(`Downloaded ${f.path}.`);
	});
	bindTablist(
		$("file-tabs"),
		[...document.querySelectorAll("#file-tabs [role='tab']")],
		(t, opts) => showFile(t.dataset.file, { focus: opts.focus }),
		"horizontal",
	);

	// fstab builder
	$("fstab-add").addEventListener("click", () => addEntry(blankEntry()));
	for (const [id, def] of Object.entries(QUICK)) $(id).addEventListener("click", () => addEntry(quickEntry(def)));
	$("fstab-example").addEventListener("click", () => {
		if (fstabEntries.length && !window.confirm("Replace the current entries with the example?")) return;
		fstabEntries = clone(EXAMPLE);
		focusedRow = -1;
		renderFstabRows();
		afterFstabEdit();
		setStatus("Example loaded.");
	});
	$("fstab-clear").addEventListener("click", () => {
		if (fstabEntries.length && !window.confirm("Remove all fstab entries?")) return;
		fstabEntries = [];
		focusedRow = -1;
		renderFstabRows();
		afterFstabEdit();
		setStatus("Entries cleared.");
	});
	$("fstab-offer-apply").addEventListener("click", () => {
		const i = offerRow;
		const e = fstabEntries[i];
		if (!e || !isPreset(e.type)) return hideOffer();
		const preset = FS_PRESETS[e.type];
		e.options = preset.options;
		e.pass = preset.pass;
		const r = rowRefs[i];
		hideOffer();
		if (r) {
			r.options.value = e.options;
			r.pass.value = String(e.pass);
			r.options.focus();
		}
		afterFstabEdit();
	});
	$("fstab-offer-keep").addEventListener("click", () => {
		const r = rowRefs[offerRow];
		hideOffer();
		if (r) r.type.focus();
	});
	$("fstab-copy-slot").append(
		copyButton(() => fstabText),
	);
	$("fstab-download").addEventListener("click", () => {
		downloadText("fstab", fstabText);
		setStatus("Downloaded fstab.");
	});

	// Mode tabs and hash
	bindTablist(
		$("mode-tabs"),
		[$("tab-install"), $("tab-fstab")],
		(t, opts) => setMode(t.dataset.mode, { focus: opts.focus }),
		"horizontal",
	);
	window.addEventListener("hashchange", () => {
		const id = modeFromHash();
		if (id) setMode(id, { writeHash: false });
	});

	// Help and keys
	$("arch-help-btn").addEventListener("click", () => ($("arch-help").hidden ? openHelp() : closeHelp()));
	$("arch-help-close").addEventListener("click", closeHelp);
	document.addEventListener("keydown", (e) => {
		const drawer = $("arch-help");
		if (e.key === "Escape" && !drawer.hidden) {
			closeHelp();
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			if (mode === "install" && !$("install-generate").disabled) {
				e.preventDefault();
				generateNow();
			}
			return;
		}
		if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
			e.preventDefault();
			if (drawer.hidden) openHelp();
			else closeHelp();
		}
	});

	// Initial render
	onFormInput();
	renderInstall();
	renderFstabRows();
	renderFstabOutput();
	setMode(modeFromHash() || "install", { writeHash: false });
}

init();
