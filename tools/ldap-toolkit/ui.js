// Entry point for the LDAP toolkit. Four sub-tabs (filter, dn, recipes, uac) share one page.
// Runs fully in the browser. Engine output and user text go through textContent or h(), never HTML string parsing.

import {
	$,
	h,
	setStatus,
	storageGet,
	storageSet,
	copyButton,
	bindTablist,
	setInlineError,
	errText,
	plural,
} from "../shared/kit.js";
import {
	LdapError,
	parseFilter,
	formatFilter,
	prettyFilter,
	explainFilter,
	escapeFilterValue,
	unescapeFilterValue,
	analyzeDn,
	normalizeDn,
	sameDn,
	escapeDnValue,
	unescapeDnValue,
	domainToDn,
	dnToDomain,
	RECIPES,
	buildRecipe,
	UAC_FLAGS,
	decodeUac,
	encodeUac,
	parseDirectoryTime,
	timeFormats,
	SPECIAL_FILETIMES,
} from "./ldap.js";

// ------------------------------------------------------------------ constants

const TABS = ["filter", "dn", "recipes", "uac"];
const KEY = {
	filter: "ldap-toolkit.filter",
	dn: "ldap-toolkit.dn",
	recipe: "ldap-toolkit.recipe",
	uac: "ldap-toolkit.uac",
	time: "ldap-toolkit.time",
};
const DEFAULT_FILTER =
	"(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2))(|(sAMAccountName=svc-*)(mail=*@example.test)))";
const DEFAULT_DN = "CN=Lopez\\, Ana,OU=Sales,OU=Users,DC=example,DC=test";
const DEFAULT_UAC = 66050;
const DEFAULT_TIME = "20260101120000.0Z";

// ------------------------------------------------------------------ small helpers

const debounce = (fn, ms) => {
	let t = 0;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
};

const stored = (key) => {
	const v = storageGet(key);
	return v === null ? null : v;
};

// Heading plus content, used for each part of a result.
const block = (title, ...children) => h("section", { class: "tk-block" }, h("h3", { class: "tool-subhead", text: title }), ...children);

const note = (text) => h("p", { class: "tool-note", text });
const muted = (text) => h("p", { class: "tool-muted", text });
const alertBox = (text) => h("p", { class: "tool-alert", text });

// Single-line value with a Copy button. The button copies the real value; shown text may differ when it is empty.
function item(label, value, shown = value || "(none)") {
	return h(
		"div",
		{ class: "tk-item" },
		h("div", { class: "tk-item-head" }, h("span", { class: "tk-label", text: label }), copyButton(() => value)),
		h("code", { class: "tk-code", text: shown }),
	);
}

// Multi-line value in a pre block with a Copy button.
function pre_item(label, value) {
	return h(
		"div",
		{ class: "tk-item" },
		h("div", { class: "tk-item-head" }, h("span", { class: "tk-label", text: label }), copyButton(() => value)),
		h("pre", { class: "tk-pre", text: value }),
	);
}

// Copy button for a static output element. The text is read when the button is pressed.
function slotCopy(slotId, outId) {
	const slot = $(slotId);
	if (slot) slot.replaceChildren(copyButton(() => $(outId).textContent));
}

// Live conversion: input -> fn -> output. An optional error element shows a thrown message inline.
function wireConversion(inId, outId, fn, errId) {
	const input = $(inId);
	const out = $(outId);
	const err = errId ? $(errId) : null;
	const run = () => {
		try {
			out.textContent = fn(input.value);
			if (err) setInlineError(err, "");
		} catch (e) {
			out.textContent = "";
			if (err) setInlineError(err, errText(e));
		}
	};
	input.addEventListener("input", run);
	run();
}

// ------------------------------------------------------------------ sub-tabs and hash routing

let currentTab = "filter";

function activate(id, { focus = false, writeHash = true } = {}) {
	if (!TABS.includes(id)) return;
	currentTab = id;
	for (const t of TABS) {
		const on = t === id;
		const btn = $(`tab-${t}`);
		btn.setAttribute("aria-selected", String(on));
		btn.tabIndex = on ? 0 : -1;
		$(`panel-${t}`).hidden = !on;
	}
	if (focus) $(`tab-${id}`).focus();
	if (writeHash && location.hash !== `#${id}`) location.hash = id;
}

