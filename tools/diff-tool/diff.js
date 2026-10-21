// Semantic diff for JSON and XML documents (config exports in particular).
// JSON: object keys are order-insensitive; arrays can be compared by position, by an identifying key, or as sets.
// XML: elements are matched by tag plus an identifying attribute (name, id, key by default), so reordering is not a change.

import { parseXml } from "../shared/xml.js";

export const IIQ_VOLATILE_ATTRS = ["id", "created", "modified", "lastRefresh", "mtime"];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
const esc = (k) => String(k).replace(/~/g, "~0").replace(/\//g, "~1");
const canon = (v) => JSON.stringify(sortDeep(v));
function sortDeep(v) {
	if (Array.isArray(v)) return v.map(sortDeep);
	if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]));
	return v;
}

// ------------------------------------------------------------------ JSON

/**
 * @param {*} a
 * @param {*} b
 * @param {{arrayMode?: "index"|"key"|"set", arrayKey?: string, ignoreKeys?: string[], ignoreCase?: boolean, trimStrings?: boolean}} [opts]
 */
export function diffJson(a, b, opts = {}) {
	const o = { arrayMode: "key", arrayKey: "", ignoreKeys: [], ignoreCase: false, trimStrings: false, ...opts };
	const ignore = new Set(o.ignoreKeys.map((k) => k.trim()).filter(Boolean));
	const changes = [];
	const notes = new Set();
	const norm = (v) => (typeof v === "string" ? (o.trimStrings ? v.trim() : v) : v);
	const eqScalar = (x, y) => {
		x = norm(x); y = norm(y);
		if (o.ignoreCase && typeof x === "string" && typeof y === "string") return x.toLowerCase() === y.toLowerCase();
		return x === y;
	};
	const skip = (key, path) => ignore.has(key) || ignore.has(path);
	const keyField = (arr1, arr2) => {
		const cands = o.arrayKey ? [o.arrayKey] : ["id", "name", "key", "self", "identifier", "uid"];
		const all = [...arr1, ...arr2];
		if (!all.length || !all.every(isObj)) return null;
		for (const c of cands) {
			const ok = all.every((x) => x[c] !== undefined && x[c] !== null && typeof x[c] !== "object");
			if (!ok) continue;
			const dup = new Set();
			let unique = true;
			for (const arr of [arr1, arr2]) {
				dup.clear();
				for (const x of arr) { const k = String(x[c]); if (dup.has(k)) unique = false; dup.add(k); }
			}
			if (unique) return c;
		}
		return null;
	};

	function walk(x, y, path, display) {
		const tx = typeOf(x), ty = typeOf(y);
		if (tx !== ty) { changes.push({ op: "replace", path: display || "/", pointer: path, before: x, after: y, typeChange: `${tx} to ${ty}` }); return; }
		if (tx === "object") {
			const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].sort();
			for (const k of keys) {
				const p = `${path}/${esc(k)}`, d = `${display}/${k}`;
				if (skip(k, d)) continue;
				if (!(k in x)) changes.push({ op: "add", path: d, pointer: p, after: y[k] });
				else if (!(k in y)) changes.push({ op: "remove", path: d, pointer: p, before: x[k] });
				else walk(x[k], y[k], p, d);
			}
			return;
		}
		if (tx === "array") return walkArray(x, y, path, display);
		if (!eqScalar(x, y)) changes.push({ op: "replace", path: display || "/", pointer: path, before: x, after: y });
	}

	function walkArray(x, y, path, display) {
		let mode = o.arrayMode;
		if (mode === "key") {
			const kf = keyField(x, y);
			if (!kf) { notes.add(`At ${display || "/"}: no unique key field found, compared by position.`); mode = "index"; }
			else {
				const mx = new Map(x.map((e, i) => [String(e[kf]), { e, i }]));
				const my = new Map(y.map((e, i) => [String(e[kf]), { e, i }]));
				for (const k of [...new Set([...mx.keys(), ...my.keys()])].sort()) {
					const d = `${display}[${kf}=${k}]`;
					if (!my.has(k)) changes.push({ op: "remove", path: d, pointer: `${path}/${mx.get(k).i}`, before: mx.get(k).e });
					else if (!mx.has(k)) changes.push({ op: "add", path: d, pointer: `${path}/${my.get(k).i}`, after: my.get(k).e });
					else walk(mx.get(k).e, my.get(k).e, `${path}/${mx.get(k).i}`, d);
				}
				return;
			}
		}
		if (mode === "set") {
			const cx = x.map((e) => canon(e)), cy = y.map((e) => canon(e));
			const count = (arr) => arr.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());
			const mx = count(cx), my = count(cy);
			const seenOut = new Map();
			x.forEach((e, i) => { const k = cx[i]; const over = (mx.get(k) || 0) - (my.get(k) || 0); const n = (seenOut.get(k) || 0); if (over > 0 && n < over) { seenOut.set(k, n + 1); changes.push({ op: "remove", path: `${display}[${truncate(k)}]`, pointer: `${path}/${i}`, before: e }); } });
			const seenIn = new Map();
			y.forEach((e, i) => { const k = cy[i]; const over = (my.get(k) || 0) - (mx.get(k) || 0); const n = (seenIn.get(k) || 0); if (over > 0 && n < over) { seenIn.set(k, n + 1); changes.push({ op: "add", path: `${display}[${truncate(k)}]`, pointer: `${path}/${i}`, after: e }); } });
			return;
		}
		const n = Math.max(x.length, y.length);
		for (let i = 0; i < n; i++) {
			const d = `${display}[${i}]`, p = `${path}/${i}`;
			if (i >= y.length) changes.push({ op: "remove", path: d, pointer: p, before: x[i] });
			else if (i >= x.length) changes.push({ op: "add", path: d, pointer: p, after: y[i] });
			else walk(x[i], y[i], p, d);
		}
	}

	walk(a, b, "", "");
	return { changes, stats: stats(changes), notes: [...notes] };
}

