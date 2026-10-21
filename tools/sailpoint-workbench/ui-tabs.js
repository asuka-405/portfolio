// Module navigation: the sidebar is a vertical tablist. The active module lives in the URL hash
// (#migrate, #gaps, #transforms, #entitlements, #campaigns). Feature modules never import this file's
// callers; they only call activateTab and setBadge, so there is no import cycle.

import { $, bindTablist } from "./ui-common.js";

const MODULES = ["migrate", "gaps", "transforms", "entitlements", "campaigns"];
let current = "";
let onChangeFn = () => {};

const tabEl = (id) => $(`tab-${id}`);
const panelEl = (id) => $(`panel-${id}`);
const sideEl = () => document.querySelector(".wb-side");

export const currentModule = () => current;

function fromHash() {
	const id = location.hash.replace(/^#/, "");
	return MODULES.includes(id) ? id : null;
}

export function activateTab(id, { focus = false, writeHash = true } = {}) {
	if (!MODULES.includes(id)) return;
	const changed = id !== current;
	current = id;
	for (const m of MODULES) {
		const on = m === id;
		const b = tabEl(m);
		b.setAttribute("aria-selected", String(on));
		b.tabIndex = on ? 0 : -1;
		panelEl(m).hidden = !on;
	}
	if (focus) tabEl(id).focus();
	if (writeHash && location.hash !== `#${id}`) location.hash = id;
	if (changed) onChangeFn(id);
}

// Shows a count next to a module (for example the number of converted objects). Pass null to clear.
export function setBadge(id, text) {
	const el = $(`count-${id}`);
	if (!el) return;
	el.textContent = text === null || text === undefined ? "" : String(text);
	el.hidden = text === null || text === undefined || text === "";
	el.title = el.hidden ? "" : `${text} results`;
}

// Sidebar collapse: icons only. Starts collapsed on narrow screens. Under 640px the CSS turns it into a strip.
function bindSidebarToggle() {
	const side = sideEl();
	const btn = $("wb-side-toggle");
	const label = btn.querySelector(".wb-side-toggle-label");
	const arrow = btn.querySelector("span");
	const narrow = window.matchMedia("(max-width: 899px)");
	const apply = (collapsed) => {
		side.classList.toggle("is-icons", collapsed);
		btn.setAttribute("aria-expanded", String(!collapsed));
		label.textContent = collapsed ? "Expand" : "Collapse";
		arrow.textContent = collapsed ? "»" : "«";
	};
	apply(narrow.matches);
	btn.addEventListener("click", () => apply(!side.classList.contains("is-icons")));
	narrow.addEventListener("change", (e) => apply(e.matches));
}

export function initTabs(onChange) {
	onChangeFn = onChange || (() => {});
	const list = document.querySelector(".wb-tabs");
	const tabs = MODULES.map(tabEl);
	bindTablist(
		list,
		tabs,
		(t, opts) => activateTab(t.dataset.tab, { focus: opts.focus, writeHash: true }),
		"both",
	);
	window.addEventListener("hashchange", () => {
		const id = fromHash();
		if (id) activateTab(id, { writeHash: false });
	});
	bindSidebarToggle();
	activateTab(fromHash() || "migrate", { writeHash: false });
}
