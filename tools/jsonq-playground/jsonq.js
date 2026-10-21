// JSONPath (RFC 9535) and a small jq subset. Pure functions, no DOM.
// JSONPath: root $, child .name and ['name'], wildcard, index and negative index, slices, unions, descendant .., filters with
// comparison, && || !, existence tests and the functions length, count, match, search and value.
// jq: identity, fields, [], slices, .., pipes, commas, construction of arrays and objects, if, //, comparison and arithmetic, and the
// common built-ins listed in JQ_FUNCTIONS. Not covered: variables (as), reduce, foreach, def, path expressions that assign, modules.

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

function deepEqual(a, b) {
	if (a === b) return true;
	if (typeOf(a) !== typeOf(b)) return false;
	if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
	if (isObj(a)) {
		const ka = Object.keys(a), kb = Object.keys(b);
		return ka.length === kb.length && ka.every((k) => k in b && deepEqual(a[k], b[k]));
	}
	return false;
}

// ================================================================== JSONPath

const NOTHING = Symbol("nothing");
const quoteName = (k) => `['${String(k).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;

class PathError extends Error {}

class PathParser {
	constructor(src) {
		this.s = src;
		this.i = 0;
	}
	fail(msg) {
		throw new PathError(`${msg} (at position ${this.i})`);
	}
	peek(n = 0) {
		return this.s[this.i + n];
	}
	ws() {
		while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
	}
	eat(str) {
		if (this.s.startsWith(str, this.i)) {
			this.i += str.length;
			return true;
		}
		return false;
	}
	expect(str) {
		if (!this.eat(str)) this.fail(`Expected "${str}"`);
	}

	query() {
		this.ws();
		this.expect("$");
		const segments = this.segments();
		this.ws();
		if (this.i < this.s.length) this.fail(`Unexpected "${this.peek()}"`);
		return { root: "$", segments };
	}

	segments(allowSpace = true) {
		const segs = [];
		for (;;) {
			const save = this.i;
			if (allowSpace) this.ws();
			if (this.eat("..")) {
				if (this.peek() === "[") segs.push({ desc: true, selectors: this.bracket() });
				else if (this.eat("*")) segs.push({ desc: true, selectors: [{ t: "wild" }] });
				else segs.push({ desc: true, selectors: [{ t: "name", name: this.shortName() }] });
			} else if (this.peek() === ".") {
				this.i++;
				if (this.eat("*")) segs.push({ desc: false, selectors: [{ t: "wild" }] });
				else segs.push({ desc: false, selectors: [{ t: "name", name: this.shortName() }] });
			} else if (this.peek() === "[") {
				segs.push({ desc: false, selectors: this.bracket() });
			} else {
				this.i = save;
				return segs;
			}
		}
	}

	shortName() {
		const m = /^[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*/.exec(this.s.slice(this.i));
		if (!m) this.fail("Expected a member name");
		this.i += m[0].length;
		return m[0];
	}

	string() {
		const q = this.peek();
		if (q !== "'" && q !== '"') this.fail("Expected a string");
		this.i++;
		let out = "";
		while (this.i < this.s.length && this.s[this.i] !== q) {
			let c = this.s[this.i++];
			if (c === "\\") {
				const n = this.s[this.i++];
				const map = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", "/": "/", "\\": "\\", "'": "'", '"': '"' };
				if (n === "u") {
					const hex = this.s.slice(this.i, this.i + 4);
					if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("Bad \\u escape");
					c = String.fromCharCode(parseInt(hex, 16));
					this.i += 4;
				} else if (n in map) c = map[n];
				else this.fail(`Bad escape \\${n}`);
			}
			out += c;
		}
		if (this.s[this.i] !== q) this.fail("Unterminated string");
		this.i++;
		return out;
	}

	int() {
		const m = /^-?(0|[1-9][0-9]*)/.exec(this.s.slice(this.i));
		if (!m) return null;
		this.i += m[0].length;
		return Number(m[0]);
	}

	bracket() {
		this.expect("[");
		const sels = [];
		for (;;) {
			this.ws();
			sels.push(this.selector());
			this.ws();
			if (this.eat(",")) continue;
			this.expect("]");
			return sels;
		}
	}

	selector() {
		const c = this.peek();
		if (c === "'" || c === '"') return { t: "name", name: this.string() };
		if (c === "*") {
			this.i++;
			return { t: "wild" };
		}
		if (c === "?") {
			this.i++;
			this.ws();
			return { t: "filter", expr: this.logicalOr() };
		}
		const start = this.int();
		this.ws();
		if (this.peek() === ":") {
			this.i++;
			this.ws();
			const end = this.int();
			this.ws();
			let step = null;
			if (this.eat(":")) {
				this.ws();
				step = this.int();
			}
			return { t: "slice", start, end, step };
		}
		if (start === null) this.fail("Expected a selector");
		return { t: "index", index: start };
	}

	// ---- filter expressions
	logicalOr() {
		let left = this.logicalAnd();
		for (;;) {
			this.ws();
			if (this.eat("||")) left = { t: "or", a: left, b: this.logicalAnd() };
			else return left;
		}
	}
	logicalAnd() {
		let left = this.basic();
		for (;;) {
			this.ws();
			if (this.eat("&&")) left = { t: "and", a: left, b: this.basic() };
			else return left;
		}
	}
	basic() {
		this.ws();
		if (this.eat("!")) {
			this.ws();
			return { t: "not", e: this.basic() };
		}
		if (this.peek() === "(") {
			this.i++;
			const e = this.logicalOr();
			this.ws();
			this.expect(")");
			return e;
		}
		const left = this.comparable(true);
		this.ws();
		const op = ["==", "!=", "<=", ">=", "<", ">"].find((o) => this.s.startsWith(o, this.i));
		if (op) {
			this.i += op.length;
			this.ws();
			return { t: "cmp", op, a: left, b: this.comparable(false) };
		}
		if (left.t === "lit") this.fail("A literal alone is not a test");
		return { t: "test", e: left };
	}
	comparable() {
		this.ws();
		const c = this.peek();
		if (c === "@" || c === "$") {
			this.i++;
			return { t: "query", root: c, segments: this.segments(false) };
		}
		if (c === "'" || c === '"') return { t: "lit", v: this.string() };
		if (c === "-" || /[0-9]/.test(c)) {
			const m = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(this.s.slice(this.i));
			if (!m) this.fail("Bad number");
			this.i += m[0].length;
			return { t: "lit", v: Number(m[0]) };
		}
		const word = /^[a-z][a-z0-9_]*/.exec(this.s.slice(this.i));
		if (word) {
			const name = word[0];
			if (name === "true" || name === "false" || name === "null") {
				this.i += name.length;
				return { t: "lit", v: name === "true" ? true : name === "false" ? false : null };
			}
			this.i += name.length;
			this.expect("(");
			const args = [];
			this.ws();
			if (!this.eat(")")) {
				for (;;) {
					args.push(this.comparable());
					this.ws();
					if (this.eat(",")) continue;
					this.expect(")");
					break;
				}
			}
			const arity = { length: 1, count: 1, match: 2, search: 2, value: 1 }[name];
			if (arity === undefined) this.fail(`Unknown function ${name}()`);
			if (args.length !== arity) this.fail(`${name}() takes ${arity} argument${arity === 1 ? "" : "s"}`);
			return { t: "fn", name, args };
		}
		return this.fail("Expected a value, a query or a function");
	}
}

function childrenOf(node) {
	const { value, path } = node;
	if (Array.isArray(value)) return value.map((v, i) => ({ value: v, path: `${path}[${i}]` }));
	if (isObj(value)) return Object.keys(value).map((k) => ({ value: value[k], path: path + quoteName(k) }));
	return [];
}

function descendantsOrSelf(node, out = []) {
	out.push(node);
	for (const c of childrenOf(node)) descendantsOrSelf(c, out);
	return out;
}

function sliceIndices(len, start, end, step) {
	step = step === null || step === undefined ? 1 : step;
	if (step === 0) return [];
	const norm = (i) => (i >= 0 ? i : len + i);
	let lo, hi;
	if (step > 0) {
		const s = start === null ? 0 : norm(start), e = end === null ? len : norm(end);
		lo = Math.min(Math.max(s, 0), len);
		hi = Math.min(Math.max(e, 0), len);
		const out = [];
		for (let i = lo; i < hi; i += step) out.push(i);
		return out;
	}
	const s = start === null ? len - 1 : norm(start), e = end === null ? -1 : norm(end);
	lo = Math.min(Math.max(s, -1), len - 1);
	hi = Math.min(Math.max(e, -1), len - 1);
	const out = [];
	for (let i = lo; i > hi; i += step) out.push(i);
	return out;
}

function applySelector(sel, node, ctx) {
	const { value, path } = node;
	switch (sel.t) {
		case "name":
			return isObj(value) && Object.prototype.hasOwnProperty.call(value, sel.name) ? [{ value: value[sel.name], path: path + quoteName(sel.name) }] : [];
		case "wild":
			return childrenOf(node);
		case "index": {
			if (!Array.isArray(value)) return [];
			const i = sel.index >= 0 ? sel.index : value.length + sel.index;
			return i >= 0 && i < value.length ? [{ value: value[i], path: `${path}[${i}]` }] : [];
		}
		case "slice":
			return Array.isArray(value) ? sliceIndices(value.length, sel.start, sel.end, sel.step).map((i) => ({ value: value[i], path: `${path}[${i}]` })) : [];
		case "filter":
			return childrenOf(node).filter((c) => truthy(evalFilter(sel.expr, c, ctx)));
		default:
			return [];
	}
}

function runSegments(segments, nodes, ctx) {
	for (const seg of segments) {
		const next = [];
		for (const n of nodes) {
			const targets = seg.desc ? descendantsOrSelf(n) : [n];
			for (const t of targets) for (const sel of seg.selectors) next.push(...applySelector(sel, t, ctx));
		}
		nodes = next;
	}
	return nodes;
}

function truthy(v) {
	return v === true;
}

function evalFilter(e, current, ctx) {
	switch (e.t) {
		case "or":
			return truthy(evalFilter(e.a, current, ctx)) || truthy(evalFilter(e.b, current, ctx));
		case "and":
			return truthy(evalFilter(e.a, current, ctx)) && truthy(evalFilter(e.b, current, ctx));
		case "not":
			return !truthy(evalFilter(e.e, current, ctx));
		case "test":
			if (e.e.t === "query") return runSegments(e.e.segments, [e.e.root === "@" ? current : ctx.root], ctx).length > 0;
			if (e.e.t === "fn") {
				const v = evalComparable(e.e, current, ctx);
				return v === NOTHING ? false : v === true || (e.e.name !== "match" && e.e.name !== "search" ? v !== false : false);
			}
			return false;
		case "cmp": {
			const a = evalComparable(e.a, current, ctx), b = evalComparable(e.b, current, ctx);
			return compare(e.op, a, b);
		}
		default:
			return false;
	}
}

function evalComparable(c, current, ctx) {
	if (c.t === "lit") return c.v;
	if (c.t === "query") {
		const nodes = runSegments(c.segments, [c.root === "@" ? current : ctx.root], ctx);
		return nodes.length === 1 ? nodes[0].value : NOTHING;
	}
	if (c.t === "fn") {
		const args = c.args.map((a) => (a.t === "query" ? queryArg(a, current, ctx) : evalComparable(a, current, ctx)));
		switch (c.name) {
			case "length": {
				const v = args[0].nodes ? (args[0].nodes.length === 1 ? args[0].nodes[0].value : NOTHING) : args[0];
				if (v === NOTHING) return NOTHING;
				if (typeof v === "string") return [...v].length;
				if (Array.isArray(v)) return v.length;
				if (isObj(v)) return Object.keys(v).length;
				return NOTHING;
			}
			case "count":
				return args[0].nodes ? args[0].nodes.length : NOTHING;
			case "value":
				return args[0].nodes ? (args[0].nodes.length === 1 ? args[0].nodes[0].value : NOTHING) : args[0];
			case "match":
			case "search": {
				const v = args[0].nodes ? (args[0].nodes.length === 1 ? args[0].nodes[0].value : NOTHING) : args[0];
				const r = args[1].nodes ? (args[1].nodes.length === 1 ? args[1].nodes[0].value : NOTHING) : args[1];
				if (typeof v !== "string" || typeof r !== "string") return false;
				try {
					return new RegExp(c.name === "match" ? `^(?:${r})$` : r, "u").test(v);
				} catch (e) {
					return false;
				}
			}
			default:
				return NOTHING;
		}
	}
	return NOTHING;
}

function queryArg(a, current, ctx) {
	return { nodes: runSegments(a.segments, [a.root === "@" ? current : ctx.root], ctx) };
}

function compare(op, a, b) {
	const eq = (x, y) => (x === NOTHING || y === NOTHING ? x === y : deepEqual(x, y));
	const lt = (x, y) => (typeof x === "number" && typeof y === "number") || (typeof x === "string" && typeof y === "string") ? x < y : false;
	switch (op) {
		case "==": return eq(a, b);
		case "!=": return !eq(a, b);
		case "<": return lt(a, b);
		case ">": return lt(b, a);
		case "<=": return lt(a, b) || eq(a, b);
		case ">=": return lt(b, a) || eq(a, b);
		default: return false;
	}
}

/** @returns {{ok: true, matches: {path: string, value: any}[]} | {ok: false, error: string}} */
export function queryJsonPath(data, expression) {
	let q;
	try {
		q = new PathParser(String(expression)).query();
	} catch (e) {
		if (e instanceof PathError) return { ok: false, error: e.message };
		throw e;
	}
	const nodes = runSegments(q.segments, [{ value: data, path: "$" }], { root: { value: data, path: "$" } });
	return { ok: true, matches: nodes.map((n) => ({ path: n.path, value: n.value })) };
}

// ================================================================== jq

class JqError extends Error {}

const JQ_KEYWORDS = new Set(["and", "or", "not", "if", "then", "elif", "else", "end", "true", "false", "null"]);

function jqTokens(src) {
	const toks = [];
	let i = 0;
	const fail = (m) => {
		throw new JqError(`${m} (at position ${i})`);
	};
	while (i < src.length) {
		const c = src[i];
		if (/\s/.test(c)) { i++; continue; }
		if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
		if (c === '"') {
			const start = i;
			i++;
			const parts = []; // strings and {expr: source}
			let cur = "";
			while (i < src.length && src[i] !== '"') {
				if (src[i] === "\\") {
					const n = src[i + 1];
					if (n === "(") {
						let depth = 1, j = i + 2;
						while (j < src.length && depth) {
							if (src[j] === "(") depth++;
							else if (src[j] === ")") depth--;
							else if (src[j] === '"') { j++; while (j < src.length && src[j] !== '"') j += src[j] === "\\" ? 2 : 1; }
							j++;
						}
						if (depth) fail("Unterminated string interpolation");
						if (cur) parts.push(cur);
						cur = "";
						parts.push({ expr: src.slice(i + 2, j - 1) });
						i = j;
						continue;
					}
					const map = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", "\\": "\\", '"': '"', "/": "/" };
					if (n === "u") { cur += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)); i += 6; continue; }
					if (!(n in map)) fail(`Bad escape \\${n}`);
					cur += map[n];
					i += 2;
					continue;
				}
				cur += src[i++];
			}
			if (src[i] !== '"') { i = start; fail("Unterminated string"); }
			i++;
			if (cur || !parts.length) parts.push(cur);
			toks.push({ k: "str", parts });
			continue;
		}
		const num = /^(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/.exec(src.slice(i));
		if (num && !(c === "." && !/[0-9]/.test(src[i + 1] || ""))) { toks.push({ k: "num", v: Number(num[0]) }); i += num[0].length; continue; }
		if (src.startsWith("..", i)) { toks.push({ k: "op", v: ".." }); i += 2; continue; }
		const three = src.slice(i, i + 2);
		if (["==", "!=", "<=", ">=", "//"].includes(three)) { toks.push({ k: "op", v: three }); i += 2; continue; }
		if (c === "." && /[A-Za-z_]/.test(src[i + 1] || "")) {
			const m = /^\.([A-Za-z_][A-Za-z0-9_]*)/.exec(src.slice(i));
			toks.push({ k: "field", v: m[1] });
			i += m[0].length;
			continue;
		}
		if (c === "." && src[i + 1] === '"') { toks.push({ k: "op", v: "." }); i++; continue; }
		if (/[A-Za-z_]/.test(c)) {
			const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
			toks.push({ k: "id", v: m[0] });
			i += m[0].length;
			continue;
		}
		if ("|,()[]{}:;?.<>+-*/%".includes(c)) { toks.push({ k: "op", v: c }); i++; continue; }
		fail(`Unexpected "${c}"`);
	}
	return toks;
}

class JqParser {
	constructor(src) {
		this.t = jqTokens(src);
		this.i = 0;
		this.src = src;
	}
	peek() { return this.t[this.i]; }
	isOp(v) { const t = this.peek(); return t && t.k === "op" && t.v === v; }
	isId(v) { const t = this.peek(); return t && t.k === "id" && t.v === v; }
	next() { return this.t[this.i++]; }
	fail(m) { throw new JqError(m); }
	expectOp(v) { if (!this.isOp(v)) this.fail(`Expected "${v}"${this.peek() ? ` but found "${this.peek().v ?? this.peek().k}"` : " at the end of the program"}`); this.i++; }
	expectId(v) { if (!this.isId(v)) this.fail(`Expected "${v}"`); this.i++; }

	program() {
		const e = this.pipe();
		if (this.peek()) this.fail(`Unexpected "${this.peek().v ?? this.peek().k}"`);
		return e;
	}
	pipe() {
		let left = this.comma();
		while (this.isOp("|")) {
			this.i++;
			left = { t: "pipe", a: left, b: this.comma() };
		}
		return left;
	}
	comma() {
		let left = this.alt();
		while (this.isOp(",")) {
			this.i++;
			left = { t: "comma", a: left, b: this.alt() };
		}
		return left;
	}
	alt() {
		let left = this.or();
		if (this.isOp("//")) {
			this.i++;
			return { t: "alt", a: left, b: this.alt() };
		}
		return left;
	}
	or() {
		let left = this.and();
		while (this.isId("or")) { this.i++; left = { t: "or", a: left, b: this.and() }; }
		return left;
	}
	and() {
		let left = this.cmp();
		while (this.isId("and")) { this.i++; left = { t: "and", a: left, b: this.cmp() }; }
		return left;
	}
	cmp() {
		let left = this.add();
		const t = this.peek();
		if (t && t.k === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(t.v)) {
			this.i++;
			return { t: "cmp", op: t.v, a: left, b: this.add() };
		}
		return left;
	}
	add() {
		let left = this.mul();
		for (;;) {
			const t = this.peek();
			if (t && t.k === "op" && (t.v === "+" || t.v === "-")) { this.i++; left = { t: "arith", op: t.v, a: left, b: this.mul() }; }
			else return left;
		}
	}
	mul() {
		let left = this.postfix();
		for (;;) {
			const t = this.peek();
			if (t && t.k === "op" && (t.v === "*" || t.v === "/" || t.v === "%")) { this.i++; left = { t: "arith", op: t.v, a: left, b: this.postfix() }; }
			else return left;
		}
	}
	postfix() {
		let e = this.term();
		for (;;) {
			const t = this.peek();
			if (!t) return e;
			if (t.k === "field") { this.i++; e = { t: "pipe", a: e, b: { t: "field", name: t.v } }; }
			else if (t.k === "op" && t.v === "." && this.t[this.i + 1] && this.t[this.i + 1].k === "str") {
				this.i++;
				const s = this.next();
				e = { t: "pipe", a: e, b: { t: "fieldx", key: this.strNode(s) } };
			} else if (t.k === "op" && t.v === "[") e = { t: "pipe", a: e, b: this.bracket() };
			else if (t.k === "op" && t.v === "." && this.t[this.i + 1] && this.t[this.i + 1].k === "op" && this.t[this.i + 1].v === "[") { this.i++; e = { t: "pipe", a: e, b: this.bracket() }; }
			else if (t.k === "op" && t.v === "?") { this.i++; e = { t: "try", e }; }
			else return e;
		}
	}
	bracket() {
		this.expectOp("[");
		if (this.isOp("]")) { this.i++; return { t: "iterate" }; }
		let lo = null;
		if (!this.isOp(":")) lo = this.pipe();
		if (this.isOp(":")) {
			this.i++;
			let hi = null;
			if (!this.isOp("]")) hi = this.pipe();
			this.expectOp("]");
			return { t: "slice", lo, hi };
		}
		this.expectOp("]");
		return { t: "index", e: lo };
	}
	strNode(tok) {
		if (tok.parts.length === 1 && typeof tok.parts[0] === "string") return { t: "lit", v: tok.parts[0] };
		return { t: "interp", parts: tok.parts.map((p) => (typeof p === "string" ? p : new JqParser(p.expr).program())) };
	}
	term() {
		const t = this.peek();
		if (!t) this.fail("Unexpected end of program");
		if (t.k === "num") { this.i++; return { t: "lit", v: t.v }; }
		if (t.k === "str") { this.i++; return this.strNode(t); }
		if (t.k === "field") { this.i++; return { t: "field", name: t.v }; }
		if (t.k === "op") {
			if (t.v === "..") { this.i++; return { t: "recurse" }; }
			if (t.v === ".") {
				this.i++;
				const n = this.peek();
				if (n && n.k === "str") { this.i++; return { t: "fieldx", key: this.strNode(n) }; }
				if (this.isOp("[")) return this.bracket();
				return { t: "identity" };
			}
			if (t.v === "(") { this.i++; const e = this.pipe(); this.expectOp(")"); return e; }
			if (t.v === "[") {
				this.i++;
				if (this.isOp("]")) { this.i++; return { t: "array", e: null }; }
				const e = this.pipe();
				this.expectOp("]");
				return { t: "array", e };
			}
			if (t.v === "{") return this.object();
			if (t.v === "-") { this.i++; return { t: "neg", e: this.postfix() }; }
		}
		if (t.k === "id") {
			if (t.v === "true") { this.i++; return { t: "lit", v: true }; }
			if (t.v === "false") { this.i++; return { t: "lit", v: false }; }
			if (t.v === "null") { this.i++; return { t: "lit", v: null }; }
			if (t.v === "if") return this.ifExpr();
			if (t.v === "not") { this.i++; return { t: "call", name: "not", args: [] }; }
			this.i++;
			const args = [];
			if (this.isOp("(")) {
				this.i++;
				for (;;) {
					args.push(this.pipe());
					if (this.isOp(";")) { this.i++; continue; }
					this.expectOp(")");
					break;
				}
			}
			return { t: "call", name: t.v, args };
		}
		return this.fail(`Unexpected "${t.v ?? t.k}"`);
	}
	ifExpr() {
		this.expectId("if");
		const cond = this.pipe();
		this.expectId("then");
		const then = this.pipe();
		let els = { t: "identity" };
		if (this.isId("elif")) {
			this.t[this.i] = { k: "id", v: "if" };
			els = this.ifExprNoEnd();
			return { t: "if", cond, then, els };
		}
		if (this.isId("else")) { this.i++; els = this.pipe(); }
		this.expectId("end");
		return { t: "if", cond, then, els };
	}
	ifExprNoEnd() {
		return this.ifExpr();
	}
	object() {
		this.expectOp("{");
		const entries = [];
		if (this.isOp("}")) { this.i++; return { t: "object", entries }; }
		for (;;) {
			const t = this.next();
			let key;
			if (t && t.k === "id") key = { t: "lit", v: t.v };
			else if (t && t.k === "str") key = this.strNode(t);
			else if (t && t.k === "num") key = { t: "lit", v: String(t.v) };
			else if (t && t.k === "op" && t.v === "(") { key = this.pipe(); this.expectOp(")"); }
			else if (t && t.k === "field") { entries.push({ key: { t: "lit", v: t.v }, value: { t: "field", name: t.v } }); if (this.isOp(",")) { this.i++; continue; } this.expectOp("}"); break; }
			else return this.fail("Bad object key");
			let value;
			if (this.isOp(":")) { this.i++; value = this.alt(); while (this.isOp("|") && false) this.i++; }
			else if (key.t === "lit") value = { t: "field", name: key.v };
			else return this.fail('Expected ":" in object');
			entries.push({ key, value });
			if (this.isOp(",")) { this.i++; continue; }
			this.expectOp("}");
			break;
		}
		return { t: "object", entries };
	}
}

const MAX_STEPS = 200000;

function jqType(v) {
	return v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "boolean" ? "boolean" : typeof v;
}
const typeRank = { null: 0, boolean: 1, number: 2, string: 3, array: 4, object: 5 };
function jqCompare(a, b) {
	const ta = jqType(a), tb = jqType(b);
	if (ta !== tb) return typeRank[ta] - typeRank[tb];
	if (ta === "boolean") return Number(a) - Number(b);
	if (ta === "number") return a - b;
	if (ta === "string") return a < b ? -1 : a > b ? 1 : 0;
	if (ta === "array") {
		for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = jqCompare(a[i], b[i]); if (c) return c; }
		return a.length - b.length;
	}
	if (ta === "object") {
		const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
		const c = jqCompare(ka, kb);
		if (c) return c;
		for (const k of ka) { const d = jqCompare(a[k], b[k]); if (d) return d; }
	}
	return 0;
}
const jqTruthy = (v) => v !== null && v !== false;
const jqStr = (v) => (typeof v === "string" ? v : JSON.stringify(v));

function arith(op, a, b) {
	if (op === "+") {
		if (a === null) return b;
		if (b === null) return a;
		if (typeof a === "number" && typeof b === "number") return a + b;
		if (typeof a === "string" && typeof b === "string") return a + b;
		if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
		if (isObj(a) && isObj(b)) return { ...a, ...b };
		throw new JqError(`${jqType(a)} and ${jqType(b)} cannot be added`);
	}
	if (op === "-") {
		if (typeof a === "number" && typeof b === "number") return a - b;
		if (Array.isArray(a) && Array.isArray(b)) return a.filter((x) => !b.some((y) => deepEqual(x, y)));
		throw new JqError(`${jqType(a)} and ${jqType(b)} cannot be subtracted`);
	}
	if (op === "*") {
		if (typeof a === "number" && typeof b === "number") return a * b;
		if (typeof a === "string" && typeof b === "number") return b > 0 ? a.repeat(Math.ceil(b)) : null;
		throw new JqError(`${jqType(a)} and ${jqType(b)} cannot be multiplied`);
	}
	if (op === "/") {
		if (typeof a === "number" && typeof b === "number") {
			if (b === 0) throw new JqError("Division by zero");
			return a / b;
		}
		if (typeof a === "string" && typeof b === "string") return a.split(b);
		throw new JqError(`${jqType(a)} and ${jqType(b)} cannot be divided`);
	}
	if (typeof a === "number" && typeof b === "number") {
		if (b === 0) throw new JqError("Division by zero");
		return a % b;
	}
	throw new JqError(`${jqType(a)} and ${jqType(b)} cannot be used with %`);
}

export const JQ_FUNCTIONS = [
	"length", "keys", "values", "has(k)", "type", "add", "first", "last", "sort", "sort_by(f)", "unique", "unique_by(f)", "reverse", "min", "max", "min_by(f)", "max_by(f)",
	"tostring", "tonumber", "tojson", "fromjson", "test(re)", "test(re; flags)", "startswith(s)", "endswith(s)", "contains(x)", "inside(x)", "ascii_downcase", "ascii_upcase",
	"join(sep)", "split(sep)", "ltrimstr(s)", "rtrimstr(s)", "to_entries", "from_entries", "with_entries(f)", "flatten", "map(f)", "map_values(f)", "select(f)", "empty", "not",
	"any", "all", "any(f)", "all(f)", "group_by(f)", "floor", "ceil", "round", "abs", "recurse", "range(n)", "isnumber", "isstring", "isnull", "arrays", "objects", "strings", "numbers", "nulls", "booleans", "del(path)", "first(f)", "limit(n; f)", "env",
];

function evalJq(node, input, st) {
	if (++st.steps > MAX_STEPS) throw new JqError("The program ran for too many steps and was stopped");
	switch (node.t) {
		case "identity": return [input];
		case "lit": return [node.v];
		case "interp": {
			let outs = [""];
			for (const p of node.parts) {
				if (typeof p === "string") outs = outs.map((o) => o + p);
				else {
					const vals = evalJq(p, input, st);
					outs = outs.flatMap((o) => vals.map((v) => o + jqStr(v)));
				}
			}
			return outs;
		}
		case "field": {
			if (input === null) return [null];
			if (!isObj(input)) throw new JqError(`Cannot index ${jqType(input)} with "${node.name}"`);
			return [input[node.name] === undefined ? null : input[node.name]];
		}
		case "fieldx": return evalJq(node.key, input, st).map((k) => {
			if (input === null) return null;
			if (!isObj(input)) throw new JqError(`Cannot index ${jqType(input)} with "${k}"`);
			return input[k] === undefined ? null : input[k];
		});
		case "index": return evalJq(node.e, input, st).map((k) => {
			if (input === null) return null;
			if (Array.isArray(input) && typeof k === "number") { const i = k < 0 ? input.length + k : k; return i >= 0 && i < input.length ? input[Math.floor(i)] : null; }
			if (isObj(input) && typeof k === "string") return input[k] === undefined ? null : input[k];
			throw new JqError(`Cannot index ${jqType(input)} with ${jqType(k)}`);
		});
		case "slice": {
			const los = node.lo ? evalJq(node.lo, input, st) : [null], his = node.hi ? evalJq(node.hi, input, st) : [null];
			const out = [];
			for (const lo of los) for (const hi of his) {
				if (input === null) { out.push(null); continue; }
				if (typeof input !== "string" && !Array.isArray(input)) throw new JqError(`Cannot slice ${jqType(input)}`);
				const n = input.length;
				const norm = (x, d) => (x === null ? d : Math.min(Math.max(x < 0 ? n + x : x, 0), n));
				const a = Math.floor(norm(lo, 0)), b = Math.ceil(norm(hi, n));
				out.push(input.slice(a, b));
			}
			return out;
		}
		case "iterate":
			if (Array.isArray(input)) return input.slice();
			if (isObj(input)) return Object.values(input);
			throw new JqError(`Cannot iterate over ${jqType(input)}`);
		case "recurse": {
			const out = [];
			const walk = (v) => { out.push(v); if (Array.isArray(v)) v.forEach(walk); else if (isObj(v)) Object.values(v).forEach(walk); };
			walk(input);
			return out;
		}
		case "pipe": return evalJq(node.a, input, st).flatMap((v) => evalJq(node.b, v, st));
		case "comma": return [...evalJq(node.a, input, st), ...evalJq(node.b, input, st)];
		case "neg": return evalJq(node.e, input, st).map((v) => { if (typeof v !== "number") throw new JqError(`${jqType(v)} cannot be negated`); return -v; });
		case "array": return [node.e ? evalJq(node.e, input, st) : []];
		case "object": {
			let objs = [{}];
			for (const { key, value } of node.entries) {
				const keys = evalJq(key, input, st), vals = evalJq(value, input, st);
				objs = objs.flatMap((o) => keys.flatMap((k) => vals.map((v) => {
					if (typeof k !== "string") throw new JqError(`Object keys must be strings, got ${jqType(k)}`);
					return { ...o, [k]: v };
				})));
			}
			return objs;
		}
		case "if": return evalJq(node.cond, input, st).flatMap((c) => (jqTruthy(c) ? evalJq(node.then, input, st) : evalJq(node.els, input, st)));
		case "alt": {
			let any = [];
			try { any = evalJq(node.a, input, st).filter(jqTruthy); } catch (e) { if (!(e instanceof JqError)) throw e; }
			return any.length ? any : evalJq(node.b, input, st);
		}
		case "or": return evalJq(node.a, input, st).flatMap((a) => (jqTruthy(a) ? [true] : evalJq(node.b, input, st).map(jqTruthy)));
		case "and": return evalJq(node.a, input, st).flatMap((a) => (!jqTruthy(a) ? [false] : evalJq(node.b, input, st).map(jqTruthy)));
		case "cmp": return evalJq(node.b, input, st).flatMap((b) => evalJq(node.a, input, st).map((a) => {
			const c = jqCompare(a, b);
			return { "==": c === 0, "!=": c !== 0, "<": c < 0, "<=": c <= 0, ">": c > 0, ">=": c >= 0 }[node.op];
		}));
		case "arith": return evalJq(node.b, input, st).flatMap((b) => evalJq(node.a, input, st).map((a) => arith(node.op, a, b)));
		case "try": try { return evalJq(node.e, input, st); } catch (e) { if (e instanceof JqError) return []; throw e; }
		case "call": return callFn(node, input, st);
		default: throw new JqError(`Unsupported expression ${node.t}`);
	}
}

function callFn(node, input, st) {
	const { name, args } = node;
	const one = (i = 0) => evalJq(args[i], input, st);
	const need = (n) => { if (args.length !== n) throw new JqError(`${name}/${args.length} is not defined (it takes ${n} argument${n === 1 ? "" : "s"})`); };
	const mapArg = (f, v) => evalJq(f, v, st);
	const arr = () => { if (!Array.isArray(input)) throw new JqError(`${name} needs an array, got ${jqType(input)}`); return input; };
	const str = () => { if (typeof input !== "string") throw new JqError(`${name} needs a string, got ${jqType(input)}`); return input; };
	switch (name) {
		case "empty": return [];
		case "not": return [!jqTruthy(input)];
		case "length":
			if (input === null) return [0];
			if (typeof input === "string") return [[...input].length];
			if (Array.isArray(input)) return [input.length];
			if (isObj(input)) return [Object.keys(input).length];
			if (typeof input === "number") return [Math.abs(input)];
			throw new JqError(`${jqType(input)} has no length`);
		case "keys": if (isObj(input)) return [Object.keys(input).sort()]; if (Array.isArray(input)) return [input.map((_, i) => i)]; throw new JqError(`${jqType(input)} has no keys`);
		case "values": return input === null ? [] : [input];
		case "has": need(1); return one().map((k) => (isObj(input) ? typeof k === "string" && Object.prototype.hasOwnProperty.call(input, k) : Array.isArray(input) ? typeof k === "number" && k >= 0 && k < input.length : (() => { throw new JqError(`Cannot check whether ${jqType(input)} has a key`); })()));
		case "type": return [jqType(input)];
		case "add": return [arr().reduce((acc, v) => arith("+", acc, v), null)];
		case "first": if (args.length === 0) return [arr().length ? input[0] : null]; return evalJq(args[0], input, st).slice(0, 1);
		case "last": return [arr().length ? input[input.length - 1] : null];
		case "sort": return [arr().slice().sort(jqCompare)];
		case "sort_by": need(1); return [arr().map((v) => ({ v, k: mapArg(args[0], v) })).sort((a, b) => jqCompare(a.k, b.k)).map((x) => x.v)];
		case "group_by": { need(1); const groups = []; for (const x of arr().map((v) => ({ v, k: mapArg(args[0], v) })).sort((a, b) => jqCompare(a.k, b.k))) { const g = groups[groups.length - 1]; if (g && jqCompare(g.k, x.k) === 0) g.vs.push(x.v); else groups.push({ k: x.k, vs: [x.v] }); } return [groups.map((g) => g.vs)]; }
		case "unique": { const s = arr().slice().sort(jqCompare); return [s.filter((v, i) => i === 0 || jqCompare(s[i - 1], v) !== 0)]; }
		case "unique_by": { need(1); const s = arr().map((v) => ({ v, k: mapArg(args[0], v) })).sort((a, b) => jqCompare(a.k, b.k)); return [s.filter((x, i) => i === 0 || jqCompare(s[i - 1].k, x.k) !== 0).map((x) => x.v)]; }
		case "reverse": if (typeof input === "string") return [[...input].reverse().join("")]; return [arr().slice().reverse()];
		case "min": return [arr().length ? arr().slice().sort(jqCompare)[0] : null];
		case "max": return [arr().length ? arr().slice().sort(jqCompare)[arr().length - 1] : null];
		case "min_by": need(1); return [arr().length ? arr().map((v) => ({ v, k: mapArg(args[0], v) })).sort((a, b) => jqCompare(a.k, b.k))[0].v : null];
		case "max_by": need(1); return [arr().length ? arr().map((v) => ({ v, k: mapArg(args[0], v) })).sort((a, b) => jqCompare(b.k, a.k))[0].v : null];
		case "tostring": return [jqStr(input)];
		case "tonumber": { if (typeof input === "number") return [input]; const n = Number(str()); if (Number.isNaN(n) || input.trim() === "") throw new JqError(`Cannot convert "${input}" to a number`); return [n]; }
		case "tojson": return [JSON.stringify(input)];
		case "fromjson": try { return [JSON.parse(str())]; } catch (e) { throw new JqError(`Invalid JSON text: ${e.message}`); }
		case "test": { const re = one(0)[0]; const flags = args[1] ? one(1)[0] : ""; try { return [new RegExp(re, `${String(flags).replace(/[^imsu]/g, "").replace(/x/g, "")}`).test(str())]; } catch (e) { throw new JqError(`Bad regular expression: ${e.message}`); } }
		case "startswith": need(1); return one().map((s) => str().startsWith(s));
		case "endswith": need(1); return one().map((s) => str().endsWith(s));
		case "ltrimstr": need(1); return one().map((s) => (typeof input === "string" && typeof s === "string" && input.startsWith(s) ? input.slice(s.length) : input));
		case "rtrimstr": need(1); return one().map((s) => (typeof input === "string" && typeof s === "string" && input.endsWith(s) && s ? input.slice(0, -s.length) : input));
		case "ascii_downcase": return [str().replace(/[A-Z]/g, (c) => c.toLowerCase())];
		case "ascii_upcase": return [str().replace(/[a-z]/g, (c) => c.toUpperCase())];
		case "join": need(1); return one().map((sep) => arr().map((v) => (v === null ? "" : jqStr(v))).join(sep));
		case "split": need(1); return one().map((sep) => str().split(sep));
		case "contains": need(1); return one().map((b) => contains(input, b));
		case "inside": need(1); return one().map((b) => contains(b, input));
		case "to_entries": if (!isObj(input)) throw new JqError(`${jqType(input)} has no entries`); return [Object.keys(input).map((k) => ({ key: k, value: input[k] }))];
		case "from_entries": return [Object.fromEntries(arr().map((e) => [String(e.key ?? e.k ?? e.name ?? e.Name ?? e.Key), e.value ?? e.v ?? e.Value ?? null]))];
		case "with_entries": { need(1); if (!isObj(input)) throw new JqError(`${jqType(input)} has no entries`); const es = Object.keys(input).map((k) => ({ key: k, value: input[k] })).flatMap((e) => mapArg(args[0], e)); return [Object.fromEntries(es.map((e) => [String(e.key), e.value]))]; }
		case "flatten": { const depth = args.length ? one()[0] : 1e9; const fl = (a, d) => a.flatMap((x) => (Array.isArray(x) && d > 0 ? fl(x, d - 1) : [x])); return [fl(arr(), depth)]; }
		case "map": need(1); return [arr().flatMap((v) => mapArg(args[0], v))];
		case "map_values": need(1); if (Array.isArray(input)) return [input.flatMap((v) => mapArg(args[0], v).slice(0, 1))]; if (isObj(input)) { const o = {}; for (const k of Object.keys(input)) { const r = mapArg(args[0], input[k]); if (r.length) o[k] = r[0]; } return [o]; } throw new JqError(`Cannot map over ${jqType(input)}`);
		case "select": need(1); return evalJq(args[0], input, st).filter(jqTruthy).map(() => input);
		case "any": return [args.length ? arr().some((v) => mapArg(args[0], v).some(jqTruthy)) : arr().some(jqTruthy)];
		case "all": return [args.length ? arr().every((v) => mapArg(args[0], v).every(jqTruthy)) : arr().every(jqTruthy)];
		case "floor": return [Math.floor(input)];
		case "ceil": return [Math.ceil(input)];
		case "round": return [Math.round(input)];
		case "abs": return [Math.abs(input)];
		case "recurse": return evalJq({ t: "recurse" }, input, st);
		case "range": { need(1); const n = one()[0]; if (typeof n !== "number") throw new JqError("range needs a number"); return Array.from({ length: Math.max(0, Math.min(Math.ceil(n), 100000)) }, (_, i) => i); }
		case "isnumber": return [typeof input === "number"];
		case "isstring": return [typeof input === "string"];
		case "isnull": return [input === null];
		case "arrays": return Array.isArray(input) ? [input] : [];
		case "objects": return isObj(input) ? [input] : [];
		case "strings": return typeof input === "string" ? [input] : [];
		case "numbers": return typeof input === "number" ? [input] : [];
		case "nulls": return input === null ? [input] : [];
		case "booleans": return typeof input === "boolean" ? [input] : [];
		case "del": { need(1); return [deletePaths(input, args[0], st)]; }
		case "limit": { need(2); const n = one(0)[0]; return evalJq(args[1], input, st).slice(0, Math.max(0, n)); }
		case "env": return [{}];
		default: throw new JqError(`${name}/${args.length} is not defined`);
	}
}

function contains(a, b) {
	if (isObj(a) && isObj(b)) return Object.keys(b).every((k) => k in a && contains(a[k], b[k]));
	if (Array.isArray(a) && Array.isArray(b)) return b.every((y) => a.some((x) => contains(x, y)));
	if (typeof a === "string" && typeof b === "string") return a.includes(b);
	return deepEqual(a, b);
}

// del(.a, .b[0], .c[]) for simple paths made of fields, indexes and []
function deletePaths(input, pathExpr, st) {
	const paths = [];
	const collect = (node, base) => {
		if (node.t === "comma") { collect(node.a, base); collect(node.b, base); return; }
		const chain = [];
		const flat = (n) => {
			if (n.t === "pipe") { flat(n.a); flat(n.b); } else chain.push(n);
		};
		flat(node);
		let cur = [base];
		for (const step of chain) {
			const next = [];
			for (const p of cur) {
				const v = getAt(input, p);
				if (step.t === "identity") next.push(p);
				else if (step.t === "field") next.push([...p, step.name]);
				else if (step.t === "index") for (const k of evalJq(step.e, input, st)) next.push([...p, k]);
				else if (step.t === "iterate") { if (Array.isArray(v)) v.forEach((_, i) => next.push([...p, i])); else if (isObj(v)) Object.keys(v).forEach((k) => next.push([...p, k])); }
				else throw new JqError("del() supports simple paths such as .a, .a[0] and .a[]");
			}
			cur = next;
		}
		paths.push(...cur);
	};
	collect(pathExpr, []);
	const clone = JSON.parse(JSON.stringify(input));
	paths.sort((a, b) => b.length - a.length || (typeof b[b.length - 1] === "number" ? b[b.length - 1] : 0) - (typeof a[a.length - 1] === "number" ? a[a.length - 1] : 0));
	for (const p of paths) {
		const parent = getAt(clone, p.slice(0, -1));
		const k = p[p.length - 1];
		if (Array.isArray(parent) && typeof k === "number") parent.splice(k < 0 ? parent.length + k : k, 1);
		else if (isObj(parent)) delete parent[k];
	}
	return clone;
}
function getAt(v, path) {
	let cur = v;
	for (const k of path) { if (cur === null || cur === undefined) return null; cur = cur[k]; }
	return cur === undefined ? null : cur;
}

/** @returns {{ok: true, results: any[]} | {ok: false, error: string}} */
export function runJq(program, data) {
	let ast;
	try {
		ast = new JqParser(String(program)).program();
	} catch (e) {
		if (e instanceof JqError) return { ok: false, error: `Syntax: ${e.message}` };
		throw e;
	}
	try {
		return { ok: true, results: evalJq(ast, data, { steps: 0 }) };
	} catch (e) {
		if (e instanceof JqError) return { ok: false, error: e.message };
		throw e;
	}
}

// ================================================================== samples

export const SAMPLE = {
	data: {
		store: {
			name: "Corner Books",
			books: [
				{ id: 1, title: "Sayings of the Century", category: "reference", author: "Nigel Rees", price: 8.95, tags: ["quotes"] },
				{ id: 2, title: "Sword of Honour", category: "fiction", author: "Evelyn Waugh", price: 12.99, tags: ["war", "satire"] },
				{ id: 3, title: "Moby Dick", category: "fiction", author: "Herman Melville", isbn: "0-553-21311-3", price: 8.99, tags: ["sea"] },
				{ id: 4, title: "The Lord of the Rings", category: "fiction", author: "J. R. R. Tolkien", isbn: "0-395-19395-8", price: 22.99, tags: ["fantasy"] },
			],
			open: true,
		},
	},
	jsonpath: [
		{ label: "All authors", q: "$.store.books[*].author" },
		{ label: "Books under 10", q: "$.store.books[?@.price < 10].title" },
		{ label: "Has an ISBN", q: "$.store.books[?@.isbn].title" },
		{ label: "Every price", q: "$..price" },
		{ label: "Last book", q: "$.store.books[-1]" },
		{ label: "First two", q: "$.store.books[0:2].title" },
		{ label: "Fiction by title match", q: "$.store.books[?match(@.title, 'S.*') && @.category == 'fiction'].title" },
	],
	jq: [
		{ label: "Titles", q: ".store.books[].title" },
		{ label: "Cheap books", q: ".store.books | map(select(.price < 10)) | map(.title)" },
		{ label: "Total price", q: "[.store.books[].price] | add" },
		{ label: "Group by category", q: ".store.books | group_by(.category) | map({category: .[0].category, count: length})" },
		{ label: "Rebuild objects", q: ".store.books[] | {title, cost: (.price * 100 | floor)}" },
		{ label: "Sorted authors", q: "[.store.books[].author] | sort | join(\", \")" },
		{ label: "Interpolation", q: ".store.books[] | \"\\(.title) by \\(.author)\"" },
	],
};
