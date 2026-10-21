// Shared UI helpers for the tools in /tools: DOM builder, downloads, copy, drop zone, status line, tablist.
// Copied from the ISC workbench's ui-common.js.
// Shared helpers for the workbench modules. Runs fully in the browser.
// Text from files, CSV, JSON or engine output always goes through textContent. Never innerHTML.

import { zip } from "./zip.js";

export const $ = (id) => document.getElementById(id);

// Small DOM builder. Strings become text nodes, so nothing is parsed as HTML.
export function h(tag, attrs, ...children) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs || {})) {
		if (v === null || v === undefined || v === false) continue;
		if (k === "class") el.className = v;
		else if (k === "text") el.textContent = String(v);
		else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
		else el.setAttribute(k, v === true ? "" : String(v));
	}
	for (const c of children.flat(Infinity)) {
		if (c === null || c === undefined || c === false) continue;
		el.append(c instanceof Node ? c : document.createTextNode(String(c)));
	}
	return el;
}

export const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const fmtSize = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
export const basename = (path) => path.split("/").pop();
export const errText = (e) => (e && e.message ? e.message : String(e));

// ------------------------------------------------------------------ status line

export function setStatus(text) {
	const el = $("wb-status-msg");
	if (el) el.textContent = text || "";
}

// ------------------------------------------------------------------ module results

// Migrate results shared with Gap analysis and Transform lab: {result, files} or null.
// Live binding: importers read the current value. Only setLastMigration changes it.
// (workbench-only state kept so this file stays a drop-in copy)
export let lastMigration = null;
export function setLastMigration(value) {
	lastMigration = value;
}

// ------------------------------------------------------------------ inline messages

export function setInlineError(el, text) {
	el.textContent = text || "";
	el.hidden = !text;
}

export function parseJson(text) {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch (e) {
		return { ok: false, error: e.message };
	}
}

export const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// ------------------------------------------------------------------ storage (convenience only)

export function storageGet(key) {
	try {
		return localStorage.getItem(key);
	} catch (e) {
		return null;
	}
}

export function storageSet(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch (e) {
		// Storage can be blocked. The page works without it.
	}
}

// ------------------------------------------------------------------ downloads

export function download(name, data, type) {
	const blob = data instanceof Blob ? data : new Blob([data], { type });
	const url = URL.createObjectURL(blob);
	const a = h("a", { href: url, download: name });
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(name, text, type = "text/plain;charset=utf-8") {
	download(name, text, type);
}

export function downloadZip(name, files) {
	const bytes = zip(files);
	download(name, new Blob([bytes], { type: "application/zip" }));
}

// ------------------------------------------------------------------ copy button

export function flash(btn, text, original) {
	btn.textContent = text;
	setTimeout(() => {
		btn.textContent = original;
	}, 1500);
}

export function copyButton(getText, label = "Copy") {
	const btn = h("button", { class: "btn btn--ghost wb-btn", type: "button", text: label });
	btn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(getText());
			flash(btn, "Copied", label);
		} catch (e) {
			flash(btn, "Copy blocked", label);
		}
	});
	return btn;
}

// ------------------------------------------------------------------ drop zone

// Click, Enter/Space and drag and drop all feed onFiles(fileList).
export function bindDropZone(zone, picker, onFiles) {
	zone.addEventListener("click", () => picker.click());
	zone.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			picker.click();
		}
	});
	zone.addEventListener("dragover", (e) => {
		e.preventDefault();
		zone.classList.add("is-over");
	});
	zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
	zone.addEventListener("drop", (e) => {
		e.preventDefault();
		zone.classList.remove("is-over");
		onFiles(e.dataTransfer && e.dataTransfer.files);
	});
	picker.addEventListener("change", (e) => {
		onFiles(e.target.files);
		e.target.value = "";
	});
}

// Reads a file as text. Binary files (NUL bytes) are refused by throwing.
export async function readTextFile(file) {
	const text = await file.text();
	if (text.includes("\u0000")) throw new Error(`${file.name} looks like a binary file`);
	return text;
}

// ------------------------------------------------------------------ tablists

// Roving tabindex for role=tablist. Arrow keys move and activate. Home and End jump to the ends.
// axis "vertical" uses Up/Down, "horizontal" uses Left/Right; both are accepted when axis is "both".
export function bindTablist(list, tabs, onSelect, axis = "horizontal") {
	const keys = axis === "vertical" ? ["ArrowDown", "ArrowUp"] : axis === "both" ? null : ["ArrowRight", "ArrowLeft"];
	list.addEventListener("click", (e) => {
		const t = e.target.closest('[role="tab"]');
		if (t && tabs.includes(t)) onSelect(t, { focus: false });
	});
	list.addEventListener("keydown", (e) => {
		const i = tabs.indexOf(document.activeElement);
		if (i < 0) return;
		let next = null;
		const nextKey = keys ? keys[0] : null;
		const prevKey = keys ? keys[1] : null;
		if (e.key === "Home") next = 0;
		else if (e.key === "End") next = tabs.length - 1;
		else if (e.key === nextKey || (!keys && (e.key === "ArrowDown" || e.key === "ArrowRight"))) next = (i + 1) % tabs.length;
		else if (e.key === prevKey || (!keys && (e.key === "ArrowUp" || e.key === "ArrowLeft"))) next = (i - 1 + tabs.length) % tabs.length;
		if (next === null) return;
		e.preventDefault();
		onSelect(tabs[next], { focus: true });
	});
}