const truncate = (s, n = 40) => (s.length > n ? s.slice(0, n) + "..." : s);

function stats(changes) {
	const s = { added: 0, removed: 0, changed: 0, total: changes.length };
	for (const c of changes) c.op === "add" ? s.added++ : c.op === "remove" ? s.removed++ : s.changed++;
	return s;
}

/** RFC 6902 patch turning a into b. Valid only when arrays were compared by position. */
export function toJsonPatch(changes) {
	const idx = (p) => { const m = /\/(\d+)$/.exec(p); return m ? Number(m[1]) : -1; };
	const removes = changes.filter((c) => c.op === "remove").sort((p, q) => idx(q.pointer) - idx(p.pointer));
	const rest = changes.filter((c) => c.op !== "remove");
	return [
		...removes.map((c) => ({ op: "remove", path: c.pointer })),
		...rest.map((c) => ({ op: c.op, path: c.pointer || "", value: c.after })),
	].map((p) => (p.path === "" && p.op === "replace" ? { op: "replace", path: "", value: p.value } : p));
}

// ------------------------------------------------------------------ XML

const ws = (s, collapse) => (collapse ? s.replace(/\s+/g, " ").trim() : s.trim());

export function serializeXml(el, depth = 0, max = 400) {
	const pad = "  ".repeat(depth);
	const attrs = Object.entries(el.attrs).map(([k, v]) => ` ${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`).join("");
	const text = el.text.trim();
	if (!el.children.length && !text) return `${pad}<${el.name}${attrs}/>`;
	if (!el.children.length) return `${pad}<${el.name}${attrs}>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</${el.name}>`;
	const inner = el.children.map((c) => serializeXml(c, depth + 1, max)).join("\n");
	const out = `${pad}<${el.name}${attrs}>\n${inner}\n${pad}</${el.name}>`;
	return out.length > max * 8 ? out.slice(0, max * 8) + "\n..." : out;
}

