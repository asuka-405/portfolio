// Entry point for the ISC workbench. Each module lives in its own ui-*.js file.
// Runs fully in the browser. Text from files, CSV, JSON or engine output goes through textContent. No innerHTML.

import { initTabs } from "./ui-tabs.js";
import { initShell } from "./ui-help.js";
import { initMigrate } from "./ui-migrate.js";
import { initGaps, renderGaps } from "./ui-gaps.js";
import { initTransforms, renderTransforms } from "./ui-transforms.js";
import { initEntitlements } from "./ui-entitlements.js";
import { initCampaigns } from "./ui-campaigns.js";

// The site header is in normal flow. Its measured height lets the app fill the rest of the viewport.
function fitShell() {
	const header = document.querySelector(".site-header");
	if (!header) return;
	const set = () => document.documentElement.style.setProperty("--wb-top", `${header.offsetHeight}px`);
	set();
	if ("ResizeObserver" in window) new ResizeObserver(set).observe(header);
	else window.addEventListener("resize", set);
}

// A file dropped outside a drop zone must not open in the browser tab.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

fitShell();

// Modules that derive their view from shared state redraw when shown.
const ON_SHOW = {
	gaps: renderGaps,
	transforms: renderTransforms,
};

initMigrate();
initGaps();
initTransforms();
initEntitlements();
initCampaigns();
initShell();
initTabs((id) => {
	if (ON_SHOW[id]) ON_SHOW[id]();
});
