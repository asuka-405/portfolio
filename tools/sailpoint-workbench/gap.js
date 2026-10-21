// Migration gap analysis: scores a converted IIQ export and lists what is hard to move.
// The weights are deliberately visible (WEIGHTS) so the score can be argued with, not trusted blindly.

export const WEIGHTS = {
	"Application (mapped connector)": 1,
	"Application (no ISC connector)": 4,
	"Rule translated to a transform": 0.5,
	"Rule needing manual port": 3,
	"Rule blocked by a cloud-rule restriction": 5,
	"Rule with no ISC equivalent": 1,
	"Workflow": 4,
	"Certification definition": 2,
	"Lifecycle trigger": 2,
	"Policy that is not SOD": 3,
	"SOD policy": 1,
	"Custom object": 3,
	"Form": 2,
	"Business role with rule-based selector": 2,
};

const CROSS_IDENTITY = /\.getManager\s*\(\s*\)|getObjectByName\s*\(\s*Identity\.class|getObjects\s*\(\s*Identity\.class|QueryOptions[\s\S]{0,200}Identity\.class/;

/**
 * @param {ReturnType<import("./engine.js").convert>} result
 * @param {{name:string,text:string}[]} files original files, used for the few checks the engine does not surface
 */
export function analyzeGaps(result, files = []) {
	const findings = [];
	const points = [];
	const add = (risk, title, objects, advice, weightKey, count = objects.length) => {
		if (!count) return;
		findings.push({ risk, title, objects, advice, count });
		points.push({ key: weightKey, count, each: WEIGHTS[weightKey], total: +(WEIGHTS[weightKey] * count).toFixed(1) });
	};
	const items = result.items;
	const names = (arr) => arr.map((i) => `${i.kind}: ${i.name}`);

	const apps = items.filter((i) => i.kind === "Application");
	const noConn = apps.filter((i) => i.status === "manual");
	add("high", "Applications with no ISC connector", names(noConn), "Pick the closest ISC connector, move to Web Services or a SaaS connector, or replace the integration.", "Application (no ISC connector)");
	add("low", "Applications with a mapped connector", names(apps.filter((i) => i.status !== "manual")), "Re-test connection, schema and aggregation on each; connector attribute names are passed through unchanged.", "Application (mapped connector)");

	const rules = items.filter((i) => i.kind === "Rule");
	const blocked = rules.filter((r) => r.blockers && r.blockers.length && r.status !== "unsupported");
	const converted = rules.filter((r) => r.status === "converted" || (r.status === "review" && r.files.some((f) => f.startsWith("transforms/"))));
	const unsupported = rules.filter((r) => r.status === "unsupported");
	const manual = rules.filter((r) => r.status === "manual" && !blocked.includes(r));
	const reviewPorts = rules.filter((r) => r.status === "review" && !converted.includes(r));
	add("high", "Rules blocked by cloud-rule restrictions", names(blocked), "These call context, sailpoint.api, file, network or reflection APIs. Redesign the logic: transforms, workflows or an external service. Cloud rules are deployed through SailPoint, so allow lead time.", "Rule blocked by a cloud-rule restriction");
	add("medium", "Rules needing a manual port", names([...manual, ...reviewPorts.filter((r) => !blocked.includes(r))]), "Port the BeanShell by hand as a cloud or connector rule, or rebuild as a transform.", "Rule needing manual port", manual.length + reviewPorts.filter((r) => !blocked.includes(r)).length);
	add("low", "Rules translated to transforms", names(converted), "Check the notes on each; null handling is the usual difference.", "Rule translated to a transform");
	add("low", "Rules with no ISC equivalent", names(unsupported), "Listeners, activity monitoring and reports are dropped. Confirm nothing depends on them.", "Rule with no ISC equivalent");

	// cross-identity logic is called out separately because forum threads name it as one of the hardest things to replace
	const crossIdentity = [];
	for (const f of files) {
		const re = /<Rule\b[^>]*\bname="([^"]*)"[^>]*>[\s\S]*?<\/Rule>/g;
		let m;
		while ((m = re.exec(f.text))) if (CROSS_IDENTITY.test(m[0])) crossIdentity.push(m[1]);
	}
	if (crossIdentity.length) {
		findings.push({ risk: "high", title: "Cross-identity logic in rules", objects: crossIdentity.map((n) => `Rule: ${n}`), advice: "Logic that reads another identity (for example the manager's attributes) has no declarative equivalent. Use identity attributes populated from the source, or a workflow.", count: crossIdentity.length });
	}

	const by = (k) => items.filter((i) => i.kind === k);
	add("medium", "Workflows", names(by("Workflow")), "ISC workflows are not a superset: loops, rule calls and BeanShell must be redesigned. Only a disabled skeleton is generated.", "Workflow");
	add("medium", "Certification definitions", names(by("Certification")), "Rebuild as campaigns. Exclusion rules map to campaign filters only when the logic is simple.", "Certification definition");
	add("medium", "Lifecycle triggers", names(by("Lifecycle trigger")), "Map to lifecycle states and workflow event triggers.", "Lifecycle trigger");
	add("medium", "Policies that are not SOD", names(by("Policy")), "Non-SOD policy rules have no ISC equivalent; consider SOD policies, request rules or workflows.", "Policy that is not SOD");
	add("low", "SOD policies", names(by("SOD policy")), "Criteria are entitlement based; roles are expanded to entitlements at deploy time.", "SOD policy");
	add("medium", "Custom objects", names(by("Custom")), "Custom objects cannot be migrated. Use the lookup transform, workflow data or an external store.", "Custom object");
	add("medium", "Forms", names(by("Form")), "Rebuild as ISC form definitions.", "Form");
	const selectorRoles = items.filter((i) => i.kind === "Role (business)" && (i.warnings || []).some((w) => /rule, script or population/i.test(w)));
	add("medium", "Roles with rule-based membership", names(selectorRoles), "ISC role membership is declarative criteria or an identity list. Recreate as criteria or fill through a workflow.", "Business role with rule-based selector");

	if (by("Capability").length) findings.push({ risk: "low", title: "Capabilities", objects: names(by("Capability")), advice: "Map to ISC user levels and governance groups.", count: by("Capability").length });
	findings.push({ risk: "high", title: "Plugins and custom task executors", objects: ["Not part of an object export: ask the IIQ team for the list"], advice: "Plugins are not supported in ISC and need a full redesign (workflows, APIs, external services).", count: 0, informational: true });

	const total = +points.reduce((n, p) => n + p.total, 0).toFixed(1);
	const band = total < 25 ? "Lower" : total < 75 ? "Moderate" : "High";
	const order = { high: 0, medium: 1, low: 2 };
	findings.sort((a, b) => order[a.risk] - order[b.risk]);
	return { score: total, band, points, findings, weights: WEIGHTS };
}

export function gapMarkdown(g) {
	const L = ["# IIQ to ISC gap analysis", "", `Complexity score: ${g.score} (${g.band}). The score is the sum of the weighted counts below; it ranks relative effort, it is not a time estimate.`, "", "| Item | Count | Weight | Points |", "|---|---:|---:|---:|"];
	for (const p of g.points) L.push(`| ${p.key} | ${p.count} | ${p.each} | ${p.total} |`);
	L.push("");
	for (const f of g.findings) {
		L.push(`## [${f.risk.toUpperCase()}] ${f.title}${f.count ? ` (${f.count})` : ""}`, "", f.advice, "");
		for (const o of f.objects) L.push(`- ${o}`);
		L.push("");
	}
	return L.join("\n");
}
