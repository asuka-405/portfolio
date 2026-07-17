import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../lib/paths.mjs";

let cachedConfig = null;

/** Reads data/ads-config.json. Returns { enabled: false } if missing so ads are inert by default. */
export async function loadAdsConfig() {
	if (cachedConfig) return cachedConfig;
	try {
		const raw = await fs.readFile(path.join(ROOT, "data", "ads-config.json"), "utf8");
		cachedConfig = JSON.parse(raw);
	} catch {
		cachedConfig = { enabled: false };
	}
	return cachedConfig;
}

/** AdSense loader <script> for <head>, or "" when ads are disabled/unconfigured. */
export function adsHeadScript(config) {
	if (!config.enabled || !config.clientId) return "";
	return `\t\t<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.clientId}" crossorigin="anonymous"></script>`;
}

/** One AdSense <ins> unit for the given slot key, or "" when ads are disabled/slot unset. */
export function adSlotHtml(config, slotKey) {
	if (!config.enabled || !config.clientId) return "";
	const slotId = config.slots?.[slotKey];
	if (!slotId) return "";
	return `\t\t\t<div class="ad-slot reveal">
\t\t\t\t<span class="ad-slot-label">Advertisement</span>
\t\t\t\t<ins class="adsbygoogle"
\t\t\t\t\tstyle="display:block"
\t\t\t\t\tdata-ad-client="${config.clientId}"
\t\t\t\t\tdata-ad-slot="${slotId}"
\t\t\t\t\tdata-ad-format="auto"
\t\t\t\t\tdata-full-width-responsive="true"></ins>
\t\t\t\t<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
\t\t\t</div>`;
}
