// Small UI pieces shared by the newer tools: sections, code blocks, finding lists, chips, segmented controls and form fields.
// Text always goes through textContent (h() from kit.js). Nothing here parses HTML.

import { h, downloadText, flash } from "./kit.js";

export const debounce = (fn, ms = 200) => {
	let t = null;
	return (...a) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...a), ms);
	};
};

export function section(title, ...children) {
	return h("section", { class: "fx-sec" }, title ? h("h2", { class: "tool-subhead", text: title }) : null, ...children);
}

/** A titled code block with Copy and Download buttons. */
export function codeBlock({ title, text, filename, mime = "text/plain;charset=utf-8", wrap = false }) {
	const copy = h("button", { class: "btn btn--ghost wb-btn tool-small", type: "button", text: "Copy" });
	copy.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(text);
			flash(copy, "Copied", "Copy");
		} catch (e) {
			flash(copy, "Copy blocked", "Copy");
		}
	});
	const actions = [copy];
	if (filename) {
		const dl = h("button", { class: "btn btn--ghost wb-btn tool-small", type: "button", text: "Download" });
		dl.addEventListener("click", () => downloadText(filename, text, mime));
		actions.push(dl);
	}
	return h(
		"div",
		{ class: "fx-code" },
		h("div", { class: "fx-code-head" }, h("span", { class: "fx-code-title", text: title || filename || "" }), h("span", { class: "fx-code-actions" }, actions)),
		h("pre", { class: `fx-pre${wrap ? " is-wrap" : ""}`, tabindex: "0", text }),
	);
}

const LEVEL = { error: "Error", warn: "Warning", info: "Note" };

/** items: [{level, message, line?, path?}] */
export function findings(items, { empty = "No problems found." } = {}) {
	if (!items.length) return h("p", { class: "fx-ok", text: empty });
	const order = { error: 0, warn: 1, info: 2 };
	return h(
		"ul",
		{ class: "fx-finds" },
		items.map((f) =>
			h(
				"li",
				{ class: `fx-find fx-find--${f.level}` },
				h("span", { class: `tool-tag tool-tag--${f.level === "error" ? "error" : f.level === "warn" ? "warn" : "info"} fx-level`, text: LEVEL[f.level] || f.level }),
				f.line ? h("span", { class: "fx-where", text: `line ${f.line}` }) : f.path ? h("code", { class: "fx-where", text: f.path }) : null,
				h("span", { class: "fx-msg", text: f.message }),
			),
		),
	);
}

export function countPills(items) {
	const c = { error: 0, warn: 0, info: 0 };
	for (const i of items) c[i.level] = (c[i.level] || 0) + 1;
	return h(
		"div",
		{ class: "fx-pills" },
		h("span", { class: "fx-pill fx-pill--error", text: `${c.error} error${c.error === 1 ? "" : "s"}` }),
		h("span", { class: "fx-pill fx-pill--warn", text: `${c.warn} warning${c.warn === 1 ? "" : "s"}` }),
		h("span", { class: "fx-pill fx-pill--info", text: `${c.info} note${c.info === 1 ? "" : "s"}` }),
	);
}

/** Row of small buttons; each calls onPick(item). item: {label, ...} */
export function chips(items, onPick, { label = "Examples" } = {}) {
	return h(
		"div",
		{ class: "fx-chips", role: "group", "aria-label": label },
		items.map((it) => {
			const b = h("button", { class: "fx-chip", type: "button", text: it.label, title: it.title || null });
			b.addEventListener("click", () => onPick(it));
			return b;
		}),
	);
}

/** Radio group drawn as joined buttons. Returns {el, get, set}. */
export function segmented(name, options, value, onChange) {
	const el = h("div", { class: "fx-seg", role: "radiogroup" });
	const inputs = [];
	for (const o of options) {
		const input = h("input", { type: "radio", name, value: o.value, class: "tool-sr-only" });
		if (o.value === value) input.checked = true;
		input.addEventListener("change", () => onChange && onChange(o.value));
		inputs.push(input);
		el.append(h("label", { class: "fx-seg-item" }, input, h("span", { text: o.label })));
	}
	return { el, get: () => (inputs.find((i) => i.checked) || {}).value, set: (v) => inputs.forEach((i) => { i.checked = i.value === v; }) };
}

let uid = 0;
/**
 * A labelled form control. type: text, textarea, select, number, checkbox.
 * Returns {el, input}. options for select: [{value, label}].
 */
export function field({ label, type = "text", value = "", hint, options, rows = 4, placeholder, mono = false, onInput }) {
	const id = `fx-${++uid}`;
	let input;
	if (type === "textarea") input = h("textarea", { id, class: `tool-input tool-code${mono ? "" : " fx-prose"}`, rows, spellcheck: "false", placeholder });
	else if (type === "select") input = h("select", { id, class: "tool-input" }, options.map((o) => h("option", { value: o.value, text: o.label })));
	else if (type === "checkbox") input = h("input", { id, type: "checkbox" });
	else input = h("input", { id, class: `tool-input${mono ? " fx-mono" : ""}`, type, autocomplete: "off", spellcheck: "false", placeholder });
	if (type === "checkbox") input.checked = !!value;
	else input.value = value;
	if (onInput) input.addEventListener(type === "select" || type === "checkbox" ? "change" : "input", onInput);
	const el =
		type === "checkbox"
			? h("label", { class: "fx-check", for: id }, input, h("span", { text: label }), hint ? h("span", { class: "tool-hint", text: hint }) : null)
			: h("div", { class: "tool-field" }, h("label", { for: id, text: label }), input, hint ? h("span", { class: "tool-hint", text: hint }) : null);
	return { el, input };
}

export function kvTable(rows, { head } = {}) {
	return h(
		"div",
		{ class: "tool-table-wrap" },
		h(
			"table",
			{ class: "tool-table" },
			head ? h("thead", {}, h("tr", {}, head.map((t) => h("th", { scope: "col", text: t })))) : null,
			h("tbody", {}, rows.map((r) => h("tr", {}, r.map((c, i) => (c instanceof Node ? h("td", {}, c) : h(i === 0 && !head ? "th" : "td", { scope: i === 0 && !head ? "row" : null, text: c })))))),
		),
	);
}

export const emptyState = (text, ...actions) => h("div", { class: "wb-empty" }, h("p", { text }), actions.length ? h("div", { class: "tool-row" }, actions) : null);

export function button(text, onClick, { primary = false, small = false } = {}) {
	const b = h("button", { class: `btn ${primary ? "btn--primary" : "btn--ghost"} wb-btn${small ? " tool-small" : ""}`, type: "button", text });
	b.addEventListener("click", onClick);
	return b;
}

/** Wires the Help drawer used by every tool page. */
export function bindHelp(prefix) {
	const help = document.getElementById(`${prefix}-help`);
	const btn = document.getElementById(`${prefix}-help-btn`);
	const close = document.getElementById(`${prefix}-help-close`);
	const set = (open) => {
		help.hidden = !open;
		btn.setAttribute("aria-expanded", open ? "true" : "false");
		(open ? close : btn).focus();
	};
	btn.addEventListener("click", () => set(help.hidden));
	close.addEventListener("click", () => set(false));
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && !help.hidden) set(false);
		else if (e.key === "?" && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) set(help.hidden);
	});
}

/** Reads a dropped or picked text file into a callback. */
export function pickFile(accept, onText) {
	const input = h("input", { type: "file", accept, hidden: true });
	input.addEventListener("change", async () => {
		const f = input.files && input.files[0];
		if (f) onText(await f.text(), f.name);
		input.value = "";
	});
	document.body.append(input);
	return () => input.click();
}
