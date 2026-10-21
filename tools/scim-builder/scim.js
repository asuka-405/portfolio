// SCIM 2.0 helpers (RFC 7643 resources, RFC 7644 protocol). Pure functions, no DOM.
// Builders for User, Group and PATCH bodies, a filter parser with explanation and an evaluator, validators, and curl commands.

export const SCHEMA = {
	user: "urn:ietf:params:scim:schemas:core:2.0:User",
	group: "urn:ietf:params:scim:schemas:core:2.0:Group",
	enterprise: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
	patch: "urn:ietf:params:scim:api:messages:2.0:PatchOp",
	list: "urn:ietf:params:scim:api:messages:2.0:ListResponse",
	error: "urn:ietf:params:scim:api:messages:2.0:Error",
};

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const blank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

function prune(o) {
	if (Array.isArray(o)) return o.map(prune).filter((v) => !(isObj(v) && !Object.keys(v).length) && v !== undefined);
	if (!isObj(o)) return o;
	const out = {};
	for (const [k, v] of Object.entries(o)) {
		if (blank(v)) continue;
		const p = prune(v);
		if (isObj(p) && !Object.keys(p).length) continue;
		if (Array.isArray(p) && !p.length) continue;
		out[k] = p;
	}
	return out;
}

/**
 * @param {object} f flat form fields: userName, externalId, givenName, familyName, formatted, displayName, title, userType, preferredLanguage,
 *   locale, timezone, active, emailWork, emailHome, phoneWork, phoneMobile, employeeNumber, costCenter, organization, division, department, managerId, managerName
 */
export function buildUser(f = {}) {
	const enterprise = prune({
		employeeNumber: f.employeeNumber,
		costCenter: f.costCenter,
		organization: f.organization,
		division: f.division,
		department: f.department,
		manager: { value: f.managerId, displayName: f.managerName },
	});
	const hasEnt = Object.keys(enterprise).length > 0;
	const emails = [];
	if (!blank(f.emailWork)) emails.push({ value: f.emailWork, type: "work", primary: true });
	if (!blank(f.emailHome)) emails.push({ value: f.emailHome, type: "home", primary: blank(f.emailWork) });
	const phones = [];
	if (!blank(f.phoneWork)) phones.push({ value: f.phoneWork, type: "work" });
	if (!blank(f.phoneMobile)) phones.push({ value: f.phoneMobile, type: "mobile" });
	const out = {
		schemas: [SCHEMA.user, ...(hasEnt ? [SCHEMA.enterprise] : [])],
		externalId: f.externalId,
		userName: f.userName,
		name: { givenName: f.givenName, familyName: f.familyName, formatted: f.formatted },
		displayName: f.displayName,
		title: f.title,
		userType: f.userType,
		preferredLanguage: f.preferredLanguage,
		locale: f.locale,
		timezone: f.timezone,
		active: f.active === undefined || f.active === "" ? true : f.active === true || f.active === "true",
		emails,
		phoneNumbers: phones,
	};
	const res = prune(out);
	if (hasEnt) res[SCHEMA.enterprise] = enterprise;
	return res;
}

export function buildGroup({ displayName, externalId, members = [] } = {}) {
	return prune({
		schemas: [SCHEMA.group],
		externalId,
		displayName,
		members: members.map((m) => (typeof m === "string" ? { value: m } : m)),
	});
}

const coerce = (v) => {
	if (typeof v !== "string") return v;
	const t = v.trim();
	if (t === "") return v;
	try {
		return JSON.parse(t);
	} catch (e) {
		return v;
	}
};

/** @param {{op: string, path?: string, value?: string|any}[]} ops value strings that parse as JSON are sent as JSON */
export function buildPatch(ops) {
	return {
		schemas: [SCHEMA.patch],
		Operations: ops.map((o) => {
			const out = { op: o.op };
			if (!blank(o.path)) out.path = o.path.trim();
			if (o.op !== "remove" && o.value !== undefined && !(typeof o.value === "string" && o.value === "")) out.value = coerce(o.value);
			return out;
		}),
	};
}

