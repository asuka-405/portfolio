// Runs one JavaScript regex job off the main thread, so a runaway pattern cannot freeze the page.
// The page stops a job that takes longer than its limit by terminating this worker.

import { runJs } from "./regex.js";

// runJs can report the same empty match twice at one position (for example /a*/g on "baa" gives [0,0] twice).
// JavaScript never yields two identical consecutive matches, so dropping them restores the real match list.
function dropRepeatedMatches(matches) {
	const out = [];
	for (const m of matches) {
		const prev = out[out.length - 1];
		if (prev && prev.index === m.index && prev.end === m.end) continue;
		out.push(m);
	}
	return out;
}

self.onmessage = (event) => {
	const { id, pattern, flags, input, replacement } = event.data || {};
	let result;
	try {
		result = runJs({
			pattern: String(pattern ?? ""),
			flags: String(flags ?? ""),
			input: String(input ?? ""),
			replacement: typeof replacement === "string" ? replacement : undefined,
		});
		if (result.ok) result.matches = dropRepeatedMatches(result.matches);
	} catch (err) {
		result = { ok: false, error: err && err.message ? err.message : String(err) };
	}
	self.postMessage({ id, result });
};
