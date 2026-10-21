// Offline simulator for ISC transforms. It evaluates a transform JSON against sample identity and
// account data and returns the result plus a trace tree. It is an approximation of ISC's engine:
// every type it does not model is reported, never guessed, and null handling is flagged rather than assumed.

export const SIMULATED = [
	"static", "accountAttribute", "identityAttribute", "concat", "lower", "upper", "trim", "substring",
	"replace", "replaceAll", "split", "indexOf", "firstValid", "conditional", "leftPad", "rightPad",
	"base64Encode", "base64Decode", "lookup", "reference", "getEndOfString",
];
export const NOT_SIMULATED = [
	"dateFormat", "dateCompare", "dateMath", "e164phone", "iso3166", "usernameGenerator", "uuid",
	"randomAlphaNumeric", "randomNumeric", "nameNormalizer", "decomposeDiacriticalMarks", "rule",
	"getReferenceIdentityAttribute", "accountSortAttribute",
];

class SimError extends Error {}

/**
 * @param {object} transform  {type, attributes} (a top-level "name" is ignored)
 * @param {{identity?:Record<string,any>, accounts?:Record<string,Record<string,any>|Record<string,any>[]>, input?:any, library?:Record<string,object>}} data
 * @returns {{ok:boolean, output:any, trace:object, error?:string}}
 */
export function simulate(transform, data = {}) {
	const state = { data, depth: 0 };
	try {
		const trace = run(transform, state, data.input);
		return { ok: true, output: trace.output, trace };
	} catch (e) {
		if (e instanceof SimError) return { ok: false, output: null, error: e.message, trace: e.trace || null };
		throw e;
	}
}

const isTransform = (v) => v && typeof v === "object" && !Array.isArray(v) && typeof v.type === "string";
const str = (v) => (v === null || v === undefined ? null : String(v));

function node(type, output, extra = {}) {
	return { type, output, children: [], warnings: [], ...extra };
}

/** Resolve an attribute value that may be a literal or a nested transform. */
function val(v, state, input, children) {
	if (isTransform(v)) {
		const t = run(v, state, input);
		children.push(t);
		return t.output;
	}
	return v;
}

function run(t, state, input) {
	if (state.depth > 40) throw new SimError("Transform nesting is deeper than 40 levels");
	state.depth++;
	try {
		return evaluate(t, state, input);
	} finally {
		state.depth--;
	}
}