// ------------------------------------------------------------------ filters (RFC 7644 section 3.4.2.2)

export class FilterError extends Error {
	constructor(message, pos) {
		super(pos === undefined ? message : `${message} (at position ${pos})`);
		this.pos = pos;
	}
}

const COMPARE_OPS = ["eq", "ne", "co", "sw", "ew", "gt", "ge", "lt", "le"];
const OP_WORDS = {
	eq: "equals", ne: "does not equal", co: "contains", sw: "starts with", ew: "ends with", gt: "is greater than", ge: "is greater than or equal to", lt: "is less than", le: "is less than or equal to",
};

function tokenize(src) {
	const toks = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (/\s/.test(c)) { i++; continue; }
		if (c === "(" || c === ")" || c === "[" || c === "]") { toks.push({ k: c, pos: i }); i++; continue; }
		if (c === '"') {
			let j = i + 1, out = "";
			while (j < src.length && src[j] !== '"') {
				if (src[j] === "\\") {
					const n = src[j + 1];
					const map = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", "\\": "\\", '"': '"', "/": "/" };
					if (n === "u") { out += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16)); j += 6; continue; }
					if (!(n in map)) throw new FilterError(`Bad escape \\${n}`, j);
					out += map[n];
					j += 2;
					continue;
				}
				out += src[j++];
			}
			if (src[j] !== '"') throw new FilterError("Unterminated string", i);
			toks.push({ k: "str", v: out, pos: i });
			i = j + 1;
			continue;
		}
		const m = /^[^\s()[\]"]+/.exec(src.slice(i));
		toks.push({ k: "word", v: m[0], pos: i });
		i += m[0].length;
	}
	return toks;
}

class FilterParser {
	constructor(src) {
		this.t = tokenize(src);
		this.i = 0;
		this.len = src.length;
	}
	peek() { return this.t[this.i]; }
	isWord(v) { const t = this.peek(); return t && t.k === "word" && t.v.toLowerCase() === v; }
	fail(msg) { const t = this.peek(); throw new FilterError(msg, t ? t.pos : this.len); }
	parse() {
		if (!this.t.length) this.fail("The filter is empty");
		const e = this.or();
		if (this.peek()) this.fail(`Unexpected "${this.peek().v ?? this.peek().k}"`);
		return e;
	}
	or() {
		let left = this.and();
		while (this.isWord("or")) { this.i++; left = { t: "or", a: left, b: this.and() }; }
		return left;
	}
	and() {
		let left = this.unary();
		while (this.isWord("and")) { this.i++; left = { t: "and", a: left, b: this.unary() }; }
		return left;
	}
	unary() {
		if (this.isWord("not")) {
			this.i++;
			if (!this.peek() || this.peek().k !== "(") this.fail('"not" must be followed by "("');
			this.i++;
			const e = this.or();
			if (!this.peek() || this.peek().k !== ")") this.fail('Missing ")"');
			this.i++;
			return { t: "not", e };
		}
		const p = this.peek();
		if (p && p.k === "(") {
			this.i++;
			const e = this.or();
			if (!this.peek() || this.peek().k !== ")") this.fail('Missing ")"');
			this.i++;
			return e;
		}
		return this.attrExpr();
	}
	attrExpr() {
		const t = this.peek();
		if (!t) this.fail("Expected an attribute");
		if (t.k !== "word") this.fail("Expected an attribute name");
		this.i++;
		const attr = t.v;
		if (!/^[A-Za-z$][A-Za-z0-9$_\-.:]*$/.test(attr)) throw new FilterError(`"${attr}" is not a valid attribute path`, t.pos);
		const n = this.peek();
		if (n && n.k === "[") {
			this.i++;
			const inner = this.or();
			if (!this.peek() || this.peek().k !== "]") this.fail('Missing "]"');
			this.i++;
			return { t: "value", attr, e: inner };
		}
		if (!n) this.fail(`Expected an operator after ${attr}`);
		if (n.k !== "word") this.fail("Expected an operator");
		const op = n.v.toLowerCase();
		this.i++;
		if (op === "pr") return { t: "pr", attr };
		if (!COMPARE_OPS.includes(op)) throw new FilterError(`"${n.v}" is not a filter operator (use ${COMPARE_OPS.join(", ")} or pr)`, n.pos);
		const v = this.peek();
		if (!v) this.fail(`Expected a value after ${op}`);
		this.i++;
		let value;
		if (v.k === "str") value = v.v;
		else if (v.k === "word" && v.v === "true") value = true;
		else if (v.k === "word" && v.v === "false") value = false;
		else if (v.k === "word" && v.v === "null") value = null;
		else if (v.k === "word" && /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(v.v)) value = Number(v.v);
		else throw new FilterError(`The value "${v.v ?? v.k}" must be a quoted string, a number, true, false or null`, v.pos);
		return { t: "cmp", attr, op, value };
	}
}

