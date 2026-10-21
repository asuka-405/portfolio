// Certification campaign splitter: identity CSV -> campaigns that stay under a size limit.
// SailPoint's SEARCH campaign accepts searchCampaignInfo.identityIds (a direct list of identities) and
// one of type IDENTITY or ACCESS, so each chunk becomes its own campaign with its own identity list.

import { parseCsv } from "./csv.js";
import { CAMPAIGN_SCRIPT } from "./kit-templates.js";

/**
 * @param {string} csvText   needs an "id" or "uid" column; other columns can be used to group
 * @param {object} o
 * @param {string[]} o.groupBy       columns to group on (may be empty)
 * @param {number} o.maxSize         budget per campaign
 * @param {string} [o.weightColumn]  numeric column counted against the budget (e.g. access items); default 1 per identity
 * @param {string} o.namePrefix
 * @param {string} [o.description]
 * @param {string} [o.deadline]      ISO date-time; blank leaves a placeholder
 * @param {"IDENTITY"|"ACCESS"} [o.searchType]
 * @param {object[]} [o.accessConstraints]  passed through for ACCESS campaigns
 * @param {{type:"IDENTITY"|"GOVERNANCE_GROUP", name:string}} [o.reviewer]
 */
export function splitCampaigns(csvText, o) {
	const { headers, rows } = parseCsv(csvText);
	const problems = [];
	const idCol = headers.includes("id") ? "id" : headers.includes("uid") ? "uid" : null;
	if (!idCol) return { ok: false, problems: [{ line: 1, message: 'Need an "id" column (ISC identity id) or a "uid" column (resolved at deploy time).' }], campaigns: [], files: [], summary: null };
	const groupBy = (o.groupBy || []).filter((c) => headers.includes(c));
	for (const c of o.groupBy || []) if (!headers.includes(c)) problems.push({ line: 1, message: `Group column "${c}" is not in the CSV.` });
	const maxSize = Math.max(1, Number(o.maxSize) || 5000);
	const wcol = o.weightColumn && headers.includes(o.weightColumn) ? o.weightColumn : "";

	const seen = new Set();
	const groups = new Map();
	rows.forEach((r, i) => {
		const line = i + 2;
		const id = r[idCol];
		if (!id) { problems.push({ line, message: `Empty ${idCol}.` }); return; }
		if (seen.has(id)) { problems.push({ line, message: `Duplicate ${idCol} "${id}" skipped: an identity must appear in only one campaign.` }); return; }
		seen.add(id);
		let w = 1;
		if (wcol) {
			w = Number(r[wcol]);
			if (!Number.isFinite(w) || w < 0) { problems.push({ line, message: `${wcol} "${r[wcol]}" is not a number; counted as 1.` }); w = 1; }
		}
		if (w > maxSize) problems.push({ line, message: `${idCol} "${id}" alone weighs ${w}, over the limit ${maxSize}. It gets a campaign of its own and will still be over.` });
		const key = groupBy.map((c) => r[c] || "(blank)").join(" / ") || "All";
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push({ id, w });
	});

	const campaigns = [];
	for (const [key, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
		// first-fit decreasing bin packing keeps campaign count low when weights vary
		const sorted = wcol ? [...list].sort((a, b) => b.w - a.w) : list;
		const bins = [];
		for (const it of sorted) {
			const bin = bins.find((b) => b.total + it.w <= maxSize);
			if (bin) { bin.items.push(it); bin.total += it.w; }
			else bins.push({ items: [it], total: it.w });
		}
		bins.forEach((b, i) => campaigns.push({ group: key, part: i + 1, parts: bins.length, total: b.total, ids: b.items.map((x) => x.id) }));
	}

	const searchType = o.searchType === "ACCESS" ? "ACCESS" : "IDENTITY";
	const payloads = campaigns.map((c) => {
		const name = `${o.namePrefix || "Certification"} - ${c.group}${c.parts > 1 ? ` (${c.part} of ${c.parts})` : ""}`;
		const info = {
			type: searchType,
			description: `${c.ids.length} identities${wcol ? `, weight ${c.total}` : ""}. Group: ${c.group}.`,
			[idCol === "id" ? "identityIds" : "_identityUids"]: c.ids,
		};
		if (o.reviewer && o.reviewer.name) info.reviewer = { type: o.reviewer.type || "IDENTITY", _lookup: { name: o.reviewer.name } };
		if (searchType === "ACCESS" && o.accessConstraints && o.accessConstraints.length) info.accessConstraints = o.accessConstraints;
		return {
			name,
			description: o.description || "Split campaign",
			deadline: o.deadline || "<<set a future deadline>>",
			type: "SEARCH",
			emailNotificationEnabled: true,
			autoRevokeAllowed: false,
			recommendationsEnabled: false,
			searchCampaignInfo: info,
		};
	});
	if (searchType === "ACCESS" && !(o.accessConstraints && o.accessConstraints.length)) problems.push({ line: 1, level: "warn", message: "ACCESS campaigns normally need accessConstraints (the roles, access profiles or entitlements to review). Add them before deploying." });
	const over = campaigns.filter((c) => c.total > maxSize).length;
	return {
		ok: true,
		problems,
		campaigns,
		payloads,
		summary: { identities: seen.size, groups: groups.size, campaigns: campaigns.length, largest: Math.max(0, ...campaigns.map((c) => c.total)), overLimit: over, weighted: !!wcol, maxSize },
		files: [
			{ path: "campaigns/plan.json", content: JSON.stringify({ idColumn: idCol, campaigns: payloads }, null, 2) + "\n" },
			{ path: "campaigns/campaigns.mjs", content: CAMPAIGN_SCRIPT },
		],
	};
}
