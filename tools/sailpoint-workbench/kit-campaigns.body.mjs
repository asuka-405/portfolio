// Creates the split campaigns from plan.json. Campaigns are created but NOT activated: review them in ISC first.
//   node campaigns.mjs               dry run
//   node campaigns.mjs --apply       resolve identities and create the campaigns
const plan = JSON.parse(fs.readFileSync(opt("plan", new URL("./plan.json", import.meta.url)), "utf8"));

async function idsFromUids(uids) {
	const out = [];
	for (let i = 0; i < uids.length; i += 40) {
		const chunk = uids.slice(i, i + 40);
		const query = "attributes.uid.exact:(" + chunk.map((u) => '"' + q(u) + '"').join(" OR ") + ")";
		const hits = await search("identities", query, 250);
		const byUid = new Map(hits.map((h) => [h.attributes && h.attributes.uid, h.id]));
		for (const u of chunk) {
			if (!byUid.has(u)) throw new Error('uid "' + u + '" was not found in ISC');
			out.push(byUid.get(u));
		}
	}
	return out;
}

(async () => {
	if (APPLY) await login();
	let failed = 0;
	for (const c of plan.campaigns) {
		const info = c.searchCampaignInfo;
		const n = (info.identityIds || info._identityUids || []).length;
		if (JSON.stringify(c).includes("<<")) {
			say("SKIP", c.name + ": fill in the <<placeholder>> (deadline) in plan.json");
			continue;
		}
		if (!APPLY) {
			say("PLAN", c.name + "  (" + n + " identities)");
			continue;
		}
		try {
			const body = JSON.parse(JSON.stringify(c));
			const bi = body.searchCampaignInfo;
			if (bi._identityUids) {
				bi.identityIds = await idsFromUids(bi._identityUids);
				delete bi._identityUids;
			}
			if (bi.reviewer && bi.reviewer._lookup) {
				const rname = bi.reviewer._lookup.name;
				const hits = bi.reviewer.type === "GOVERNANCE_GROUP"
					? await api("GET", "/v3/workgroups?filters=" + encodeURIComponent('name eq "' + q(rname) + '"') + "&limit=2")
					: await search("identities", 'name.exact:"' + q(rname) + '"', 2);
				if (hits.length !== 1) throw new Error("Reviewer " + rname + " matched " + hits.length);
				bi.reviewer = { type: bi.reviewer.type, id: hits[0].id, name: rname };
			}
			const res = await api("POST", "/v3/campaigns", body);
			say("OK", c.name + " (" + (res.id || "created") + ")");
		} catch (e) {
			failed++;
			say("FAIL", c.name + ": " + e.message);
		}
	}
	fs.writeFileSync("campaigns-result.json", JSON.stringify(log, null, 2));
	console.log(APPLY ? (failed ? failed + " campaign(s) failed, see campaigns-result.json" : "Done. Campaigns are not activated.") : "Dry run only. Re-run with --apply.");
	process.exit(failed ? 1 : 0);
})().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
