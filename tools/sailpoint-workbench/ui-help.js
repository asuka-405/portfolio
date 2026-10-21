// Shell overlays: the Help drawer, the Settings popover, and the global keys.
// Both overlays return focus to the button that opened them when they close.

import { $, reduceMotion } from "./ui-common.js";
import { currentModule } from "./ui-tabs.js";

// Ctrl/Cmd+Enter presses this module's main action.
const PRIMARY = {
	migrate: "convert",
	gaps: "gaps-run",
	transforms: "tx-run",
	entitlements: "en-build",
	campaigns: "cp-split",
};

let lastTrigger = null;

function openOverlay(panel, trigger, focusEl) {
	closeOverlays(panel);
	lastTrigger = trigger;
	panel.hidden = false;
	trigger.setAttribute("aria-expanded", "true");
	(focusEl || panel).focus({ preventScroll: true });
}

function closeOverlay(panel, trigger) {
	if (panel.hidden) return;
	panel.hidden = true;
	trigger.setAttribute("aria-expanded", "false");
	if (lastTrigger === trigger) lastTrigger = null;
	trigger.focus({ preventScroll: true });
}

function closeOverlays(except) {
	const help = $("wb-help");
	const settings = $("wb-settings");
	if (help !== except && !help.hidden) closeOverlay(help, $("wb-help-btn"));
	if (settings !== except && !settings.hidden) closeOverlay(settings, $("wb-settings-btn"));
}

export function openHelp() {
	const drawer = $("wb-help");
	const mod = currentModule();
	openOverlay(drawer, $("wb-help-btn"), $("wb-help-close"));
	for (const sec of drawer.querySelectorAll("[data-help]")) {
		sec.classList.toggle("is-current", sec.dataset.help === mod);
	}
	const target = drawer.querySelector(`[data-help="${mod}"]`);
	const body = drawer.querySelector(".wb-drawer-body");
	if (target && body) body.scrollTop = target.offsetTop - body.offsetTop;
	if (target && !reduceMotion()) target.scrollIntoView({ block: "start" });
}

export function initShell() {
	const help = $("wb-help");
	const settings = $("wb-settings");
	const helpBtn = $("wb-help-btn");
	const settingsBtn = $("wb-settings-btn");

	helpBtn.addEventListener("click", () => (help.hidden ? openHelp() : closeOverlay(help, helpBtn)));
	$("wb-help-close").addEventListener("click", () => closeOverlay(help, helpBtn));

	settingsBtn.addEventListener("click", () => {
		if (settings.hidden) openOverlay(settings, settingsBtn, settings.querySelector("input"));
		else closeOverlay(settings, settingsBtn);
	});
	$("wb-settings-close").addEventListener("click", () => closeOverlay(settings, settingsBtn));

	// A click outside an open Settings popover closes it.
	document.addEventListener("pointerdown", (e) => {
		if (settings.hidden) return;
		if (settings.contains(e.target) || settingsBtn.contains(e.target)) return;
		closeOverlay(settings, settingsBtn);
	});

	document.addEventListener("keydown", (e) => {
		const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable='true']");

		if (e.key === "Escape") {
			if (!help.hidden) closeOverlay(help, helpBtn);
			else if (!settings.hidden) closeOverlay(settings, settingsBtn);
			return;
		}

		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			const btn = $(PRIMARY[currentModule()] || "");
			if (btn && !btn.disabled && !btn.hidden) {
				e.preventDefault();
				btn.click();
			}
			return;
		}

		if (e.key === "?" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			if (help.hidden) openHelp();
		}
	});
}