export function parseFilter(src) {
	return new FilterParser(String(src)).parse();
}

export function explainFilter(ast, prefix = "") {
	const show = (v) => (typeof v === "string" ? `"${v}"` : String(v));
	switch (ast.t) {
		case "pr": return `${prefix}${ast.attr} has a value`;
		case "cmp": return `${prefix}${ast.attr} ${OP_WORDS[ast.op]} ${show(ast.value)}`;
		case "and": return `${explainFilter(ast.a, prefix)}, and ${explainFilter(ast.b, prefix)}`;
		case "or": return `${explainFilter(ast.a, prefix)}, or ${explainFilter(ast.b, prefix)}`;
		case "not": return `it is not true that ${explainFilter(ast.e, prefix)}`;
		case "value": return `some ${ast.attr} entry where ${explainFilter(ast.e)}`;
		default: return "";
	}
}

function getAttr(resource, path) {
	let target = resource;
	let rest = path;
	const urn = /^(urn:.*):([^:]+)$/i.exec(path);
	if (urn) {
		const key = Object.keys(resource).find((k) => k.toLowerCase() === urn[1].toLowerCase());
		if (!key) return undefined;
		target = resource[key];
		rest = urn[2];
	}
	let cur = [target];
	for (const part of rest.split(".")) {
		const next = [];
		for (const c of cur) {
			if (Array.isArray(c)) {
				for (const e of c) if (isObj(e)) { const k = Object.keys(e).find((x) => x.toLowerCase() === part.toLowerCase()); if (k !== undefined) next.push(e[k]); }
			} else if (isObj(c)) {
				const k = Object.keys(c).find((x) => x.toLowerCase() === part.toLowerCase());
				if (k !== undefined) next.push(c[k]);
			}
		}
		cur = next;
	}
	const flat = cur.flat();
	return flat.length ? flat : undefined;
}

function cmpValues(op, actual, expected) {
	if (typeof expected === "string" && typeof actual === "string") {
		const a = actual.toLowerCase(), e = expected.toLowerCase(); // string comparisons are case-insensitive for caseExact=false attributes (the usual case)
		switch (op) {
			case "eq": return a === e;
			case "ne": return a !== e;
			case "co": return a.includes(e);
			case "sw": return a.startsWith(e);
			case "ew": return a.endsWith(e);
			case "gt": return a > e;
			case "ge": return a >= e;
			case "lt": return a < e;
			case "le": return a <= e;
			default: return false;
		}
	}
	switch (op) {
		case "eq": return actual === expected;
		case "ne": return actual !== expected;
		case "gt": return actual > expected;
		case "ge": return actual >= expected;
		case "lt": return actual < expected;
		case "le": return actual <= expected;
		default: return false;
	}
}

/** Evaluates a parsed filter against one resource. String comparisons ignore case. */
export function evalFilter(ast, resource) {
	switch (ast.t) {
		case "and": return evalFilter(ast.a, resource) && evalFilter(ast.b, resource);
		case "or": return evalFilter(ast.a, resource) || evalFilter(ast.b, resource);
		case "not": return !evalFilter(ast.e, resource);
		case "pr": { const v = getAttr(resource, ast.attr); return v !== undefined && v.some((x) => x !== null && x !== "" && !(Array.isArray(x) && !x.length)); }
		case "cmp": { const v = getAttr(resource, ast.attr); if (ast.op === "ne") return v === undefined || v.every((x) => cmpValues("ne", x, ast.value)); return v !== undefined && v.some((x) => cmpValues(ast.op, x, ast.value)); }
		case "value": { const v = getAttr(resource, ast.attr); return v !== undefined && v.some((x) => isObj(x) && evalFilter(ast.e, x)); }
		default: return false;
	}
}

