// BeanShell rule analysis for IIQ -> ISC.
//  1. classify an IIQ rule type to its ISC target (transform / connector rule / declarative config / ...)
//  2. scan for APIs that ISC cloud rules do not allow
//  3. translate simple single-expression rules (the common attribute-generator shape) into ISC transforms

export class Unsupported extends Error {}

// ---------------------------------------------------------------- classification

const T = (mode, isc, hint) => ({ mode, isc, hint });

export const RULE_TARGETS = {
	IdentityAttribute: T("transform", "Transform (or Cloud Rule: IdentityAttribute)", "Rewrite as a transform in the identity profile; keep as a cloud rule only if it cannot be expressed declaratively."),
	FieldValue: T("transform", "Transform in a provisioning policy field", "Move the logic into the field's transform on the source provisioning policy."),
	Correlation: T("declarative", "Account correlation config", "Express the match as attribute assignments on the source; a Correlation cloud rule is the fallback."),
	ManagerCorrelation: T("declarative", "Manager correlation mapping on the source", "Use managerCorrelationMapping (account attribute to identity attribute)."),
	BuildMap: T("connectorRule", "Connector rule: BuildMap", "Delimited file / generic row parsing. Needs SailPoint review or the connector-rule API."),
	MergeMaps: T("connectorRule", "Connector rule: MergeMaps", "Re-test row merging; prefer the connector's built-in mergeRows."),
	PreIterate: T("connectorRule", "Connector rule: PreIterate", "Allowed only on connectors that expose it."),
	PostIterate: T("connectorRule", "Connector rule: PostIterate", "Allowed only on connectors that expose it."),
	ResourceObjectCustomization: T("connectorRule", "Connector rule: ResourceObjectCustomization", "Account aggregation customization; keep logic minimal and null-safe."),
	Customization: T("connectorRule", "Connector rule: ResourceObjectCustomization", "Account aggregation customization; keep logic minimal and null-safe."),
	JDBCBuildMap: T("connectorRule", "Connector rule: JDBCBuildMap", "Row to map conversion for the JDBC connector."),
	JDBCProvision: T("connectorRule", "Connector rule: JDBCProvision", "Provisioning against a JDBC source."),
	JDBCOperationProvisioning: T("connectorRule", "Connector rule: JDBCOperationProvisioning", "Provisioning against a JDBC source."),
	WebServiceBeforeOperationRule: T("connectorRule", "Connector rule: WebServiceBeforeOperationRule", "Web Services before-operation hook."),
	WebServiceAfterOperationRule: T("connectorRule", "Connector rule: WebServiceAfterOperationRule", "Web Services after-operation hook."),
	BeforeProvisioning: T("connectorRule", "Cloud rule: BeforeProvisioning", "Plan manipulation; re-check ProvisioningPlan usage against the ISC rule API."),
	AfterProvisioning: T("connectorRule", "Cloud rule: AfterProvisioning", "Post-provision hook; re-check API usage."),
	SAPBuildMap: T("connectorRule", "Connector rule: SAPBuildMap", "SAP connector rule."),
	Validation: T("manual", "No direct equivalent", "Form field validation: use form conditions or a workflow."),
	Owner: T("manual", "Static owner or workflow", "ISC objects have a single static owner; rule-based owners need a workflow."),
	Policy: T("manual", "SOD policy", "Re-express as an SOD policy over entitlements."),
	Workflow: T("workflow", "Workflow step", "Rebuild inside an ISC workflow."),
	RoleAssignment: T("declarative", "Role membership criteria", "Use role membership criteria; rule-based assignment needs a workflow."),
	IdentitySelector: T("declarative", "Role membership criteria", "Use role membership criteria."),
	IdentityCreation: T("manual", "Identity profile mapping", "Set defaults through identity profile transforms."),
	CertificationExclusion: T("manual", "Campaign filter", "Use campaign filters and exclusions."),
	CertificationAutomaticClosing: T("manual", "Campaign setting", "Use campaign automatic closing settings."),
	CertificationPhaseChange: T("unsupported", "None", "Campaign phase hooks do not exist in ISC."),
	Listener: T("unsupported", "None", "No event-listener rule type in ISC; use event triggers and workflows."),
	Scheduler: T("unsupported", "None", "Use a scheduled workflow."),
	ActivityCollector: T("unsupported", "None", "Activity monitoring is not part of ISC."),
	ActivityTransformer: T("unsupported", "None", "Activity monitoring is not part of ISC."),
	ActivityCorrelation: T("unsupported", "None", "Activity monitoring is not part of ISC."),
	ActivityFieldValue: T("unsupported", "None", "Activity monitoring is not part of ISC."),
	Notification: T("manual", "Email template or workflow", "Use ISC notification templates or a workflow send-email step."),
	Report: T("unsupported", "None", "Use search and saved queries."),
};