/**
 * @param {string} a XML text
 * @param {string} b XML text
 * @param {{keyAttrs?: string[], ignoreAttrs?: string[], ignoreElements?: string[], collapseWhitespace?: boolean, iiq?: boolean, respectOrder?: boolean}} [opts]
 */
export function diffXml(a, b, opts = {}) {
	const o = { keyAttrs: ["name", "id", "key"], ignoreAttrs: [], ignoreElements: [], collapseWhitespace: true, iiq: false, respectOrder: false, ...opts };
	const ignoreAttrs = new Set([...o.ignoreAttrs.map((s) => s.trim()).filter(Boolean), ...(o.iiq ? IIQ_VOLATILE_ATTRS : [])]);
	const ignoreEls = new Set(o.ignoreElements.map((s) => s.trim()).filter(Boolean));
	const ra = parseXml(a), rb = parseXml(b);
	const docEl = (r) => r.children.find((c) => c.name !== "#document") || r.children[0];
	const ea = docEl(ra), eb = docEl(rb);
	if (!ea || !eb) throw new Error("Both inputs need a root element.");
	const changes = [];
	const notes = new Set();

	const keyOf = (el) => {
		for (const k of o.keyAttrs) if (el.attrs[k] !== undefined && !ignoreAttrs.has(k)) return `${el.name}[${k}=${el.attrs[k]}]`;
		return el.name;
	};
	function indexChildren(el) {
		const m = new Map();
		const counts = new Map();
		for (const c of el.children) {
			if (ignoreEls.has(c.name)) continue;
			let k = keyOf(c);
			const n = (counts.get(k) || 0) + 1;
			counts.set(k, n);
			if (n > 1) { notes.add(`Several <${c.name}> elements share the key ${k}: matched by order within the group.`); k = `${k}#${n}`; }
			m.set(k, c);
		}
		return m;
	}
	function walk(x, y, path) {
		// attributes
		const ak = [...new Set([...Object.keys(x.attrs), ...Object.keys(y.attrs)])].sort();
		for (const k of ak) {
			if (ignoreAttrs.has(k)) continue;
			const p = `${path}/@${k}`;
			if (!(k in x.attrs)) changes.push({ op: "add", path: p, after: y.attrs[k] });
			else if (!(k in y.attrs)) changes.push({ op: "remove", path: p, before: x.attrs[k] });
			else if (x.attrs[k] !== y.attrs[k]) changes.push({ op: "replace", path: p, before: x.attrs[k], after: y.attrs[k] });
		}
		// text
		const tx = ws(x.text, o.collapseWhitespace), ty = ws(y.text, o.collapseWhitespace);
		if (tx !== ty) {
			const p = `${path}/text()`;
			if (!tx) changes.push({ op: "add", path: p, after: ty });
			else if (!ty) changes.push({ op: "remove", path: p, before: tx });
			else changes.push({ op: "replace", path: p, before: tx, after: ty });
		}
		// children
		const cx = indexChildren(x), cy = indexChildren(y);
		for (const k of new Set([...cx.keys(), ...cy.keys()])) {
			const p = `${path}/${k}`;
			if (!cy.has(k)) changes.push({ op: "remove", path: p, before: serializeXml(cx.get(k)), element: true });
			else if (!cx.has(k)) changes.push({ op: "add", path: p, after: serializeXml(cy.get(k)), element: true });
			else walk(cx.get(k), cy.get(k), p);
		}
		if (o.respectOrder) {
			const ox = [...cx.keys()].filter((k) => cy.has(k)), oy = [...cy.keys()].filter((k) => cx.has(k));
			if (ox.join("\u0000") !== oy.join("\u0000")) changes.push({ op: "replace", path: `${path}/(child order)`, before: ox.join(", "), after: oy.join(", ") });
		}
	}
	if (ea.name !== eb.name) changes.push({ op: "replace", path: "/", before: `<${ea.name}>`, after: `<${eb.name}>`, typeChange: "root element differs" });
	else walk(ea, eb, `/${keyOf(ea)}`);
	return { changes, stats: stats(changes), notes: [...notes] };
}