export function filterQuery(src) {
	return `filter=${encodeURIComponent(src)}`;
}

// ------------------------------------------------------------------ PATCH path

const PATH_RE = /^(?:(urn:[A-Za-z0-9:._\-]+):)?([A-Za-z$][A-Za-z0-9$_\-]*)(\[[^\]]+\])?(?:\.([A-Za-z$][A-Za-z0-9$_\-]*))?$/;

/** @returns {{ok: boolean, error?: string, filter?: object, attr?: string, sub?: string}} */
export function parsePatchPath(path) {
	const raw = String(path).trim();
	if (!raw) return { ok: false, error: "The path is empty" };
	const m = PATH_RE.exec(raw);
	if (!m) {
		// a URN alone (a whole extension) is also valid
		if (/^urn:[A-Za-z0-9:._\-]+$/.test(raw)) return { ok: true, attr: raw };
		return { ok: false, error: `"${raw}" is not a valid SCIM path. Use attr, attr.sub or attr[filter].sub` };
	}
	let filter = null;
	if (m[3]) {
		try {
			filter = parseFilter(m[3].slice(1, -1));
		} catch (e) {
			return { ok: false, error: `Filter in the path is invalid: ${e.message}` };
		}
	}
	return { ok: true, urn: m[1], attr: m[2], filter, sub: m[4] };
}

// ------------------------------------------------------------------ validation

