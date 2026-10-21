// Shared helpers for the ISC kit scripts: argument parsing, login, rate-limit aware API calls, search.
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (n) => args.includes("--" + n);
const opt = (n, d) => {
	const i = args.indexOf("--" + n);
	return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const APPLY = flag("apply");
const BASE = (process.env.ISC_BASE_URL || "").replace(/\/+$/, "");
let token = "";
const log = [];
const say = (tag, msg) => {
	console.log("[" + tag + "] " + msg);
	log.push({ tag, msg });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

async function login() {
	if (!BASE || !process.env.ISC_CLIENT_ID || !process.env.ISC_CLIENT_SECRET) {
		throw new Error("Set ISC_BASE_URL (https://TENANT.api.identitynow.com), ISC_CLIENT_ID and ISC_CLIENT_SECRET.");
	}
	const res = await fetch(BASE + "/oauth/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.ISC_CLIENT_ID, client_secret: process.env.ISC_CLIENT_SECRET }),
	});
	if (!res.ok) throw new Error("Token request failed: " + res.status + " " + (await res.text()));
	token = (await res.json()).access_token;
}

async function api(method, path, body, contentType) {
	for (let attempt = 0; attempt < 6; attempt++) {
		const res = await fetch(BASE + path, {
			method,
			headers: { authorization: "Bearer " + token, "content-type": contentType || "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (res.status === 429) {
			await sleep((Number(res.headers.get("retry-after")) || 2) * 1000);
			continue;
		}
		const txt = await res.text();
		if (!res.ok) throw new Error(method + " " + path + " -> " + res.status + " " + txt.slice(0, 500));
		return txt ? JSON.parse(txt) : {};
	}
	throw new Error("Rate limited: " + method + " " + path);
}

async function search(index, query, limit) {
	const r = await api("POST", "/v3/search?limit=" + (limit || 10), { indices: [index], query: { query } });
	return Array.isArray(r) ? r : [];
}

const identityCache = new Map();
async function identityId(by, value) {
	const key = by + "\u0000" + value;
	if (identityCache.has(key)) return identityCache.get(key);
	const field = by === "email" ? "attributes.email.exact" : by === "uid" ? "attributes.uid.exact" : "name.exact";
	const hits = await search("identities", field + ':"' + q(value) + '"', 5);
	if (hits.length !== 1) throw new Error("Identity " + by + '="' + value + '" matched ' + hits.length + " identities (need exactly 1)");
	identityCache.set(key, hits[0].id);
	return hits[0].id;
}
