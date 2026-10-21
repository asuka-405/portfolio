#!/usr/bin/env node
// Deploys the objects in manifest.json to a SailPoint Identity Security Cloud tenant.
// Node 18+, no dependencies. Dry run by default.
//
//   export ISC_BASE_URL=https://TENANT.api.identitynow.com
//   export ISC_CLIENT_ID=...  ISC_CLIENT_SECRET=...
//   node deploy.mjs                      # dry run: lists what would be created
//   node deploy.mjs --apply --stage 1    # transforms, sources, schemas, policies, schedules, identity profiles
//   node deploy.mjs --apply --stage 2    # access profiles, roles, SOD policies (needs aggregated entitlements)
//
// Existing objects (matched by name) are left alone. Secrets come from the SECRET__* variables in manifest.json.

import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (n) => args.includes("--" + n);
const opt = (n, d) => {
	const i = args.indexOf("--" + n);
	return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const APPLY = flag("apply");
const STAGE = opt("stage", "all");
const ONLY = opt("only", "");
const manifest = JSON.parse(fs.readFileSync(opt("manifest", new URL("./manifest.json", import.meta.url)), "utf8"));
const BASE = (process.env.ISC_BASE_URL || "").replace(/\/+$/, "");

let token = "";
const cache = { identity: new Map(), source: new Map(), accessProfile: new Map(), entitlement: new Map() };
const log = [];
const say = (tag, msg) => {
	console.log("[" + tag + "] " + msg);
	log.push({ tag, msg });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

async function login() {
	if (!BASE || !process.env.ISC_CLIENT_ID || !process.env.ISC_CLIENT_SECRET) {
		throw new Error("Set ISC_BASE_URL, ISC_CLIENT_ID and ISC_CLIENT_SECRET.");
	}
	const res = await fetch(BASE + "/oauth/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: process.env.ISC_CLIENT_ID,
			client_secret: process.env.ISC_CLIENT_SECRET,
		}),
	});
	if (!res.ok) throw new Error("Token request failed: " + res.status + " " + (await res.text()));
	token = (await res.json()).access_token;
}