/** @returns {{level: "error"|"warn"|"info", path: string, message: string}[]} */
export function validatePatch(obj) {
	const out = [];
	const add = (level, path, message) => out.push({ level, path, message });
	if (!isObj(obj)) return [{ level: "error", path: "$", message: "A PATCH body must be a JSON object." }];
	if (!Array.isArray(obj.schemas) || !obj.schemas.includes(SCHEMA.patch)) add("error", "schemas", `schemas must contain "${SCHEMA.patch}".`);
	if (!Array.isArray(obj.Operations)) { add("error", "Operations", 'The array "Operations" (capital O) is required.'); return out; }
	if (!obj.Operations.length) add("error", "Operations", "Operations must hold at least one operation.");
	if ("operations" in obj) add("warn", "operations", 'The key is "Operations" with a capital O.');
	obj.Operations.forEach((o, i) => {
		const p = `Operations[${i}]`;
		if (!isObj(o)) { add("error", p, "An operation must be an object."); return; }
		const opRaw = o.op;
		const op = typeof opRaw === "string" ? opRaw.toLowerCase() : "";
		if (!["add", "remove", "replace"].includes(op)) { add("error", `${p}.op`, `op must be add, remove or replace (got ${JSON.stringify(opRaw)}).`); }
		else if (opRaw !== op) add("info", `${p}.op`, `"${opRaw}" is accepted by servers that compare case-insensitively (the RFC does), but the lower-case form is the safest. Microsoft Entra sends capitalised values.`);
		if (op === "remove" && blank(o.path)) add("error", `${p}.path`, "remove needs a path.");
		if (op === "remove" && "value" in o) add("warn", `${p}.value`, "remove normally has no value. Some servers use it to name members to remove.");
		if ((op === "add" || op === "replace") && !("value" in o)) add("error", `${p}.value`, `${op} needs a value.`);
		if (!blank(o.path)) {
			const r = parsePatchPath(o.path);
			if (!r.ok) add("error", `${p}.path`, r.error);
			else if (r.attr && /^(id|meta|groups)$/i.test(r.attr)) add("warn", `${p}.path`, `${r.attr} is read-only on most resources. A server may reject or ignore this.`);
			else if (op === "add" && r.filter) add("warn", `${p}.path`, "add with a filter in the path is not meaningful. Use replace, or add to the attribute without a filter.");
		} else if ((op === "add" || op === "replace") && "value" in o && !isObj(o.value)) {
			add("error", `${p}.value`, "Without a path, value must be an object of attributes to add or replace.");
		}
		if (/^members$/i.test(String(o.path || "").split("[")[0]) && op === "replace") add("warn", `${p}`, "replace on members swaps the whole membership. To change one member use add, or remove with members[value eq \"id\"].");
	});
	return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates a User or Group resource body (create/replace). */
export function validateResource(obj) {
	const out = [];
	const add = (level, path, message) => out.push({ level, path, message });
	if (!isObj(obj)) return [{ level: "error", path: "$", message: "A resource must be a JSON object." }];
	const schemas = Array.isArray(obj.schemas) ? obj.schemas : null;
	if (!schemas) add("error", "schemas", "schemas is required and must be an array of URNs.");
	const isUser = schemas ? schemas.includes(SCHEMA.user) : "userName" in obj;
	const isGroup = schemas ? schemas.includes(SCHEMA.group) : "members" in obj && !isUser;
	if (schemas && !isUser && !isGroup) add("warn", "schemas", "Neither the core User nor the core Group schema is listed.");
	if (isUser && isGroup) add("error", "schemas", "A resource cannot be both a User and a Group.");
	const entKey = Object.keys(obj).find((k) => k.toLowerCase() === SCHEMA.enterprise.toLowerCase());
	if (entKey && schemas && !schemas.includes(SCHEMA.enterprise)) add("error", "schemas", `The extension object "${entKey}" is present but its URN is missing from schemas.`);
	if (schemas && schemas.includes(SCHEMA.enterprise) && !entKey) add("warn", "schemas", "The enterprise schema is listed but no extension object follows.");
	if (entKey && isObj(obj[entKey])) {
		const e = obj[entKey];
		if ("manager" in e && !(isObj(e.manager) && !blank(e.manager.value))) add("warn", `${entKey}.manager`, "manager should be an object with a value (the manager's id).");
		for (const k of ["employeeNumber", "costCenter", "organization", "division", "department"]) if (k in e && typeof e[k] !== "string") add("warn", `${entKey}.${k}`, `${k} should be a string.`);
	}
	for (const k of ["id", "meta"]) if (k in obj) add("info", k, `${k} is assigned by the server. Leave it out of a create request.`);
	if (isUser) {
		if (blank(obj.userName) || typeof obj.userName !== "string") add("error", "userName", "userName is required and must be a non-empty string.");
		if ("active" in obj && typeof obj.active !== "boolean") add("error", "active", `active must be a JSON boolean, not ${typeof obj.active} ${JSON.stringify(obj.active)}. This is a very common integration bug.`);
		if ("name" in obj && !isObj(obj.name)) add("error", "name", "name must be an object (givenName, familyName, formatted ...).");
		if ("groups" in obj) add("warn", "groups", "groups is read-only on a User. Change membership through the Group resource.");
		if ("password" in obj) add("info", "password", "password is write-only. Servers never return it. Do not log this body.");
		if (isObj(obj.name) && !obj.name.formatted && !obj.name.givenName && !obj.name.familyName) add("info", "name", "name is empty.");
		for (const key of ["emails", "phoneNumbers", "addresses", "ims", "photos", "roles", "entitlements", "x509Certificates"]) {
			if (!(key in obj)) continue;
			const arr = obj[key];
			if (!Array.isArray(arr)) { add("error", key, `${key} must be an array.`); continue; }
			const primaries = arr.filter((e) => isObj(e) && e.primary === true).length;
			if (primaries > 1) add("error", key, `More than one ${key} entry has primary: true. At most one may.`);
			arr.forEach((e, i) => {
				const p = `${key}[${i}]`;
				if (!isObj(e)) { add("error", p, "Each entry must be an object."); return; }
				if (key !== "addresses" && blank(e.value)) add("error", `${p}.value`, "value is required.");
				if ("primary" in e && typeof e.primary !== "boolean") add("error", `${p}.primary`, "primary must be a boolean.");
				if (key === "emails" && typeof e.value === "string" && !EMAIL_RE.test(e.value)) add("warn", `${p}.value`, `"${e.value}" does not look like an email address.`);
				if (key === "emails" && "type" in e && !["work", "home", "other"].includes(String(e.type).toLowerCase())) add("info", `${p}.type`, `Canonical email types are work, home and other (got "${e.type}").`);
			});
		}
	}
	if (isGroup) {
		if (blank(obj.displayName)) add("error", "displayName", "displayName is required for a Group.");
		if ("members" in obj) {
			if (!Array.isArray(obj.members)) add("error", "members", "members must be an array.");
			else obj.members.forEach((m, i) => {
				if (!isObj(m) || blank(m.value)) add("error", `members[${i}].value`, "Each member needs a value (the member's id).");
				else if ("type" in m && !["User", "Group"].includes(m.type)) add("warn", `members[${i}].type`, 'type should be "User" or "Group".');
			});
		}
	}
	return out;
}

// ------------------------------------------------------------------ curl

const q = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

/**
 * @param {{method: string, baseUrl: string, resource: "Users"|"Groups", id?: string, filter?: string, count?: number, startIndex?: number, body?: any, tokenVar?: string}} o
 */
export function buildCurl(o) {
	const base = String(o.baseUrl || "https://example.com/scim/v2").replace(/\/+$/, "");
	const method = o.method || "GET";
	const needsId = ["PUT", "PATCH", "DELETE"].includes(method) || (method === "GET" && o.id);
	let url = `${base}/${o.resource || "Users"}`;
	if (needsId) url += `/${o.id || "{id}"}`;
	const params = [];
	if (method === "GET" && !needsId) {
		if (o.filter) params.push(filterQuery(o.filter));
		if (o.startIndex) params.push(`startIndex=${o.startIndex}`);
		if (o.count) params.push(`count=${o.count}`);
	}
	if (params.length) url += `?${params.join("&")}`;
	const token = o.tokenVar || "SCIM_TOKEN";
	const lines = [`curl -sS -X ${method} ${q(url)}`, `  -H "Authorization: Bearer $${token}"`, '  -H "Accept: application/scim+json"'];
	const hasBody = ["POST", "PUT", "PATCH"].includes(method);
	if (hasBody) {
		lines.push('  -H "Content-Type: application/scim+json"');
		lines.push(`  -d ${q(JSON.stringify(o.body ?? {}, null, 2))}`);
	}
	return lines.join(" \\\n");
}

// ------------------------------------------------------------------ samples

export const SAMPLE_RESOURCE = {
	schemas: [SCHEMA.user, SCHEMA.enterprise],
	id: "2819c223-7f76-453a-919d-413861904646",
	userName: "bjensen@example.com",
	name: { givenName: "Barbara", familyName: "Jensen", formatted: "Ms. Barbara J Jensen" },
	displayName: "Babs Jensen",
	active: true,
	emails: [
		{ value: "bjensen@example.com", type: "work", primary: true },
		{ value: "babs@jensen.org", type: "home" },
	],
	[SCHEMA.enterprise]: { employeeNumber: "701984", department: "Tour Operations", manager: { value: "26118915-6090-4610-87e4-49d8ca9f808d", displayName: "John Smith" } },
};

export const FILTER_EXAMPLES = [
	'userName eq "bjensen@example.com"',
	'name.familyName co "ens" and active eq true',
	'emails[type eq "work" and value ew "@example.com"]',
	'not (emails.type eq "home")',
	"title pr and userType eq \"Employee\"",
	'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department sw "Tour"',
];

export const SAMPLE_PATCH = [
	{ op: "replace", path: "active", value: "false" },
	{ op: "replace", path: 'emails[type eq "work"].value', value: "new.address@example.com" },
	{ op: "add", path: "", value: '{"title": "Senior Engineer"}' },
	{ op: "remove", path: 'phoneNumbers[type eq "fax"]', value: "" },
];
