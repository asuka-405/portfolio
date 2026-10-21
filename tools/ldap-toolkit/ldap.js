// LDAP / Active Directory helpers: DN parsing and escaping (RFC 4514), search filter parsing and escaping (RFC 4515),
// AD filter recipes, userAccountControl decoding and Windows FILETIME conversion. Pure functions, no DOM.

export class LdapError extends Error {
	constructor(message, pos) {
		super(message);
		this.pos = pos;
	}
}

// ------------------------------------------------------------------ DN

const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");

/** Escape an attribute value for use inside a DN (RFC 4514 section 2.4). */
export function escapeDnValue(v) {
	let out = "";
	const s = String(v);
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "\0") out += "\\00";
		else if (`,+"\\<>;=`.includes(c)) out += "\\" + c;
		else if (i === 0 && (c === "#" || c === " ")) out += "\\" + c;
		else if (i === s.length - 1 && c === " ") out += "\\ ";
		else out += c;
	}
	return out;
}

/** Undo DN escaping: \, \XX hex pairs (UTF-8) and backslash-escaped specials. */
export function unescapeDnValue(v) {
	const bytes = [];
	const enc = new TextEncoder();
	for (let i = 0; i < v.length; i++) {
		if (v[i] === "\\") {
			const hex = v.slice(i + 1, i + 3);
			if (/^[0-9a-fA-F]{2}$/.test(hex)) { bytes.push(parseInt(hex, 16)); i += 2; continue; }
			if (i + 1 < v.length) { bytes.push(...enc.encode(v[i + 1])); i++; continue; }
			throw new LdapError("Trailing backslash", i);
		}
		bytes.push(...enc.encode(v[i]));
	}
	return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

/** Split on an unescaped separator, honouring backslash escapes and quoted strings. */
function splitUnescaped(s, sep) {
	const out = [];
	let cur = "";
	let quoted = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "\\") { cur += c + (s[i + 1] ?? ""); i++; continue; }
		if (c === '"') { quoted = !quoted; cur += c; continue; }
		if (c === sep && !quoted) { out.push(cur); cur = ""; continue; }
		cur += c;
	}
	out.push(cur);
	return out;
}

/** @returns {{rdns: {type:string, value:string, raw:string, multi:{type:string,value:string}[]}[]}} */
export function parseDn(dn) {
	const text = String(dn).trim();
	if (!text) return { rdns: [] };
	const rdns = splitUnescaped(text, ",").map((rdnRaw, idx) => {
		const avas = splitUnescaped(rdnRaw, "+").map((ava) => {
			const eq = ava.indexOf("=");
			if (eq < 1) throw new LdapError(`RDN ${idx + 1} ("${rdnRaw.trim()}") has no attribute=value form`, idx);
			const type = ava.slice(0, eq).trim();
			if (!/^([A-Za-z][A-Za-z0-9-]*|\d+(\.\d+)*)$/.test(type)) throw new LdapError(`"${type}" is not a valid attribute type`, idx);
			let value = ava.slice(eq + 1).trim();
			let rawValue = value;
			if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
			else if (value.startsWith("#")) { /* hex-encoded BER value: keep as is */ return { type, value: rawValue, hex: true }; }
			return { type, value: unescapeDnValue(value) };
		});
		return { type: avas[0].type, value: avas[0].value, raw: rdnRaw.trim(), multi: avas };
	});
	return { rdns };
}

export function formatDn(parsed, { lowercaseTypes = false, uppercaseTypes = false } = {}) {
	return parsed.rdns
		.map((r) => r.multi.map((a) => {
			const t = lowercaseTypes ? a.type.toLowerCase() : uppercaseTypes ? a.type.toUpperCase() : a.type;
			return `${t}=${a.hex ? a.value : escapeDnValue(a.value)}`;
		}).join("+"))
		.join(",");
}

/** Normalised DN for comparison: lowercase types, trimmed, escapes canonicalised, values compared case-insensitively. */
export function normalizeDn(dn) {
	return formatDn(parseDn(dn), { lowercaseTypes: true }).toLowerCase();
}

export function sameDn(a, b) {
	try { return normalizeDn(a) === normalizeDn(b); } catch { return false; }
}

