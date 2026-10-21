// Bulk entitlement owner and metadata editor: CSV -> validated plan -> patch script.
// Endpoint facts (SailPoint public OpenAPI): PATCH /beta/entitlements/{id} accepts JSON Patch on /owner,
// /description, /requestable, /privileged, /name and /manuallyUpdatedFields. POST /beta/entitlements/bulk-update
// takes at most 50 ids and only the /requestable and /privileged paths, so owners and descriptions go one by one.

import { parseCsv, toCsv } from "./csv.js";
import { ENTITLEMENT_SCRIPT } from "./kit-templates.js";

export const COLUMNS = ["source", "entitlement", "attribute", "entitlementId", "owner", "description", "requestable", "privileged"];
export const TEMPLATE_CSV = toCsv(COLUMNS, [
	{ source: "Corp AD", entitlement: "CN=FIN-Share-RW,OU=Groups,DC=example,DC=test", attribute: "memberOf", owner: "fin.owner@example.test", description: "Read and write on the finance share.", requestable: "true", privileged: "false" },
	{ source: "Payroll DB", entitlement: "ADMIN", owner: "payroll.owner@example.test", description: "Payroll administrator group." },
]);

const truthy = (v) => (v === "" ? undefined : /^(true|yes|y|1)$/i.test(v) ? true : /^(false|no|n|0)$/i.test(v) ? false : null);

/**
 * @param {string} csvText
 * @param {{ownerKey?: "email"|"uid"|"name"}} opts
 */
export function planEntitlements(csvText, opts = {}) {
	const ownerKey = opts.ownerKey || "email";
	const { headers, rows } = parseCsv(csvText);
	const problems = [];
	const missing = ["owner|description|requestable|privileged"].filter(() => !headers.some((h) => ["owner", "description", "requestable", "privileged"].includes(h)));
	if (!headers.includes("entitlement") && !headers.includes("entitlementId")) problems.push({ line: 1, message: 'Need an "entitlement" column (value) or an "entitlementId" column.' });
	if (missing.length) problems.push({ line: 1, message: "No column to change: add owner, description, requestable or privileged." });
	const unknown = headers.filter((h) => h && !COLUMNS.includes(h));
	if (unknown.length) problems.push({ line: 1, level: "warn", message: `Ignoring unknown column(s): ${unknown.join(", ")}.` });

	const seen = new Map();
	const plan = [];
	rows.forEach((r, i) => {
		const line = i + 2;
		const bad = (m) => problems.push({ line, message: m });
		if (!r.entitlementId && !r.entitlement) return bad("No entitlement or entitlementId.");
		if (!r.entitlementId && !r.source) return bad("A source is needed to find the entitlement (or give entitlementId).");
		const requestable = truthy(r.requestable ?? "");
		const privileged = truthy(r.privileged ?? "");
		if (requestable === null) return bad(`requestable "${r.requestable}" is not true or false.`);
		if (privileged === null) return bad(`privileged "${r.privileged}" is not true or false.`);
		if (r.owner && ownerKey === "email" && !/^[^@\s]+@[^@\s]+$/.test(r.owner)) return bad(`owner "${r.owner}" is not an email address (change the owner lookup, or fix the CSV).`);
		const key = r.entitlementId || `${r.source}\u0000${r.attribute || ""}\u0000${r.entitlement}`;
		if (seen.has(key)) return bad(`Duplicate of line ${seen.get(key)}; the later row would overwrite the earlier one.`);
		seen.set(key, line);
		const ops = [];
		if (r.owner) ops.push({ op: "add", path: "/owner", value: { type: "IDENTITY", _lookup: { by: ownerKey, value: r.owner } } });
		if (r.description) ops.push({ op: "add", path: "/description", value: r.description });
		if (requestable !== undefined) ops.push({ op: "replace", path: "/requestable", value: requestable });
		if (privileged !== undefined) ops.push({ op: "replace", path: "/privileged", value: privileged });
		if (!ops.length) return bad("Nothing to change on this row.");
		plan.push({ line, source: r.source || "", attribute: r.attribute || "", entitlement: r.entitlement || "", entitlementId: r.entitlementId || "", ops });
	});
	const batchable = plan.filter((p) => p.ops.every((o) => o.path === "/requestable" || o.path === "/privileged")).length;
	return {
		plan,
		problems,
		errors: problems.filter((p) => p.level !== "warn").length,
		summary: { rows: rows.length, valid: plan.length, owners: plan.filter((p) => p.ops.some((o) => o.path === "/owner")).length, descriptions: plan.filter((p) => p.ops.some((o) => o.path === "/description")).length, flagOnly: batchable },
		files: [
			{ path: "entitlements/plan.json", content: JSON.stringify({ ownerKey, rows: plan }, null, 2) + "\n" },
			{ path: "entitlements/entitlements.mjs", content: ENTITLEMENT_SCRIPT },
			{ path: "entitlements/input.csv", content: csvText },
		],
	};
}