// ------------------------------------------------------------------ entry point

export function detectFormat(text) {
	const t = text.trim();
	if (t.startsWith("<")) return "xml";
	if (t.startsWith("{") || t.startsWith("[") || /^["\d-]|^(true|false|null)\b/.test(t)) return "json";
	return "unknown";
}

export function diff(textA, textB, opts = {}) {
	const fa = detectFormat(textA), fb = detectFormat(textB);
	const format = opts.format && opts.format !== "auto" ? opts.format : fa === "unknown" ? fb : fa;
	if (format === "xml") {
		try { return { ok: true, format, ...diffXml(textA, textB, opts) }; } catch (e) { return { ok: false, format, error: `XML: ${e.message}` }; }
	}
	let a, b;
	try { a = JSON.parse(textA); } catch (e) { return { ok: false, format: "json", error: `Left side is not valid JSON: ${e.message}` }; }
	try { b = JSON.parse(textB); } catch (e) { return { ok: false, format: "json", error: `Right side is not valid JSON: ${e.message}` }; }
	return { ok: true, format: "json", ...diffJson(a, b, opts) };
}

export function diffMarkdown(result) {
	const L = ["# Diff report", "", `${result.stats.total} difference(s): ${result.stats.added} added, ${result.stats.removed} removed, ${result.stats.changed} changed.`, ""];
	for (const n of result.notes) L.push(`> ${n}`);
	if (result.notes.length) L.push("");
	const show = (v) => (typeof v === "string" ? v : JSON.stringify(v));
	for (const c of result.changes) {
		L.push(`- **${c.op}** \`${c.path || "/"}\`${c.typeChange ? ` (${c.typeChange})` : ""}`);
		if (c.op !== "add" && c.before !== undefined) L.push("  - before: `" + truncate(show(c.before).replace(/\n/g, " "), 200) + "`");
		if (c.op !== "remove" && c.after !== undefined) L.push("  - after: `" + truncate(show(c.after).replace(/\n/g, " "), 200) + "`");
	}
	return L.join("\n") + "\n";
}

export const SAMPLE = {
	json: [
		JSON.stringify({ name: "HR Feed", connector: "delimited-file", connectorAttributes: { file: "/data/hr.csv", delimiter: ",", hasHeader: true }, schemas: [{ name: "account", attributes: [{ name: "employeeId", type: "STRING" }, { name: "dept", type: "STRING" }] }], owner: { type: "IDENTITY", name: "spadmin" } }, null, 2),
		JSON.stringify({ name: "HR Feed", connector: "delimited-file", connectorAttributes: { file: "/data/hr-v2.csv", delimiter: ";", hasHeader: true, indexColumn: "employeeId" }, schemas: [{ name: "account", attributes: [{ name: "dept", type: "STRING" }, { name: "employeeId", type: "STRING" }, { name: "mail", type: "STRING" }] }], owner: { type: "IDENTITY", name: "payroll.owner" } }, null, 2),
	],
	xml: [
		`<sailpoint>\n  <Application name="HR Feed" type="DelimitedFile" id="a1" modified="1700000000000">\n    <Attributes><Map>\n      <entry key="file" value="/data/hr.csv"/>\n      <entry key="delimiter" value=","/>\n    </Map></Attributes>\n    <Owner><Reference class="sailpoint.object.Identity" name="spadmin"/></Owner>\n  </Application>\n</sailpoint>`,
		`<sailpoint>\n  <Application name="HR Feed" type="DelimitedFile" id="b2" modified="1800000000000">\n    <Attributes><Map>\n      <entry key="delimiter" value=";"/>\n      <entry key="file" value="/data/hr-v2.csv"/>\n      <entry key="hasHeader" value="true"/>\n    </Map></Attributes>\n    <Owner><Reference class="sailpoint.object.Identity" name="payroll.owner"/></Owner>\n  </Application>\n</sailpoint>`,
	],
};