/** Everything the DN tab shows. */
export function analyzeDn(dn) {
	const p = parseDn(dn);
	const rdns = p.rdns;
	const warnings = [];
	if (!rdns.length) return { ok: true, rdns: [], formatted: "", normalized: "", parents: [], canonical: "", dnsDomain: "", warnings };
	const dcs = rdns.filter((r) => r.type.toLowerCase() === "dc").map((r) => r.value);
	const nonDc = rdns.filter((r) => r.type.toLowerCase() !== "dc");
	const canonical = (dcs.length ? dcs.join(".") : "") + (nonDc.length ? "/" + [...nonDc].reverse().map((r) => r.value).join("/") : "");
	const parents = rdns.map((_, i) => formatDn({ rdns: rdns.slice(i) })).slice(1);
	if (rdns.some((r) => r.multi.length > 1)) warnings.push("Contains a multi-valued RDN (a+b): rare, and many tools mishandle it.");
	if (/,\s+\w+=/.test(dn)) warnings.push("Spaces after commas are legal but are not part of the normalised form; compare with a DN-aware function, not string equality.");
	if (rdns.some((r) => /\\[0-9a-fA-F]{2}/.test(r.raw))) warnings.push("Hex escapes (\\2C) decode to special characters; the formatted output uses the shorter backslash form.");
	return {
		ok: true,
		rdns: rdns.map((r) => ({ type: r.type, value: r.value, multi: r.multi.length > 1 })),
		formatted: formatDn(p),
		normalized: normalizeDn(dn),
		leaf: rdns[0].raw,
		parent: parents[0] || "",
		parents,
		depth: rdns.length,
		canonical,
		dnsDomain: dcs.join("."),
		warnings,
	};
}

/** DNS domain <-> DC components. */
export function domainToDn(domain) {
	return String(domain).trim().split(".").filter(Boolean).map((p) => `DC=${escapeDnValue(p)}`).join(",");
}
export function dnToDomain(dn) {
	return parseDn(dn).rdns.filter((r) => r.type.toLowerCase() === "dc").map((r) => r.value).join(".");
}

// ------------------------------------------------------------------ filters

/** Escape an assertion value for a search filter (RFC 4515). */
export function escapeFilterValue(v) {
	return Array.from(new TextEncoder().encode(String(v)), (b) => {
		const c = String.fromCharCode(b);
		return b === 0 || c === "*" || c === "(" || c === ")" || c === "\\" || b >= 0x80 ? "\\" + hex2(b) : c;
	}).join("");
}