function evaluate(t, state, topInput) {
	const a = t.attributes || {};
	const type = t.type;
	const children = [];
	const out = (output, warnings = []) => node(type, output, { children, warnings, attributes: a });
	const get = (k) => val(a[k], state, topInput, children);
	const inputVal = () => {
		if (a.input !== undefined) return get("input");
		if (topInput !== undefined) return topInput;
		throw new SimError(`${type}: no "input" attribute and no source value supplied`);
	};
	const nullWarn = (w, v) => (v === null || v === undefined ? ["Input is null: ISC may treat nulls differently from this simulation."] : w);

	switch (type) {
		case "static": {
			const v = get("value");
			return out(v === undefined ? null : v);
		}
		case "identityAttribute": {
			const name = get("name");
			const id = state.data.identity || {};
			if (!(name in id)) return out(null, [`identity has no attribute "${name}" in the sample data`]);
			return out(id[name] ?? null);
		}
		case "accountAttribute": {
			const src = get("sourceName");
			const attr = get("attributeName");
			const accts = state.data.accounts || {};
			let acct = accts[src];
			const warns = [];
			if (Array.isArray(acct)) {
				if (acct.length > 1) warns.push(`${acct.length} accounts for "${src}": the first is used. ISC picks by accountSortAttribute and priority.`);
				acct = acct[0];
			}
			if (!acct) return out(null, [`no sample account for source "${src}"`]);
			if (!(attr in acct)) warns.push(`account has no attribute "${attr}" in the sample data`);
			return out(acct[attr] ?? null, warns);
		}
		case "concat": {
			const values = Array.isArray(a.values) ? a.values.map((v) => val(v, state, topInput, children)) : [];
			const hasNull = values.some((v) => v === null || v === undefined);
			if (hasNull) return out(null, ["A value is null: this simulation returns null. Confirm ISC's concat behaviour for nulls on your tenant."]);
			return out(values.map(String).join(""));
		}
		case "lower": case "upper": case "trim": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			const s = String(v);
			return out(type === "lower" ? s.toLowerCase() : type === "upper" ? s.toUpperCase() : s.trim());
		}
		case "substring": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			const s = String(v);
			const begin = Number(get("begin") ?? 0) + Number(get("beginOffset") ?? 0);
			const endRaw = a.end === undefined ? -1 : Number(get("end"));
			const end = endRaw === -1 ? s.length : endRaw + Number(get("endOffset") ?? 0);
			const warns = [];
			if (begin < 0) warns.push("begin is negative: not modelled, result may differ.");
			return out(s.substring(Math.max(begin, 0), end), warns);
		}
		case "replace": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			const regex = String(get("regex"));
			const rep = String(get("replacement") ?? "");
			return out(String(v).replace(new RegExp(regex, "g"), rep), ["Uses JavaScript regex; ISC uses Java regex. Check lookaheads, named groups and flags."]);
		}
		case "replaceAll": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			const table = a.table || {};
			let s = String(v);
			for (const [k, rep] of Object.entries(table)) s = s.replace(new RegExp(k, "g"), String(rep));
			return out(s, ["Uses JavaScript regex; ISC uses Java regex."]);
		}
		case "split": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			const delim = String(get("delimiter"));
			const idx = Number(get("index") ?? 0);
			const parts = String(v).split(delim);
			const warns = ["Delimiter is treated literally here. Confirm whether ISC treats it as a regex."];
			if (idx >= parts.length) {
				if (a.throws === true) throw Object.assign(new SimError(`split: index ${idx} out of range (throws=true)`), { trace: out(null) });
				return out(null, [...warns, `index ${idx} is out of range (${parts.length} part(s)); null returned.`]);
			}
			return out(parts[idx], warns);
		}
		case "indexOf": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			return out(String(v).indexOf(String(get("substring"))));
		}
		case "getEndOfString": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			const n = Number(get("numChars"));
			return out(String(v).slice(-n));
		}
		case "leftPad": case "rightPad": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			const len = Number(get("length"));
			const pad = String(get("padding") ?? " ");
			const s = String(v);
			if (s.length >= len || !pad) return out(s);
			return out(type === "leftPad" ? s.padStart(len, pad) : s.padEnd(len, pad));
		}
		case "base64Encode": case "base64Decode": {
			const v = inputVal();
			if (v === null || v === undefined) return out(null, nullWarn([], v));
			try {
				const buf = typeof Buffer !== "undefined" ? Buffer : null;
				if (type === "base64Encode") return out(buf ? buf.from(String(v), "utf8").toString("base64") : btoa(unescape(encodeURIComponent(String(v)))));
				return out(buf ? buf.from(String(v), "base64").toString("utf8") : decodeURIComponent(escape(atob(String(v)))));
			} catch {
				throw new SimError(`${type}: input is not valid`);
			}
		}
		case "firstValid": {
			const list = Array.isArray(a.values) ? a.values : [];
			const ignore = a.ignoreErrors === true;
			const warns = ["First non-null value wins (empty strings count as values). Confirm against ISC if blanks matter."];
			for (const item of list) {
				try {
					const v = val(item, state, topInput, children);
					if (v !== null && v !== undefined) return out(v, warns);
				} catch (e) {
					if (!(e instanceof SimError) || !ignore) throw e;
				}
			}
			return out(null, warns);
		}
		case "conditional": {
			const expr = String(get("expression") ?? "");
			const warns = [];
			const resolveVar = (tok) => {
				if (tok[0] !== "$") return tok;
				const k = tok.slice(1);
				if (!(k in a)) throw new SimError(`conditional: variable ${tok} is not defined in attributes`);
				const v = val(a[k], state, topInput, children);
				return v === null || v === undefined ? "" : String(v);
			};
			const toks = expr.trim().split(/\s+/);
			if (toks.length < 3 || toks.length % 4 !== 3) throw new SimError(`conditional: cannot parse expression "${expr}". Supported: $a eq $b, ne, and, or.`);
			const cmp = (l, op, r) => {
				const L = resolveVar(l), R = resolveVar(r);
				if (op === "eq") return L === R;
				if (op === "ne") return L !== R;
				throw new SimError(`conditional: unsupported operator "${op}"`);
			};
			let result = cmp(toks[0], toks[1], toks[2]);
			for (let i = 3; i < toks.length; i += 4) {
				const join = toks[i].toLowerCase();
				const next = cmp(toks[i + 1], toks[i + 2], toks[i + 3]);
				result = join === "and" ? result && next : join === "or" ? result || next : (() => { throw new SimError(`conditional: unsupported connector "${toks[i]}"`); })();
			}
			warns.push("Null variables compare as empty strings here; comparison is case-sensitive.");
			const branch = result ? "positiveCondition" : "negativeCondition";
			const v = a[branch] === undefined ? null : val(a[branch], state, topInput, children);
			return out(v, warns);
		}
		case "lookup": {
			const v = inputVal();
			const table = a.table || {};
			if (v !== null && v !== undefined && Object.prototype.hasOwnProperty.call(table, String(v))) return out(table[String(v)]);
			if ("default" in table) return out(table.default, ["Key not found: table default used."]);
			return out(null, ["Key not found and no default in the table."]);
		}
		case "reference": {
			const id = String(get("id"));
			const lib = state.data.library || {};
			if (!lib[id]) throw new SimError(`reference: transform "${id}" is not in the library box. Paste it there to include it.`);
			const t2 = run(lib[id], state, topInput);
			children.push(t2);
			return out(t2.output);
		}
		default:
			if (NOT_SIMULATED.includes(type)) throw Object.assign(new SimError(`"${type}" is not simulated. Test it in ISC (transform preview) or replace it with a stub.`), { trace: node(type, null, { children, warnings: [] }) });
			throw new SimError(`Unknown transform type "${type}"`);
	}
}

/** Runs many cases against one transform. cases: [{name, identity, accounts, input, expected}] */
export function runCases(transform, cases, library) {
	return cases.map((c) => {
		const r = simulate(transform, { identity: c.identity, accounts: c.accounts, input: c.input, library });
		const hasExpected = c.expected !== undefined && c.expected !== null && c.expected !== "";
		const pass = r.ok && (!hasExpected || String(r.output) === String(c.expected));
		return { name: c.name || "", ok: r.ok, output: r.output, expected: hasExpected ? c.expected : undefined, pass, error: r.error, warnings: collectWarnings(r.trace) };
	});
}

export function collectWarnings(trace, acc = []) {
	if (!trace) return acc;
	for (const w of trace.warnings || []) if (!acc.includes(w)) acc.push(w);
	for (const c of trace.children || []) collectWarnings(c, acc);
	return acc;
}