async function api(method, path, body, allow404) {
	for (let attempt = 0; attempt < 5; attempt++) {
		const res = await fetch(BASE + path, {
			method,
			headers: { authorization: "Bearer " + token, "content-type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (res.status === 429) {
			await sleep((Number(res.headers.get("retry-after")) || 2) * 1000);
			continue;
		}
		if (res.status === 404 && allow404) return null;
		const txt = await res.text();
		if (!res.ok) throw new Error(method + " " + path + " -> " + res.status + " " + txt.slice(0, 600));
		return txt ? JSON.parse(txt) : {};
	}
	throw new Error("Rate limited: " + method + " " + path);
}

async function findByName(path, name) {
	const list = await api("GET", path + "?filters=" + encodeURIComponent('name eq "' + q(name) + '"') + "&limit=1");
	return Array.isArray(list) && list.length ? list[0] : null;
}

async function search(index, query) {
	const r = await api("POST", "/v3/search?limit=5", { indices: [index], query: { query } });
	return Array.isArray(r) ? r : [];
}

async function identityId(name) {
	if (cache.identity.has(name)) return cache.identity.get(name);
	const hits = await search("identities", 'attributes.uid.exact:"' + q(name) + '" OR name.exact:"' + q(name) + '"');
	if (!hits.length) throw new Error('Identity "' + name + '" not found');
	cache.identity.set(name, hits[0].id);
	return hits[0].id;
}
async function sourceId(name) {
	if (cache.source.has(name)) return cache.source.get(name);
	const s = await findByName("/v3/sources", name);
	if (!s) throw new Error('Source "' + name + '" not found (run stage 1 first)');
	cache.source.set(name, s.id);
	return s.id;
}
async function accessProfileId(name) {
	if (cache.accessProfile.has(name)) return cache.accessProfile.get(name);
	const a = await findByName("/v3/access-profiles", name);
	if (!a) throw new Error('Access profile "' + name + '" not found');
	cache.accessProfile.set(name, a.id);
	return a.id;
}
async function entitlementId(l) {
	const key = [l.source, l.attribute, l.value].join("\u0000");
	if (cache.entitlement.has(key)) return cache.entitlement.get(key);
	const hits = await search("entitlements", 'source.name:"' + q(l.source) + '" AND attribute:"' + q(l.attribute) + '" AND value:"' + q(l.value) + '"');
	const hit = hits.find((h) => h.value === l.value) || hits[0];
	if (!hit) throw new Error("Entitlement " + l.attribute + "=" + l.value + " not found on " + l.source + " (aggregate the source first)");
	cache.entitlement.set(key, hit.id);
	return hit.id;
}

// Walk a body and swap name references for ids.
async function resolve(node) {
	if (Array.isArray(node)) {
		const out = [];
		for (const n of node) {
			const r = await resolve(n);
			if (Array.isArray(r) && n && n._expandBundle) out.push(...r);
			else out.push(r);
		}
		return out;
	}
	if (!node || typeof node !== "object") return node;
	if (node._lookup) return { type: "ENTITLEMENT", id: await entitlementId(node._lookup) };
	if (node._expandBundle) return expandBundle(node._expandBundle);
	const out = {};
	for (const [k, v] of Object.entries(node)) out[k] = await resolve(v);
	if (out.type === "IDENTITY" && out.name && !out.id && !out.key) out.id = await identityId(out.name);
	if (out.type === "SOURCE" && out.name && !out.id) out.id = await sourceId(out.name);
	if (out.type === "ACCESS_PROFILE" && out.name && !out.id) out.id = await accessProfileId(out.name);
	if (out.key && out.key.sourceName) {
		out.key = { ...out.key, sourceId: await sourceId(out.key.sourceName) };
		delete out.key.sourceName;
	}
	return out;
}

async function expandBundle(name) {
	const out = [];
	const seen = new Set();
	const add = async (n) => {
		if (seen.has(n)) return;
		seen.add(n);
		for (const s of manifest.steps) {
			if (s.kind === "access-profile" && (s.name === n || s.name.startsWith(n + " - "))) {
				for (const e of s.body.entitlements || []) if (e._lookup) out.push({ type: "ENTITLEMENT", id: await entitlementId(e._lookup) });
			} else if (s.kind === "role" && s.name === n) {
				for (const ap of s.body.accessProfiles || []) await add(ap.name);
			}
		}
	};
	await add(name);
	if (!out.length) throw new Error('No entitlements found for role "' + name + '" while building the SOD policy');
	return out;
}

const NAME_PATHS = {
	transform: "/v3/transforms",
	source: "/v3/sources",
	"identity-profile": "/v3/identity-profiles",
	"access-profile": "/v3/access-profiles",
	role: "/v3/roles",
	"sod-policy": "/v3/sod-policies",
};

function secretsFor(step) {
	const body = JSON.parse(JSON.stringify(step.body));
	for (const s of manifest.secrets || []) {
		if (s.source !== step.name) continue;
		if (process.env[s.env]) body.connectorAttributes[s.attribute] = process.env[s.env];
		else say("WARN", step.name + ": no value in " + s.env + " for " + s.attribute);
	}
	return body;
}

async function run(step) {
	const label = step.kind + " " + step.name;
	const raw = JSON.stringify(step.body);
	if (raw.includes("<<")) {
		say("SKIP", label + ": unresolved <<placeholder>> in body, edit it in manifest.json");
		return "skipped";
	}
	if (!APPLY) {
		say("PLAN", label + "  " + step.method + " " + step.path);
		return "planned";
	}

	if (step.kind === "source-schema") {
		const sid = await sourceId(step.path.replace(/^\{source:|\}$/g, ""));
		const existing = await api("GET", "/v3/sources/" + sid + "/schemas");
		for (const want of step.body) {
			const have = (existing || []).find((s) => s.name === want.name);
			if (have) await api("PUT", "/v3/sources/" + sid + "/schemas/" + have.id, { ...have, ...want, id: have.id });
			else await api("POST", "/v3/sources/" + sid + "/schemas", want);
		}
		say("OK", label + " (" + step.body.length + " schema(s))");
		return "done";
	}

	const path = await replaceSourceTokens(step.path);

	if (step.kind === "identity-attribute") {
		const have = await api("GET", "/beta/identity-attributes/" + encodeURIComponent(step.body.name), undefined, true);
		if (have) {
			say("SKIP", label + " exists");
			return "exists";
		}
	} else if (step.kind === "correlation") {
		const have = await api("GET", path, undefined, true);
		if (!have) {
			say("SKIP", label + ": source has no correlation config yet; set it in the UI once");
			return "skipped";
		}
		await api("PUT", path, { ...have, attributeAssignments: step.body.attributeAssignments });
		say("OK", label);
		return "done";
	} else if (NAME_PATHS[step.kind]) {
		const have = await findByName(NAME_PATHS[step.kind], step.body.name);
		if (have) {
			if (step.kind === "source") cache.source.set(step.body.name, have.id);
			say("SKIP", label + " exists (" + have.id + ")");
			return "exists";
		}
	}

	const body = await resolve(step.kind === "source" ? secretsFor(step) : step.body);
	const res = await api(step.method, path, body);
	if (step.kind === "source" && res && res.id) cache.source.set(step.body.name, res.id);
	if (step.kind === "access-profile" && res && res.id) cache.accessProfile.set(step.body.name, res.id);
	say("OK", label + (res && res.id ? " (" + res.id + ")" : ""));
	return "done";
}

async function replaceSourceTokens(p) {
	const m = p.match(/\{source:([^}]+)\}/);
	if (!m) return p;
	return p.replace(m[0], await sourceId(m[1]));
}

(async () => {
	if (APPLY) await login();
	let failures = 0;
	for (const step of manifest.steps) {
		if (STAGE !== "all" && String(step.stage) !== STAGE) continue;
		if (ONLY && step.kind !== ONLY) continue;
		try {
			await run(step);
		} catch (e) {
			failures++;
			say("FAIL", step.kind + " " + step.name + ": " + e.message);
		}
	}
	for (const p of manifest.placeholders || []) say("NOTE", "file still holds placeholders: " + p);
	fs.writeFileSync("deploy-result.json", JSON.stringify(log, null, 2));
	console.log(APPLY ? (failures ? failures + " step(s) failed. See deploy-result.json." : "Done.") : "Dry run only. Re-run with --apply to make changes.");
	process.exit(failures ? 1 : 0);
})().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