export function unescapeFilterValue(v) {
	const bytes = [];
	const enc = new TextEncoder();
	for (let i = 0; i < v.length; i++) {
		if (v[i] === "\\") {
			const hex = v.slice(i + 1, i + 3);
			if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new LdapError(`Invalid escape "\\${hex}": use \\XX hex, for example \\28 for (`, i);
			bytes.push(parseInt(hex, 16));
			i += 2;
		} else bytes.push(...enc.encode(v[i]));
	}
	return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

/**
 * Parse an RFC 4515 filter into a tree.
 * Node kinds: and, or, not, present, equality, substring, approx, gte, lte, extensible.
 */
export function parseFilter(text) {
	const s = String(text).trim();
	let i = 0;
	const err = (m, p = i) => { throw new LdapError(`${m} (at position ${p + 1})`, p); };
	const peek = () => s[i];
	function filter() {
		if (peek() !== "(") err('Expected "("');
		i++;
		let node;
		const c = peek();
		if (c === "&" || c === "|") {
			i++;
			const children = [];
			while (peek() === "(") children.push(filter());
			if (!children.length) err(`"${c}" needs at least one filter`);
			node = { kind: c === "&" ? "and" : "or", children };
		} else if (c === "!") {
			i++;
			if (peek() !== "(") err('"!" must be followed by a filter in parentheses');
			node = { kind: "not", child: filter() };
		} else node = item();
		if (peek() !== ")") err('Expected ")"');
		i++;
		return node;
	}
	function item() {
		// attr [:dn] [:rule] := value  |  attr op value
		const start = i;
		let attr = "";
		while (i < s.length && !"=<>~:()".includes(s[i])) attr += s[i++];
		attr = attr.trim();
		let dnAttrs = false;
		let rule = null;
		if (peek() === ":") {
			// extensible match
			while (peek() === ":") {
				i++;
				if (s.startsWith("=", i)) break;
				let tok = "";
				while (i < s.length && s[i] !== ":" && s[i] !== "=") tok += s[i++];
				if (tok.toLowerCase() === "dn") dnAttrs = true;
				else if (tok) rule = tok;
			}
			if (!s.startsWith("=", i)) err('Extensible match needs ":=" before the value');
			i++;
			const value = readValue();
			return { kind: "extensible", attr: attr || null, dnAttrs, rule, value: unescapeFilterValue(value), raw: value };
		}
		if (!attr) err("Missing attribute name", start);
		if (!/^([A-Za-z][A-Za-z0-9-]*(;[A-Za-z0-9-]+)*|\d+(\.\d+)*)$/.test(attr)) err(`"${attr}" is not a valid attribute description`, start);
		let op;
		if (s.startsWith("~=", i)) { op = "approx"; i += 2; }
		else if (s.startsWith(">=", i)) { op = "gte"; i += 2; }
		else if (s.startsWith("<=", i)) { op = "lte"; i += 2; }
		else if (s.startsWith("=", i)) { op = "equality"; i += 1; }
		else err('Expected one of "=", "~=", ">=", "<="');
		const raw = readValue();
		if (op === "equality") {
			if (raw === "*") return { kind: "present", attr };
			if (raw.includes("*")) {
				const parts = raw.split("*");
				return { kind: "substring", attr, initial: parts[0] === "" ? null : unescapeFilterValue(parts[0]), any: parts.slice(1, -1).filter((x) => x !== "").map(unescapeFilterValue), final: parts[parts.length - 1] === "" ? null : unescapeFilterValue(parts[parts.length - 1]) };
			}
		}
		return { kind: op, attr, value: unescapeFilterValue(raw), raw };
	}
	function readValue() {
		const start = i;
		let v = "";
		while (i < s.length && s[i] !== ")") {
			if (s[i] === "(") err('Unescaped "(" in a value: write it as \\28', i);
			if (s[i] === "\\") { v += s[i] + (s[i + 1] ?? ""); i += 2; continue; }
			v += s[i++];
		}
		if (s[i] !== ")") err('Missing ")"', start);
		return v;
	}
	if (!s) throw new LdapError("Enter a filter", 0);
	const tree = filter();
	if (i < s.length) err("Unexpected text after the filter");
	return tree;
}

const escVal = (v) => escapeFilterValue(v);

export function formatFilter(n) {
	switch (n.kind) {
		case "and": return "(&" + n.children.map(formatFilter).join("") + ")";
		case "or": return "(|" + n.children.map(formatFilter).join("") + ")";
		case "not": return "(!" + formatFilter(n.child) + ")";
		case "present": return `(${n.attr}=*)`;
		case "equality": return `(${n.attr}=${escVal(n.value)})`;
		case "approx": return `(${n.attr}~=${escVal(n.value)})`;
		case "gte": return `(${n.attr}>=${escVal(n.value)})`;
		case "lte": return `(${n.attr}<=${escVal(n.value)})`;
		case "substring": return `(${n.attr}=${n.initial ? escVal(n.initial) : ""}*${n.any.map((a) => escVal(a) + "*").join("")}${n.final ? escVal(n.final) : ""})`;
		case "extensible": return `(${n.attr || ""}${n.dnAttrs ? ":dn" : ""}${n.rule ? ":" + n.rule : ""}:=${escVal(n.value)})`;
		default: return "";
	}
}

/** Indented multi-line form for reading. */
export function prettyFilter(n, depth = 0) {
	const pad = "  ".repeat(depth);
	if (n.kind === "and" || n.kind === "or") return `${pad}(${n.kind === "and" ? "&" : "|"}\n${n.children.map((c) => prettyFilter(c, depth + 1)).join("\n")}\n${pad})`;
	if (n.kind === "not") return `${pad}(!\n${prettyFilter(n.child, depth + 1)}\n${pad})`;
	return pad + formatFilter(n);
}

export const KNOWN_OIDS = {
	"1.2.840.113556.1.4.803": "LDAP_MATCHING_RULE_BIT_AND (all listed bits set)",
	"1.2.840.113556.1.4.804": "LDAP_MATCHING_RULE_BIT_OR (any listed bit set)",
	"1.2.840.113556.1.4.1941": "LDAP_MATCHING_RULE_IN_CHAIN (follows nested groups and parents)",
};

/** Human-readable explanation, one line per node, plus advice. */
export function explainFilter(tree) {
	const lines = [];
	const advice = [];
	const walk = (n, d) => {
		const pad = "  ".repeat(d);
		switch (n.kind) {
			case "and": lines.push(`${pad}ALL of:`); n.children.forEach((c) => walk(c, d + 1)); break;
			case "or": lines.push(`${pad}ANY of:`); n.children.forEach((c) => walk(c, d + 1)); break;
			case "not": lines.push(`${pad}NOT:`); walk(n.child, d + 1); break;
			case "present": lines.push(`${pad}${n.attr} has any value`); break;
			case "equality": lines.push(`${pad}${n.attr} equals "${n.value}"${/^objectclass$/i.test(n.attr) ? "" : " (case rules depend on the attribute)"}`); break;
			case "approx": lines.push(`${pad}${n.attr} approximately equals "${n.value}" (server dependent)`); break;
			case "gte": lines.push(`${pad}${n.attr} >= ${n.value}`); break;
			case "lte": lines.push(`${pad}${n.attr} <= ${n.value}`); break;
			case "substring": lines.push(`${pad}${n.attr} ${[n.initial ? `starts with "${n.initial}"` : null, ...n.any.map((a) => `contains "${a}"`), n.final ? `ends with "${n.final}"` : null].filter(Boolean).join(", ")}`); break;
			case "extensible": {
				const rule = n.rule ? KNOWN_OIDS[n.rule] || `matching rule ${n.rule}` : "default matching rule";
				const bit = n.rule === "1.2.840.113556.1.4.803" || n.rule === "1.2.840.113556.1.4.804";
				lines.push(`${pad}${n.attr || "(any attribute)"}${n.dnAttrs ? " (also DN components)" : ""} ${bit ? `has bit mask ${n.value} (${uacFlagsFor(Number(n.value)).join(", ") || "no known flags"})` : `matches "${n.value}"`} using ${rule}`);
				break;
			}
		}
	};
	walk(tree, 0);
	const text = formatFilter(tree);
	const countStar = (n) => (n.kind === "substring" && n.initial === null ? 1 : 0) + (n.children ? n.children.reduce((a, c) => a + countStar(c), 0) : 0) + (n.child ? countStar(n.child) : 0);
	if (countStar(tree)) advice.push("A substring filter with a leading * (for example (cn=*smith)) cannot use an index on most directories and can be slow on large trees.");
	const hasChain = text.includes("1.2.840.113556.1.4.1941");
	if (hasChain) advice.push("LDAP_MATCHING_RULE_IN_CHAIN is expensive on large groups. Prefer a base DN that narrows the search, and avoid it in frequently run aggregation filters.");
	if (/\(!\(objectClass=/i.test(text)) advice.push("Negating objectClass forces a scan; select what you want instead.");
	if (tree.kind !== "and" && !/objectClass|objectCategory/i.test(text)) advice.push("No objectClass or objectCategory term: the filter can match groups, computers and contacts as well as users. For Active Directory users add (objectCategory=person)(objectClass=user).");
	return { lines, advice };
}

// ------------------------------------------------------------------ Active Directory recipes

const BIT_AND = "1.2.840.113556.1.4.803";
const USER = "(objectCategory=person)(objectClass=user)";

/** Convert days-ago to a Windows FILETIME string (100 ns ticks since 1601-01-01 UTC). */
export function unixMsToFiletime(ms) {
	return (BigInt(Math.trunc(ms)) + 11644473600000n) * 10000n;
}
export function filetimeToUnixMs(ft) {
	return Number(BigInt(ft) / 10000n - 11644473600000n);
}

export const RECIPES = [
	{ id: "disabled", label: "Disabled user accounts", params: [], build: () => `(&${USER}(userAccountControl:${BIT_AND}:=2))` },
	{ id: "enabled", label: "Enabled user accounts", params: [], build: () => `(&${USER}(!(userAccountControl:${BIT_AND}:=2)))` },
	{ id: "locked", label: "Locked-out accounts", params: [], build: () => `(&${USER}(lockoutTime>=1))`, note: "lockoutTime is non-zero while locked, but it is not cleared after the lockout duration expires. Check msDS-User-Account-Control-Computed bit 0x10 for the live state." },
	{ id: "pwd-never-expires", label: "Password never expires", params: [], build: () => `(&${USER}(userAccountControl:${BIT_AND}:=65536))` },
	{ id: "pwd-not-required", label: "Password not required", params: [], build: () => `(&${USER}(userAccountControl:${BIT_AND}:=32))` },
	{ id: "no-preauth", label: "Kerberos pre-authentication not required (AS-REP roastable)", params: [], build: () => `(&${USER}(userAccountControl:${BIT_AND}:=4194304))` },
	{ id: "no-email", label: "Users without an email address", params: [], build: () => `(&${USER}(!(mail=*)))` },
	{ id: "no-manager", label: "Users without a manager", params: [], build: () => `(&${USER}(!(manager=*)))` },
	{ id: "has-reports", label: "Managers (have direct reports)", params: [], build: () => `(&${USER}(directReports=*))` },
	{ id: "admincount", label: "Accounts with adminCount=1 (protected by AdminSDHolder)", params: [], build: () => `(&${USER}(adminCount=1))` },
	{ id: "member-of-nested", label: "Members of a group, including nested groups", params: [{ name: "groupDn", label: "Group DN", dflt: "CN=Finance,OU=Groups,DC=example,DC=test" }], build: (p) => `(memberOf:1.2.840.113556.1.4.1941:=${escVal(p.groupDn)})` },
	{ id: "member-of", label: "Direct members of a group", params: [{ name: "groupDn", label: "Group DN", dflt: "CN=Finance,OU=Groups,DC=example,DC=test" }], build: (p) => `(memberOf=${escVal(p.groupDn)})` },
	{ id: "empty-groups", label: "Empty groups", params: [], build: () => `(&(objectCategory=group)(!(member=*)))` },
	{ id: "stale", label: "Not logged on for N days (lastLogonTimestamp)", params: [{ name: "days", label: "Days", dflt: "90" }], build: (p, now = Date.now()) => `(&${USER}(lastLogonTimestamp<=${unixMsToFiletime(now - Number(p.days || 90) * 86400000)}))`, note: "lastLogonTimestamp replicates lazily (about every 14 days), so treat it as accurate to roughly two weeks." },
	{ id: "never-logged-on", label: "Users that never logged on", params: [], build: () => `(&${USER}(!(lastLogonTimestamp=*)))` },
	{ id: "pwd-last-set", label: "Password not changed for N days (pwdLastSet)", params: [{ name: "days", label: "Days", dflt: "365" }], build: (p, now = Date.now()) => `(&${USER}(pwdLastSet<=${unixMsToFiletime(now - Number(p.days || 365) * 86400000)})(pwdLastSet>=1))` },
	{ id: "by-name", label: "Users by name prefix (sAMAccountName)", params: [{ name: "prefix", label: "Prefix", dflt: "svc-" }], build: (p) => `(&${USER}(sAMAccountName=${escVal(p.prefix)}*))` },
	{ id: "computers", label: "Computer accounts", params: [], build: () => `(objectCategory=computer)` },
	{ id: "ou-users-by-attr", label: "Users where an attribute equals a value", params: [{ name: "attr", label: "Attribute", dflt: "department" }, { name: "value", label: "Value", dflt: "Finance" }], build: (p) => `(&${USER}(${p.attr}=${escVal(p.value)}))` },
];

export function buildRecipe(id, params = {}, now) {
	const r = RECIPES.find((x) => x.id === id);
	if (!r) throw new LdapError(`Unknown recipe ${id}`);
	const filter = r.build({ ...Object.fromEntries(r.params.map((p) => [p.name, p.dflt])), ...params }, now);
	return { filter, note: r.note || "" };
}

// ------------------------------------------------------------------ userAccountControl

export const UAC_FLAGS = [
	[0x1, "SCRIPT"], [0x2, "ACCOUNTDISABLE"], [0x8, "HOMEDIR_REQUIRED"], [0x10, "LOCKOUT"], [0x20, "PASSWD_NOTREQD"],
	[0x40, "PASSWD_CANT_CHANGE"], [0x80, "ENCRYPTED_TEXT_PWD_ALLOWED"], [0x100, "TEMP_DUPLICATE_ACCOUNT"], [0x200, "NORMAL_ACCOUNT"],
	[0x800, "INTERDOMAIN_TRUST_ACCOUNT"], [0x1000, "WORKSTATION_TRUST_ACCOUNT"], [0x2000, "SERVER_TRUST_ACCOUNT"],
	[0x10000, "DONT_EXPIRE_PASSWORD"], [0x20000, "MNS_LOGON_ACCOUNT"], [0x40000, "SMARTCARD_REQUIRED"], [0x80000, "TRUSTED_FOR_DELEGATION"],
	[0x100000, "NOT_DELEGATED"], [0x200000, "USE_DES_KEY_ONLY"], [0x400000, "DONT_REQ_PREAUTH"], [0x800000, "PASSWORD_EXPIRED"],
	[0x1000000, "TRUSTED_TO_AUTH_FOR_DELEGATION"], [0x4000000, "PARTIAL_SECRETS_ACCOUNT"],
];

function uacFlagsFor(n) {
	return UAC_FLAGS.filter(([bit]) => (n & bit) === bit).map(([, name]) => name);
}

export function decodeUac(value) {
	const n = Number(value);
	if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new LdapError("userAccountControl must be a non-negative integer");
	const set = UAC_FLAGS.filter(([bit]) => (n & bit) === bit).map(([bit, name]) => ({ bit, hex: "0x" + bit.toString(16).toUpperCase(), name }));
	const known = UAC_FLAGS.reduce((a, [b]) => a | b, 0);
	const unknown = (n & ~known) >>> 0;
	return { value: n, hex: "0x" + n.toString(16).toUpperCase(), flags: set, unknown: unknown ? "0x" + unknown.toString(16).toUpperCase() : null, enabled: !(n & 2) };
}

export function encodeUac(names) {
	let n = 0;
	for (const name of names) {
		const f = UAC_FLAGS.find(([, nm]) => nm === name);
		if (!f) throw new LdapError(`Unknown flag ${name}`);
		n |= f[0];
	}
	return n >>> 0;
}

// ------------------------------------------------------------------ timestamps

/** Parse a value in any of the common directory time formats. Returns a Date or throws. */
export function parseDirectoryTime(input) {
	const s = String(input).trim();
	if (/^\d{15,19}$/.test(s)) {
		const ms = filetimeToUnixMs(s);
		return { date: new Date(ms), kind: "Windows FILETIME (100 ns ticks since 1601)" };
	}
	let m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:[.,](\d+))?(Z|[+-]\d{2}(?:\d{2})?)?$/.exec(s);
	if (m) {
		let tz = m[8] || "Z";
		if (tz !== "Z") tz = tz.length === 3 ? tz + ":00" : tz.slice(0, 3) + ":" + tz.slice(3);
		const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz === "Z" ? "Z" : tz}`);
		if (!isNaN(d)) return { date: d, kind: "LDAP GeneralizedTime" };
	}
	if (/^\d{9,10}$/.test(s)) return { date: new Date(Number(s) * 1000), kind: "Unix seconds" };
	if (/^\d{12,13}$/.test(s)) return { date: new Date(Number(s)), kind: "Unix milliseconds" };
	const d = new Date(s);
	if (!isNaN(d)) return { date: d, kind: "ISO 8601 / date string" };
	throw new LdapError("Not a recognised time. Try a FILETIME (18 digits), GeneralizedTime (20260101120000.0Z), Unix seconds or an ISO date.");
}

export function timeFormats(date) {
	const ms = date.getTime();
	const p = (n, l = 2) => String(n).padStart(l, "0");
	const u = date;
	return {
		iso: date.toISOString(),
		filetime: unixMsToFiletime(ms).toString(),
		generalized: `${u.getUTCFullYear()}${p(u.getUTCMonth() + 1)}${p(u.getUTCDate())}${p(u.getUTCHours())}${p(u.getUTCMinutes())}${p(u.getUTCSeconds())}.0Z`,
		unixSeconds: Math.floor(ms / 1000),
		unixMs: ms,
	};
}

export const SPECIAL_FILETIMES = {
	"0": "Never / not set",
	"9223372036854775807": "Never expires (accountExpires)",
};