export function classifyRule(type) {
	return RULE_TARGETS[type] || T("manual", "Needs analysis", `Unknown rule type "${type || "(none)"}"; review manually.`);
}

// ---------------------------------------------------------------- static scan

const BLOCKERS = [
	[/\bcontext\s*\.\s*(getObject|getObjects|getObjectByName|getObjectById|search|startTransaction|saveObject|commitTransaction|decache|getUserByName|getConfiguration|countObjects|removeObject|attach|iterate)\w*/, "Uses SailPointContext to read or write objects. Cloud rules have no object-store access; use the idn utility object or move the lookup into a workflow."],
	[/\bsailpoint\.api\.|\bProvisioner\b|\bIdentitizer\b|\bSailPointFactory\b|\bAggregator\b|\bCertificationer\b/, "Uses internal sailpoint.api classes that are not available in cloud rules."],
	[/\bsailpoint\.server\.|\bEnvironment\.getEnvironment\b/, "Uses sailpoint.server internals."],
	[/\bjava\.io\.|\bnew\s+File\s*\(|\bFileReader\b|\bFileWriter\b|\bFileInputStream\b|\bFileOutputStream\b|\bBufferedReader\b/, "File I/O is not allowed in cloud rules."],
	[/Runtime\s*\.\s*getRuntime|\bProcessBuilder\b|\.exec\s*\(/, "Process execution is not allowed."],
	[/\bjava\.net\.|\bHttpURLConnection\b|\bHttpClient\b|\bnew\s+URL\s*\(|\bSocket\b/, "Direct network calls are not allowed; use a Web Services source or a workflow HTTP request."],
	[/\bjava\.sql\.|\bDriverManager\b/, "Direct JDBC from a rule; use a JDBC source (JDBC connector rules receive their connection from the connector)."],
	[/\bjavax\.naming\.|\bInitialDirContext\b|\bLdapContext\b/, "Direct LDAP calls are not allowed; use the Active Directory or LDAP source."],
	[/\bThread\b|\bExecutorService\b|\bsynchronized\b|\.sleep\s*\(/, "Threads, locks and sleeps are not allowed."],
	[/System\s*\.\s*(exit|getProperty|getenv|setProperty)/, "System-level calls are not allowed."],
	[/Class\s*\.\s*forName|\bClassLoader\b|java\.lang\.reflect|\.getMethod\s*\(/, "Reflection is not allowed."],
	[/\.decrypt\s*\(|\bencrypt\s*\(|\bgetPlainText\b|\bdecryptAttribute\b/, "Handles encrypted secrets; ISC manages secrets itself and rules cannot decrypt."],
];

const WARNINGS = [
	[/\bProvisioningPlan\b|\bAccountRequest\b|\bAttributeRequest\b/, "Builds or edits a ProvisioningPlan. Valid only in Before and After Provisioning cloud rules, and the plan API surface is narrower in ISC."],
	[/\.getLinks\s*\(|\.getLink\s*\(|\bgetLinkByApplication\b/, "Navigates identity links. ISC rule inputs expose less of the identity; prefer an accountAttribute transform."],
	[/System\s*\.\s*out\s*\.\s*print/, "Prints to stdout; use the log object."],
	[/\bEmailTemplate\b|\bEmailOptions\b|\bsendEmailNotification\b/, "Sends email from a rule; use a workflow send-email step."],
	[/\bQueryOptions\b|\bFilter\s*\.\s*(eq|and|or|like)\b/, "Builds object queries. These need the object store that cloud rules do not have."],
	[/\bgetAttribute\s*\(\s*["'][^"']*[Pp]assword/, "Reads a password attribute; ISC does not expose it to rules."],
	[/\bnew\s+Date\s*\(|\bSimpleDateFormat\b|\bCalendar\b/, "Date handling: ISC offers dateFormat, dateCompare and dateMath transforms; check timezone behavior."],
];

export function scanRule(source) {
	const code = stripComments(source || "");
	const blockers = [];
	const warnings = [];
	for (const [re, msg] of BLOCKERS) if (re.test(code)) blockers.push(msg);
	for (const [re, msg] of WARNINGS) if (re.test(code)) warnings.push(msg);
	return { blockers, warnings };
}

export function stripComments(src) {
	let out = "";
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (c === '"' || c === "'") {
			let j = i + 1;
			while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
			out += src.slice(i, j + 1);
			i = j + 1;
		} else if (c === "/" && src[i + 1] === "/") {
			while (i < src.length && src[i] !== "\n") i++;
		} else if (c === "/" && src[i + 1] === "*") {
			const e = src.indexOf("*/", i + 2);
			i = e < 0 ? src.length : e + 2;
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

// ---------------------------------------------------------------- tokenizer

function tokenize(src) {
	const code = stripComments(src);
	const toks = [];
	let i = 0;
	const isId = (c) => /[A-Za-z0-9_$]/.test(c);
	while (i < code.length) {
		const c = code[i];
		if (/\s/.test(c)) { i++; continue; }
		if (c === '"' || c === "'") {
			let j = i + 1;
			let v = "";
			while (j < code.length && code[j] !== c) {
				if (code[j] === "\\") {
					const n = code[j + 1];
					v += n === "n" ? "\n" : n === "t" ? "\t" : n;
					j += 2;
				} else v += code[j++];
			}
			toks.push({ t: "str", v });
			i = j + 1;
			continue;
		}
		if (/[0-9]/.test(c)) {
			let j = i;
			while (j < code.length && /[0-9.]/.test(code[j])) j++;
			if (/[LlFfDd]/.test(code[j] || "")) j++;
			toks.push({ t: "num", v: code.slice(i, j).replace(/[LlFfDd]$/, "") });
			i = j;
			continue;
		}
		if (isId(c)) {
			let j = i;
			while (j < code.length && isId(code[j])) j++;
			toks.push({ t: "id", v: code.slice(i, j) });
			i = j;
			continue;
		}
		const two = code.slice(i, i + 2);
		if (["==", "!=", "&&", "||", "<=", ">=", "++", "--", "+=", "-="].includes(two)) {
			toks.push({ t: "op", v: two });
			i += 2;
			continue;
		}
		toks.push({ t: "op", v: c });
		i++;
	}
	return toks;
}

// ---------------------------------------------------------------- parser (statements + expressions)

class Parser {
	constructor(toks) {
		this.toks = toks;
		this.i = 0;
	}
	peek(o = 0) { return this.toks[this.i + o]; }
	next() { return this.toks[this.i++]; }
	isOp(v, o = 0) { const t = this.peek(o); return t && t.t === "op" && t.v === v; }
	isId(v, o = 0) { const t = this.peek(o); return t && t.t === "id" && (v === undefined || t.v === v); }
	expectOp(v) {
		if (!this.isOp(v)) throw new Unsupported(`Expected "${v}"`);
		this.i++;
	}

	// ---- statements
	parseBlockBody() {
		const out = [];
		while (this.peek() && !this.isOp("}")) out.push(this.parseStatement());
		return out;
	}
	parseStmtOrBlock() {
		if (this.isOp("{")) {
			this.i++;
			const b = this.parseBlockBody();
			this.expectOp("}");
			return b;
		}
		return [this.parseStatement()];
	}
	parseStatement() {
		if (this.isOp(";")) { this.i++; return { k: "nop" }; }
		const t = this.peek();
		if (t.t === "id") {
			const kw = t.v;
			if (["for", "while", "do", "try", "switch", "throw", "synchronized", "catch"].includes(kw)) {
				throw new Unsupported(`"${kw}" statements cannot be expressed as a transform`);
			}
			if (kw === "import" || kw === "package") {
				while (this.peek() && !this.isOp(";")) this.i++;
				this.i++;
				return { k: "nop" };
			}
			if (kw === "return") {
				this.i++;
				if (this.isOp(";")) { this.i++; return { k: "return", e: { t: "null" } }; }
				const e = this.parseExpr();
				this.expectOp(";");
				return { k: "return", e };
			}
			if (kw === "if") {
				this.i++;
				this.expectOp("(");
				const c = this.parseExpr();
				this.expectOp(")");
				const a = this.parseStmtOrBlock();
				let b = null;
				if (this.isId("else")) { this.i++; b = this.parseStmtOrBlock(); }
				return { k: "if", c, a, b };
			}
			// declaration: [final] Type[<..>][[]] name [= expr];
			let j = 0;
			if (this.isId("final")) j++;
			const first = this.peek(j);
			if (first && first.t === "id") {
				let k = j + 1;
				if (this.isOp("<", k)) {
					let d = 0;
					for (; this.peek(k); k++) {
						if (this.isOp("<", k)) d++;
						if (this.isOp(">", k) && --d === 0) { k++; break; }
					}
				}
				while (this.isOp("[", k) && this.isOp("]", k + 1)) k += 2;
				const nm = this.peek(k);
				if (nm && nm.t === "id" && (this.isOp("=", k + 1) || this.isOp(";", k + 1)) && !["return", "new"].includes(first.v)) {
					this.i += k + 1;
					let e = { t: "null" };
					if (this.isOp("=")) { this.i++; e = this.parseExpr(); }
					this.expectOp(";");
					return { k: "set", name: nm.v, e };
				}
			}
			// assignment: name = expr;
			if (this.isOp("=", 1)) {
				const name = t.v;
				this.i += 2;
				const e = this.parseExpr();
				this.expectOp(";");
				return { k: "set", name, e };
			}
			if (this.isOp("+=", 1)) {
				const name = t.v;
				this.i += 2;
				const e = this.parseExpr();
				this.expectOp(";");
				return { k: "set", name, e: { t: "bin", op: "+", l: { t: "var", name }, r: e } };
			}
			// expression statement
			const e = this.parseExpr();
			this.expectOp(";");
			return { k: "expr", e };
		}
		throw new Unsupported("Unrecognised statement");
	}

	// ---- expressions
	parseExpr() { return this.parseTernary(); }
	parseTernary() {
		const c = this.parseOr();
		if (this.isOp("?")) {
			this.i++;
			const a = this.parseExpr();
			this.expectOp(":");
			const b = this.parseExpr();
			return { t: "cond", c, a, b };
		}
		return c;
	}
	parseOr() {
		let l = this.parseAnd();
		while (this.isOp("||")) { this.i++; l = { t: "bin", op: "||", l, r: this.parseAnd() }; }
		return l;
	}
	parseAnd() {
		let l = this.parseEq();
		while (this.isOp("&&")) { this.i++; l = { t: "bin", op: "&&", l, r: this.parseEq() }; }
		return l;
	}
	parseEq() {
		let l = this.parseAdd();
		while (this.isOp("==") || this.isOp("!=")) {
			const op = this.next().v;
			l = { t: "bin", op, l, r: this.parseAdd() };
		}
		return l;
	}
	parseAdd() {
		let l = this.parseUnary();
		while (this.isOp("+")) { this.i++; l = { t: "bin", op: "+", l, r: this.parseUnary() }; }
		return l;
	}
	parseUnary() {
		if (this.isOp("!")) { this.i++; return { t: "not", e: this.parseUnary() }; }
		return this.parsePostfix();
	}
	parsePostfix() {
		let e = this.parsePrimary();
		for (;;) {
			if (this.isOp(".")) {
				this.i++;
				const nm = this.next();
				if (!nm || nm.t !== "id") throw new Unsupported("Bad member access");
				if (this.isOp("(")) e = { t: "call", target: e, name: nm.v, args: this.parseArgs() };
				else e = { t: "field", target: e, name: nm.v };
			} else if (this.isOp("[")) {
				this.i++;
				const idx = this.parseExpr();
				this.expectOp("]");
				e = { t: "index", e, i: idx };
			} else break;
		}
		return e;
	}
	parseArgs() {
		this.expectOp("(");
		const args = [];
		if (!this.isOp(")")) {
			for (;;) {
				args.push(this.parseExpr());
				if (this.isOp(",")) { this.i++; continue; }
				break;
			}
		}
		this.expectOp(")");
		return args;
	}
	parsePrimary() {
		const t = this.next();
		if (!t) throw new Unsupported("Unexpected end of rule");
		if (t.t === "str") return { t: "str", v: t.v };
		if (t.t === "num") return { t: "num", v: t.v };
		if (t.t === "op" && t.v === "(") {
			// cast like (String) x
			if (this.peek() && this.peek().t === "id" && this.isOp(")", 1) && /^[A-Z]/.test(this.peek().v) && this.peek(2) && (this.peek(2).t === "id" || this.peek(2).t === "str")) {
				this.i += 2;
				return this.parseUnary();
			}
			const e = this.parseExpr();
			this.expectOp(")");
			return e;
		}
		if (t.t === "id") {
			if (t.v === "null") return { t: "null" };
			if (t.v === "true" || t.v === "false") return { t: "bool", v: t.v };
			if (t.v === "new") throw new Unsupported("Object construction (new ...) is not expressible as a transform");
			if (this.isOp("(")) return { t: "call", target: null, name: t.v, args: this.parseArgs() };
			return { t: "var", name: t.v };
		}
		throw new Unsupported(`Unexpected token "${t.v}"`);
	}
}

// ---------------------------------------------------------------- symbolic evaluation

const subst = (e, env) => {
	if (!e || typeof e !== "object") return e;
	switch (e.t) {
		case "var": return Object.prototype.hasOwnProperty.call(env, e.name) ? env[e.name] : e;
		case "call": return { ...e, target: e.target ? subst(e.target, env) : null, args: e.args.map((a) => subst(a, env)) };
		case "field": return { ...e, target: subst(e.target, env) };
		case "bin": return { ...e, l: subst(e.l, env), r: subst(e.r, env) };
		case "not": return { ...e, e: subst(e.e, env) };
		case "cond": return { ...e, c: subst(e.c, env), a: subst(e.a, env), b: subst(e.b, env) };
		case "index": return { ...e, e: subst(e.e, env), i: subst(e.i, env) };
		default: return e;
	}
};

function evalBlock(stmts, env, notes, rest = []) {
	env = { ...env };
	for (let idx = 0; idx < stmts.length; idx++) {
		const s = stmts[idx];
		if (s.k === "nop") continue;
		if (s.k === "set") { env[s.name] = subst(s.e, env); continue; }
		if (s.k === "expr") {
			const e = s.e;
			if (e.t === "call" && e.target && e.target.t === "var" && e.target.name === "log") { notes.add("Logging statements dropped."); continue; }
			throw new Unsupported("Side-effecting statement cannot be expressed as a transform");
		}
		if (s.k === "return") return subst(s.e, env);
		if (s.k === "if") {
			const c = subst(s.c, env);
			// whatever follows the if (in this block, then in the enclosing ones) is the fall-through path
			const after = stmts.slice(idx + 1).concat(rest);
			const thenR = evalBlock(s.a, env, notes, after);
			const elseR = evalBlock(s.b || [], env, notes, after);
			return { t: "cond", c, a: thenR, b: elseR };
		}
	}
	return rest.length ? evalBlock(rest, env, notes, []) : { t: "null" };
}

// ---------------------------------------------------------------- AST -> transform

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const STR = (v) => ({ type: "static", attributes: { value: String(v) } });
const ACCOUNT_VARS = new Set(["link", "account", "resourceObject", "object", "obj", "entry", "record", "acct", "row", "map"]);
const IDENTITY_GETTERS = { getName: "uid", getFirstname: "firstname", getLastname: "lastname", getEmail: "email", getDisplayName: "displayName" };

function isNullCheck(c) {
	// returns { v: <ast>, nullWhen: true|false } for "x == null", "x != null", Util.isNullOrEmpty(x) etc.
	if (c.t === "bin" && (c.op === "==" || c.op === "!=")) {
		if (c.r.t === "null") return { v: c.l, isNull: c.op === "==" };
		if (c.l.t === "null") return { v: c.r, isNull: c.op === "==" };
	}
	if (c.t === "not") {
		const n = isNullCheck(c.e);
		return n ? { v: n.v, isNull: !n.isNull } : null;
	}
	if (c.t === "call" && c.target && c.target.t === "var" && c.target.name === "Util" && c.args.length === 1) {
		if (c.name === "isNullOrEmpty" || c.name === "isEmpty") return { v: c.args[0], isNull: true };
		if (c.name === "isNotNullOrEmpty" || c.name === "isNotEmpty") return { v: c.args[0], isNull: false };
	}
	if (c.t === "bin" && c.op === "||") {
		const l = isNullCheck(c.l);
		const r = isEmptyCompare(c.r);
		if (l && l.isNull && r && same(l.v, r)) return l;
	}
	if (c.t === "bin" && c.op === "&&") {
		const l = isNullCheck(c.l);
		const r = isEmptyCompare(c.r, true);
		if (l && !l.isNull && r && same(l.v, r)) return l;
	}
	return null;
}
function isEmptyCompare(c, negated = false) {
	// x.equals("")  /  x.length() == 0  (or the negated forms when negated=true)
	const emptyStr = (n) => n && n.t === "str" && n.v === "";
	if (!negated) {
		if (c.t === "call" && c.name === "equals" && c.target && c.args.length === 1 && emptyStr(c.args[0])) return c.target;
		if (c.t === "bin" && c.op === "==" && c.l.t === "call" && c.l.name === "length" && c.l.target && c.r.t === "num" && c.r.v === "0") return c.l.target;
	} else {
		if (c.t === "not" && c.e.t === "call" && c.e.name === "equals" && c.e.target && emptyStr(c.e.args[0])) return c.e.target;
		if (c.t === "bin" && c.op === "!=" && c.l.t === "call" && c.l.name === "length" && c.l.target && c.r.t === "num" && c.r.v === "0") return c.l.target;
	}
	return null;
}

export function astToTransform(e, ctx, notes) {
	const tx = (n) => astToTransform(n, ctx, notes);
	const lit = (n) => {
		if (n.t === "str" || n.t === "num") return n.v;
		if (n.t === "bool") return n.v;
		throw new Unsupported("Expected a literal argument");
	};
	switch (e.t) {
		case "str": return STR(e.v);
		case "num": return STR(e.v);
		case "bool": return STR(e.v);
		case "null": throw new Unsupported("Rule path returns null");
		case "var": throw new Unsupported(`Unknown variable "${e.name}"`);
		case "bin": {
			if (e.op === "+") {
				const parts = [];
				const flat = (n) => (n.t === "bin" && n.op === "+" ? (flat(n.l), flat(n.r)) : parts.push(n));
				flat(e);
				const values = parts.map((p) => (p.t === "str" ? p.v : p.t === "num" ? p.v : tx(p)));
				return { type: "concat", attributes: { values } };
			}
			throw new Unsupported(`Operator ${e.op} outside a condition`);
		}
		case "index": {
			const call = e.e;
			if (call.t === "call" && call.name === "split" && call.target && e.i.t === "num") {
				const delim = lit(call.args[0]);
				notes.add("split(): Java treats the delimiter as a regex. Confirm how the ISC split transform treats special characters in the delimiter.");
				return { type: "split", attributes: { input: tx(call.target), delimiter: delim, index: Number(e.i.v), throws: false } };
			}
			throw new Unsupported("Array indexing other than split(...)[n]");
		}
		case "call": return callToTransform(e, ctx, notes, tx, lit);
		case "cond": return condToTransform(e, tx, notes);
		case "not": throw new Unsupported("Negation outside a condition");
		default: throw new Unsupported(`Cannot translate ${e.t}`);
	}
}

function callToTransform(e, ctx, notes, tx, lit) {
	const { target, name, args } = e;
	// static helpers
	if (!target) throw new Unsupported(`Call to ${name}() is not expressible as a transform`);
	if (target.t === "var") {
		const v = target.name;
		if (v === "String" && name === "valueOf" && args.length === 1) return tx(args[0]);
		if (v === "identity") {
			if ((name === "getAttribute" || name === "getStringAttribute" || name === "getStringAttributeValue") && args.length === 1) {
				return { type: "identityAttribute", attributes: { name: lit(args[0]) } };
			}
			if (IDENTITY_GETTERS[name] && args.length === 0) return { type: "identityAttribute", attributes: { name: IDENTITY_GETTERS[name] } };
			throw new Unsupported(`identity.${name}() has no transform equivalent`);
		}
		if (ACCOUNT_VARS.has(v)) {
			if (["getAttribute", "getStringAttribute", "getString", "get", "getStringAttributeValue"].includes(name) && args.length === 1) {
				if (!ctx.sourceName) notes.add("Account attribute read without a known source: set sourceName on the generated transform.");
				return { type: "accountAttribute", attributes: { sourceName: ctx.sourceName || "<<SOURCE>>", attributeName: lit(args[0]) } };
			}
			throw new Unsupported(`${v}.${name}() has no transform equivalent`);
		}
		throw new Unsupported(`Unknown object "${v}"`);
	}
	// string methods on a nested expression
	switch (name) {
		case "toLowerCase": return { type: "lower", attributes: { input: tx(target) } };
		case "toUpperCase": return { type: "upper", attributes: { input: tx(target) } };
		case "trim": case "strip": return { type: "trim", attributes: { input: tx(target) } };
		case "substring": {
			const begin = Number(lit(args[0]));
			const attrs = { input: tx(target), begin };
			attrs.end = args.length > 1 ? Number(lit(args[1])) : -1;
			return { type: "substring", attributes: attrs };
		}
		case "charAt": {
			const k = Number(lit(args[0]));
			return { type: "substring", attributes: { input: tx(target), begin: k, end: k + 1 } };
		}
		case "replace": case "replaceAll": {
			const a = lit(args[0]);
			const r = lit(args[1]);
			const regex = name === "replace" ? String(a).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : String(a);
			return { type: "replace", attributes: { input: tx(target), regex, replacement: String(r) } };
		}
		case "indexOf": return { type: "indexOf", attributes: { input: tx(target), substring: lit(args[0]) } };
		case "concat": return { type: "concat", attributes: { values: [tx(target), args[0].t === "str" ? args[0].v : tx(args[0])] } };
		case "toString": return tx(target);
		case "length": throw new Unsupported("length() has no transform equivalent");
		default: throw new Unsupported(`Method ${name}() has no transform equivalent`);
	}
}

function compareToCond(c, tx, notes, pos, neg) {
	// c is a comparison: ==, !=, .equals, .equalsIgnoreCase, !equals
	let op = "eq";
	let l;
	let r;
	let ci = false;
	let inner = c;
	if (inner.t === "not") { op = "ne"; inner = inner.e; }
	if (inner.t === "bin" && (inner.op === "==" || inner.op === "!=")) {
		l = inner.l; r = inner.r;
		if (inner.op === "!=") op = op === "eq" ? "ne" : "eq";
		if ((l.t !== "str" && l.t !== "num") && (r.t !== "str" && r.t !== "num")) notes.add("== on strings in BeanShell compares references or values depending on type; treated as value equality.");
	} else if (inner.t === "call" && (inner.name === "equals" || inner.name === "equalsIgnoreCase") && inner.target && inner.args.length === 1) {
		l = inner.target; r = inner.args[0];
		ci = inner.name === "equalsIgnoreCase";
	} else {
		throw new Unsupported("Condition is not a simple equality or null check");
	}
	let a = tx(l);
	let b = tx(r);
	if (ci) {
		a = { type: "lower", attributes: { input: a } };
		b = { type: "lower", attributes: { input: b } };
	}
	return { type: "conditional", attributes: { expression: `$a ${op} $b`, positiveCondition: pos, negativeCondition: neg, a, b } };
}

function condToTransform(e, tx, notes) {
	const { c, a, b } = e;
	// compound conditions: nest
	if (c.t === "bin" && c.op === "&&") {
		return condToTransform({ t: "cond", c: c.l, a: { t: "cond", c: c.r, a, b }, b }, tx, notes);
	}
	if (c.t === "bin" && c.op === "||" && !isNullCheck(c)) {
		return condToTransform({ t: "cond", c: c.l, a, b: { t: "cond", c: c.r, a, b } }, tx, notes);
	}
	const nc = isNullCheck(c);
	if (nc) {
		const present = nc.isNull ? b : a; // branch taken when value is present
		const absent = nc.isNull ? a : b;
		if (absent.t === "null") {
			notes.add("Null branch dropped: ISC transforms return null on null input.");
			return tx(present);
		}
		if (same(present, nc.v)) return { type: "firstValid", attributes: { values: [tx(nc.v), tx(absent)], ignoreErrors: true } };
		notes.add("Null check translated to firstValid; assumes the present-branch is non-empty when the input is.");
		return { type: "firstValid", attributes: { values: [tx(present), tx(absent)], ignoreErrors: true } };
	}
	return compareToCond(c, tx, notes, tx(a), tx(b));
}

/**
 * Try to turn a whole rule into one ISC transform.
 * @returns {{ok:true, transform:object, notes:string[]} | {ok:false, reason:string}}
 */
export function translateRule(source, ctx = {}) {
	const notes = new Set();
	try {
		const toks = tokenize(source);
		if (!toks.length) return { ok: false, reason: "Empty rule" };
		const p = new Parser(toks);
		const stmts = p.parseBlockBody();
		if (p.peek()) throw new Unsupported("Unbalanced braces");
		const result = evalBlock(stmts, {}, notes);
		const transform = astToTransform(result, ctx, notes);
		return { ok: true, transform, notes: [...notes] };
	} catch (err) {
		if (err instanceof Unsupported) return { ok: false, reason: err.message };
		return { ok: false, reason: `Parse failure: ${err.message}` };
	}
}