function tabFromHash() {
	const id = location.hash.replace(/^#/, "");
	return TABS.includes(id) ? id : null;
}

function initTabs() {
	const list = document.querySelector(".wb-subtabs");
	const tabs = TABS.map((t) => $(`tab-${t}`));
	bindTablist(list, tabs, (t, opts) => activate(t.dataset.tab, { focus: opts.focus, writeHash: true }), "horizontal");
	window.addEventListener("hashchange", () => {
		const id = tabFromHash();
		if (id) activate(id, { writeHash: false });
	});
	activate(tabFromHash() || "filter", { writeHash: false });
}

// The shell's height depends on the measured site header.
function fitShell() {
	const header = document.querySelector(".site-header");
	if (!header) return;
	const set = () => document.documentElement.style.setProperty("--wb-top", `${header.offsetHeight}px`);
	set();
	if ("ResizeObserver" in window) new ResizeObserver(set).observe(header);
	else window.addEventListener("resize", set);
}

// ------------------------------------------------------------------ Help drawer

function openHelp() {
	const drawer = $("wb-help");
	const btn = $("wb-help-btn");
	drawer.hidden = false;
	btn.setAttribute("aria-expanded", "true");
	for (const sec of drawer.querySelectorAll("[data-help]")) {
		sec.classList.toggle("is-current", sec.dataset.help === currentTab);
	}
	const target = drawer.querySelector(`[data-help="${currentTab}"]`);
	if (target) target.scrollIntoView({ block: "start" });
	$("wb-help-close").focus({ preventScroll: true });
}

function closeHelp() {
	const drawer = $("wb-help");
	if (drawer.hidden) return;
	drawer.hidden = true;
	const btn = $("wb-help-btn");
	btn.setAttribute("aria-expanded", "false");
	btn.focus({ preventScroll: true });
}

function initHelp() {
	$("wb-help-btn").addEventListener("click", () => ($("wb-help").hidden ? openHelp() : closeHelp()));
	$("wb-help-close").addEventListener("click", closeHelp);
	document.addEventListener("keydown", (e) => {
		const typing = e.target && e.target.closest && e.target.closest("input, textarea, select, [contenteditable='true']");
		if (e.key === "Escape") {
			closeHelp();
			return;
		}
		if (e.key === "?" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && $("wb-help").hidden) {
			e.preventDefault();
			openHelp();
		}
	});
}

// ------------------------------------------------------------------ Filter tab

const filterInput = () => $("flt-input");

// Caret display: the source line with a ^ under error.pos. Positions come from the engine, relative to the trimmed text.
function errorBlock(message, src, pos) {
	const nodes = [alertBox(`Error: ${message}`)];
	if (pos !== null && src !== "") {
		const p = Math.min(Math.max(pos, 0), src.length);
		const before = src.slice(0, p);
		const lineStart = before.lastIndexOf("\n") + 1;
		const lineEndAt = src.indexOf("\n", p);
		const lineEnd = lineEndAt === -1 ? src.length : lineEndAt;
		const line = src.slice(lineStart, lineEnd);
		const col = p - lineStart;
		const lineNo = before.split("\n").length;
		const multi = src.includes("\n");
		nodes.push(
			muted(multi ? `Line ${lineNo}, column ${col + 1}` : `Position ${p + 1}`),
			h("pre", { class: "tk-pre tk-caret", text: `${line}\n${" ".repeat(col)}^` }),
		);
	}
	return nodes;
}

function renderFilter(text) {
	const out = $("flt-result");
	const src = String(text).trim();
	let tree;
	try {
		tree = parseFilter(text);
	} catch (e) {
		const pos = e instanceof LdapError && Number.isInteger(e.pos) ? e.pos : null;
		out.replaceChildren(...errorBlock(errText(e), src, pos));
		setStatus(`Filter error: ${errText(e)}`);
		return;
	}
	const normal = formatFilter(tree);
	const pretty = prettyFilter(tree);
	const { lines, advice } = explainFilter(tree);
	out.replaceChildren(
		block("Normalized", item("Filter", normal)),
		block("Pretty", pre_item("Indented", pretty)),
		block("What it means", h("pre", { class: "tk-pre", text: lines.join("\n") })),
		block(
			"Advice",
			advice.length
				? h("ul", { class: "tk-list" }, advice.map((a) => h("li", { text: a })))
				: muted("No advice for this filter."),
		),
	);
	setStatus("Filter parses.");
}

function initFilter() {
	const input = filterInput();
	input.value = stored(KEY.filter) ?? DEFAULT_FILTER;
	const update = debounce(() => renderFilter(input.value), 200);
	input.addEventListener("input", () => {
		storageSet(KEY.filter, input.value);
		update();
	});
	renderFilter(input.value);

	wireConversion("flt-esc-in", "flt-esc-out", (v) => escapeFilterValue(v));
	wireConversion("flt-unesc-in", "flt-unesc-out", (v) => unescapeFilterValue(v), "flt-unesc-err");
	slotCopy("flt-esc-copy", "flt-esc-out");
	slotCopy("flt-unesc-copy", "flt-unesc-out");
}

// ------------------------------------------------------------------ DN tab

function renderDn(text) {
	const out = $("dn-result");
	if (!String(text).trim()) {
		out.replaceChildren(muted("Enter a distinguished name."));
		setStatus("");
		return;
	}
	let a;
	try {
		a = analyzeDn(text);
	} catch (e) {
		out.replaceChildren(alertBox(`Error: ${errText(e)}`));
		setStatus(`DN error: ${errText(e)}`);
		return;
	}
	const rdnRows = a.rdns.map((r, i) =>
		h(
			"tr",
			null,
			h("td", { text: i === 0 ? `${i + 1} (leaf)` : String(i + 1) }),
			h("td", { text: r.multi ? `${r.type} (multi-valued)` : r.type }),
			h("td", { class: "tk-wrap", text: r.value }),
		),
	);
	const table = h(
		"div",
		{ class: "tool-table-wrap" },
		h(
			"table",
			{ class: "tool-table" },
			h("caption", { class: "tool-sr-only", text: "RDNs from leaf to base" }),
			h(
				"thead",
				null,
				h(
					"tr",
					null,
					h("th", { scope: "col", text: "Position" }),
					h("th", { scope: "col", text: "Type" }),
					h("th", { scope: "col", text: "Value" }),
				),
			),
			h("tbody", null, rdnRows),
		),
	);
	const warnings = a.warnings.length
		? h("ul", { class: "tk-list" }, a.warnings.map((w) => h("li", { text: w })))
		: muted("No warnings.");
	const chain = a.parents.length
		? h(
				"ol",
				{ class: "tk-list" },
				a.parents.map((p) => h("li", null, item("Parent", p))),
			)
		: muted("No parents: this is the base of the tree.");

	out.replaceChildren(
		block(`Parts (${plural(a.depth, "RDN")})`, table),
		block("Names", item("Normalized (for comparison)", a.normalized), item("Formatted", a.formatted), item("Canonical name", a.canonical), item("DNS domain", a.dnsDomain)),
		block("Parent chain", chain),
		block("Warnings", warnings),
	);
	setStatus(`DN parses: ${plural(a.depth, "RDN")}.`);
}

function renderCompare() {
	const a = $("dn-cmp-a").value;
	const b = $("dn-cmp-b").value;
	const out = $("dn-cmp-result");
	if (!a.trim() || !b.trim()) {
		out.textContent = "Enter two DNs to compare.";
		return;
	}
	try {
		normalizeDn(a);
		normalizeDn(b);
	} catch (e) {
		out.textContent = `Cannot compare: ${errText(e)}`;
		return;
	}
	out.textContent = sameDn(a, b)
		? "Same: both DNs name the same object after normalization."
		: "Different: the DNs do not match after normalization.";
}

function initDn() {
	const input = $("dn-input");
	input.value = stored(KEY.dn) ?? DEFAULT_DN;
	const update = debounce(() => renderDn(input.value), 200);
	input.addEventListener("input", () => {
		storageSet(KEY.dn, input.value);
		update();
	});
	renderDn(input.value);

	const cmpA = $("dn-cmp-a");
	const cmpB = $("dn-cmp-b");
	cmpA.value = DEFAULT_DN;
	cmpB.value = "cn=lopez\\, ana,ou=sales,ou=users,dc=example,dc=test";
	cmpA.addEventListener("input", renderCompare);
	cmpB.addEventListener("input", renderCompare);
	renderCompare();

	wireConversion("dn-esc-in", "dn-esc-out", (v) => escapeDnValue(v));
	wireConversion("dn-unesc-in", "dn-unesc-out", (v) => unescapeDnValue(v), "dn-unesc-err");
	slotCopy("dn-esc-copy", "dn-esc-out");
	slotCopy("dn-unesc-copy", "dn-unesc-out");

	wireConversion("dom-in", "dom-out", (v) => domainToDn(v));
	wireConversion("dom-dn-in", "dom-dn-out", (v) => dnToDomain(v), "dom-dn-err");
	slotCopy("dom-copy", "dom-out");
	slotCopy("dom-dn-copy", "dom-dn-out");
}

// ------------------------------------------------------------------ AD recipes tab

let recipeFilter = null;

const recipeById = (id) => RECIPES.find((r) => r.id === id) || null;

function readRecipeParams(recipe) {
	const out = {};
	for (const p of recipe.params) out[p.name] = $(`rc-p-${p.name}`).value.trim();
	return out;
}

// Returns a message for the first problem, or null.
function checkRecipeParams(recipe, params) {
	for (const p of recipe.params) {
		const v = params[p.name];
		if (!v) return `Enter a value for ${p.label}.`;
		if (p.name === "days" && !/^[1-9]\d{0,4}$/.test(v)) return "Days must be a whole number from 1 to 99999.";
		if (p.name === "attr" && !/^[A-Za-z][A-Za-z0-9-]*$/.test(v)) return "Attribute must be a name such as department (letters, digits and hyphens).";
	}
	return null;
}

function saveRecipe(id, params) {
	storageSet(KEY.recipe, JSON.stringify({ id, params }));
}

function renderParams(recipe, saved) {
	const box = $("rc-params");
	box.replaceChildren(
		...recipe.params.map((p) => {
			const input = h("input", {
				id: `rc-p-${p.name}`,
				class: "tool-input",
				type: "text",
				autocomplete: "off",
				spellcheck: "false",
			});
			input.value = saved && typeof saved[p.name] === "string" ? saved[p.name] : p.dflt;
			input.addEventListener("input", () => {
				saveRecipe(recipe.id, readRecipeParams(recipe));
				renderRecipe();
			});
			return h("div", { class: "tool-field" }, h("label", { for: `rc-p-${p.name}`, text: p.label }), input);
		}),
	);
}

function renderRecipe() {
	const recipe = recipeById($("rc-select").value);
	const out = $("rc-result");
	const openBtn = $("rc-open");
	recipeFilter = null;
	openBtn.disabled = true;
	if (!recipe) return;

	const params = readRecipeParams(recipe);
	const problem = checkRecipeParams(recipe, params);
	if (problem) {
		out.replaceChildren(alertBox(problem));
		setStatus(problem);
		return;
	}

	let built;
	let tree;
	try {
		built = buildRecipe(recipe.id, params);
		tree = parseFilter(built.filter);
	} catch (e) {
		out.replaceChildren(alertBox(`The generated filter is not valid: ${errText(e)}`));
		setStatus(`Recipe error: ${errText(e)}`);
		return;
	}
	const { lines } = explainFilter(tree);
	recipeFilter = built.filter;
	openBtn.disabled = false;
	out.replaceChildren(
		block("Filter", item("Filter", built.filter)),
		built.note ? note(built.note) : null,
		block("What it means", h("pre", { class: "tk-pre", text: lines.join("\n") })),
	);
	setStatus("Recipe filter generated.");
}

function openInFilter(filter) {
	const input = filterInput();
	input.value = filter;
	storageSet(KEY.filter, filter);
	renderFilter(filter);
	activate("filter", { writeHash: true });
	input.focus();
}

function initRecipes() {
	const select = $("rc-select");
	select.append(...RECIPES.map((r) => h("option", { value: r.id, text: r.label })));

	let saved = null;
	try {
		saved = JSON.parse(stored(KEY.recipe) || "null");
	} catch (e) {
		saved = null;
	}
	const savedRecipe = saved && recipeById(saved.id) ? recipeById(saved.id) : RECIPES[0];
	select.value = savedRecipe.id;
	renderParams(savedRecipe, saved && saved.id === savedRecipe.id ? saved.params : null);

	select.addEventListener("change", () => {
		const recipe = recipeById(select.value);
		if (!recipe) return;
		renderParams(recipe, null);
		saveRecipe(recipe.id, readRecipeParams(recipe));
		renderRecipe();
	});
	$("rc-open").addEventListener("click", () => {
		if (recipeFilter) openInFilter(recipeFilter);
	});
	saveRecipe(savedRecipe.id, readRecipeParams(savedRecipe));
	renderRecipe();
}

// ------------------------------------------------------------------ UAC and time tab

const uacNum = () => $("uac-num");
let uacValue = DEFAULT_UAC;
let uacFlags = [];

function buildUacList() {
	const list = $("uac-list");
	uacFlags = UAC_FLAGS.map(([bit, name]) => {
		const cb = h("input", { type: "checkbox", value: name, id: `uac-flag-${bit}` });
		const state = h("span", { class: "tk-state" });
		const hex = "0x" + bit.toString(16).toUpperCase();
		const row = h(
			"label",
			{ class: "tk-flag", for: `uac-flag-${bit}` },
			cb,
			h("span", { class: "tk-flag-name", text: name }),
			h("span", { class: "tk-flag-hex", text: hex }),
			state,
		);
		cb.addEventListener("change", onFlagToggle);
		return { bit, name, cb, row, state };
	});
	list.replaceChildren(...uacFlags.map((f) => f.row));
}

function renderUac() {
	let d;
	try {
		d = decodeUac(uacValue);
	} catch (e) {
		setInlineError($("uac-err"), errText(e));
		return;
	}
	$("uac-summary").textContent = `Value ${d.value} (${d.hex}). Account is ${d.enabled ? "enabled" : "disabled"}.`;
	$("uac-unknown").textContent = d.unknown
		? `Unknown bits set: ${d.unknown}. They are not in the flag list, and they are kept when you tick flags.`
		: "No unknown bits.";
	for (const f of uacFlags) {
		const set = (d.value & f.bit) === f.bit;
		f.cb.checked = set;
		f.row.classList.toggle("is-set", set);
		f.state.textContent = set ? "Set" : "Not set";
	}
	storageSet(KEY.uac, String(d.value));
	setStatus(`userAccountControl ${d.value}: account is ${d.enabled ? "enabled" : "disabled"}.`);
}

// A tick recomputes the number. Bits this tool does not know are kept from the current value.
function onFlagToggle() {
	const names = uacFlags.filter((f) => f.cb.checked).map((f) => f.name);
	const unknown = decodeUac(uacValue).unknown;
	const keep = unknown ? parseInt(unknown, 16) : 0;
	uacValue = (encodeUac(names) | keep) >>> 0;
	uacNum().value = String(uacValue);
	setInlineError($("uac-err"), "");
	renderUac();
}

function onUacTyped() {
	const raw = uacNum().value.trim();
	if (raw === "") {
		setInlineError($("uac-err"), "Enter a whole number from 0 to 4294967295.");
		return;
	}
	const n = Number(raw);
	try {
		decodeUac(n);
	} catch (e) {
		setInlineError($("uac-err"), errText(e));
		return;
	}
	setInlineError($("uac-err"), "");
	uacValue = n;
	renderUac();
}

function renderTime(text) {
	const out = $("tm-result");
	const src = String(text).trim();
	if (!src) {
		out.replaceChildren(muted("Enter a timestamp."));
		return;
	}
	if (Object.prototype.hasOwnProperty.call(SPECIAL_FILETIMES, src)) {
		out.replaceChildren(note(`Special value: ${src} means ${SPECIAL_FILETIMES[src]}.`));
		setStatus(`Special value: ${SPECIAL_FILETIMES[src]}.`);
		return;
	}
	let parsed;
	let f;
	try {
		parsed = parseDirectoryTime(src);
		f = timeFormats(parsed.date);
	} catch (e) {
		const msg = e instanceof LdapError ? errText(e) : "That value does not map to a valid date.";
		out.replaceChildren(alertBox(`Error: ${msg}`));
		setStatus(`Time error: ${msg}`);
		return;
	}
	out.replaceChildren(
		muted(`Detected: ${parsed.kind}.`),
		item("ISO 8601 (UTC)", f.iso),
		item("Windows FILETIME", f.filetime),
		item("LDAP GeneralizedTime", f.generalized),
		item("Unix seconds", String(f.unixSeconds)),
		item("Unix milliseconds", String(f.unixMs)),
	);
	setStatus(`Timestamp detected as ${parsed.kind}.`);
}

function initUac() {
	buildUacList();

	const saved = Number(stored(KEY.uac));
	const start = stored(KEY.uac) !== null && Number.isInteger(saved) && saved >= 0 && saved <= 0xffffffff ? saved : DEFAULT_UAC;
	uacValue = start;
	uacNum().value = String(start);
	uacNum().addEventListener("input", onUacTyped);
	renderUac();

	const tm = $("tm-input");
	tm.value = stored(KEY.time) ?? DEFAULT_TIME;
	const update = debounce(() => renderTime(tm.value), 200);
	tm.addEventListener("input", () => {
		storageSet(KEY.time, tm.value);
		update();
	});
	renderTime(tm.value);
}

// ------------------------------------------------------------------ start

fitShell();
initTabs();
initHelp();
initFilter();
initDn();
initRecipes();
initUac();
