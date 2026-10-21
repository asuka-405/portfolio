// Bulk-edits entitlement owner, description, requestable and privileged from plan.json.
//   node entitlements.mjs                 dry run: resolves nothing, prints the patches
//   node entitlements.mjs --apply         resolves ids, then PATCHes each entitlement
//   node entitlements.mjs --apply --protect   also marks DESCRIPTION as manually updated so aggregation keeps it
const plan = JSON.parse(fs.readFileSync(opt("plan", new URL("./plan.json", import.meta.url)), "utf8"));
const PROTECT = flag("protect");
const PATCH_TYPE = "application/json-patch+json";

async function entitlementId(row) {
	if (row.entitlementId) return row.entitlementId;
	let query = 'source.name:"' + q(row.source) + '" AND value:"' + q(row.entitlement) + '"';
	if (row.attribute) query += ' AND attribute:"' + q(row.attribute) + '"';
	const hits = (await search("entitlements", query, 10)).filter((h) => h.value === row.entitlement);
	if (hits.length !== 1) throw new Error("Entitlement " + row.entitlement + " on " + row.source + " matched " + hits.length + " (need exactly 1; aggregate the source or add attribute/entitlementId)");
	return hits[0].id;
}

async function resolve(value) {
	if (Array.isArray(value)) return Promise.all(value.map(resolve));
	if (!value || typeof value !== "object") return value;
	if (value._lookup) return { type: value.type, id: await identityId(value._lookup.by, value._lookup.value) };
	const out = {};
	for (const [k, v] of Object.entries(value)) out[k] = await resolve(v);
	return out;
}

(async () => {
	if (APPLY) await login();
	let failed = 0;
	for (const row of plan.rows) {
		const label = "line " + row.line + " " + (row.entitlementId || row.source + ": " + row.entitlement);
		if (!APPLY) {
			say("PLAN", label + "  " + row.ops.map((o) => o.op + " " + o.path).join(", "));
			continue;
		}
		try {
			const id = await entitlementId(row);
			const ops = await resolve(row.ops);
			if (PROTECT && row.ops.some((o) => o.path === "/description")) {
				const current = await api("GET", "/beta/entitlements/" + id);
				const merged = Object.assign({}, current.manuallyUpdatedFields || {}, { DESCRIPTION: true });
				ops.push({ op: "replace", path: "/manuallyUpdatedFields", value: merged });
			}
			await api("PATCH", "/beta/entitlements/" + id, ops, PATCH_TYPE);
			say("OK", label + " (" + id + ")");
		} catch (e) {
			failed++;
			say("FAIL", label + ": " + e.message);
		}
	}
	fs.writeFileSync("entitlements-result.json", JSON.stringify(log, null, 2));
	console.log(APPLY ? (failed ? failed + " row(s) failed, see entitlements-result.json" : "Done.") : "Dry run only. Re-run with --apply.");
	process.exit(failed ? 1 : 0);
})().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
