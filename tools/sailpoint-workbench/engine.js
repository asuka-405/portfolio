// SailPoint IdentityIQ XML export -> Identity Security Cloud (ISC) objects.
// Pure functions, no DOM. Input: [{ name, text }] XML files. Output: items + files + manifest.

import { parseXml, XmlError, kids, kid, attr, text, walk, refName, mapToObject } from "./xml.js";
import { classifyRule, scanRule, translateRule } from "./rules.js";
import { DEPLOY_SCRIPT } from "./kit-templates.js";

export const STATUS = {
	converted: "Converted",
	review: "Review",
	manual: "Manual",
	unsupported: "No ISC equivalent",
};

const KNOWN = new Set([
	"Application", "Rule", "Bundle", "ObjectConfig", "TaskDefinition", "TaskSchedule", "Workflow", "Policy", "Form",
	"QuickLink", "Capability", "SPRight", "Configuration", "CertificationDefinition", "EmailTemplate",
	"CorrelationConfig", "IdentityTrigger", "Custom", "DynamicScope", "Scope", "ManagedAttribute", "AuditConfig",
	"Dictionary", "GroupDefinition", "RoleTypeDefinition", "ServiceDefinition",
]);

const SYSTEM_IDENTITY_ATTRS = new Set([
	"uid", "firstname", "lastname", "email", "displayName", "manager", "phone", "cloudLifecycleState", "identificationNumber",
]);

// IIQ connector class / type -> ISC connector script name. `sure:false` means verify with GET /v3/connectors.
const CONNECTORS = [
	[/DelimitedFile/i, { isc: "delimited-file", label: "Delimited File", sure: true }],
	[/JDBC/i, { isc: "jdbc", label: "JDBC", sure: true }],
	[/ADLDAP|ActiveDirectory/i, { isc: "active-directory", label: "Active Directory", sure: true }],
	[/AzureAD|AzureActiveDirectory|Entra/i, { isc: "azure-active-directory", label: "Azure Active Directory", sure: true }],
	[/WebServices/i, { isc: "web-services", label: "Web Services", sure: true }],
	[/OpenLDAP|LDAPConnector|\bLDAP\b/i, { isc: "ldap", label: "Generic LDAP", sure: false }],
	[/Salesforce/i, { isc: "salesforce", label: "Salesforce", sure: false }],
	[/ServiceNow/i, { isc: "servicenow", label: "ServiceNow", sure: false }],
	[/Workday/i, { isc: "workday", label: "Workday", sure: false }],
	[/SAPHR|SAP HR/i, { isc: "sap-hr", label: "SAP HR/HCM", sure: false }],
	[/SAP/i, { isc: "sap", label: "SAP", sure: false }],
	[/Okta/i, { isc: "okta", label: "Okta", sure: false }],
	[/GoogleApps|GSuite/i, { isc: "gsuite", label: "Google Workspace", sure: false }],
	[/Unix|Linux|Solaris/i, { isc: "unix", label: "Unix/Linux", sure: false }],
	[/RACF|TopSecret|ACF2/i, { isc: "mainframe", label: "Mainframe", sure: false }],
	[/Exchange/i, { isc: "exchange", label: "Exchange", sure: false }],
	[/Logical/i, { isc: null, label: "Logical application", sure: false }],
];

// IIQ connector attribute keys that never carry over.
const DROP_ATTRS = new Set([
	"IQServiceHost", "IQServicePort", "IQServiceUser", "IQServicePassword", "useTLSForIQService", "templateApplication",
	"encrypted", "afterProvisioningRule", "beforeProvisioningRule", "buildMapRule", "mergeMapsRule", "preIterateRule",
	"postIterateRule", "customizationRule", "provisionRule", "correlationRule", "managerCorrelationRule",
	"creationRule", "customizationRule", "nativeChangeDetectionAttributeScope", "nativeChangeDetectionAttributes",
	"nativeChangeDetectionOperations", "nativeChangeDetectionEnabled", "acctAggregationEnd", "acctAggregationStart",
	"lastRefresh", "loginAttributes", "ObjectCacheEnabled",
]);
const RENAME_BY_CONNECTOR = {
	jdbc: { SQL: "query", sql: "query", getObjectSQL: "getObjectSQL", mergeRows: "mergeRows", isPermissionEnabled: "isPermissionEnabled" },
};
const SECRET_KEY = /(pass(word)?|secret|token|private.?key|credential|api.?key|bind.?pw|authentication.?token)/i;

const CAPABILITIES = {
	SystemAdministrator: "ORG_ADMIN",
	Helpdesk: "HELPDESK",
	CertificationAdministrator: "CERT_ADMIN",
	ReportAdministrator: "REPORT_ADMIN",
	RoleAdministrator: "ROLE_ADMIN",
	ApplicationAdministrator: "SOURCE_ADMIN",
	IdentityAdministrator: "ORG_ADMIN (no narrower level)",
	PolicyAdministrator: "ROLE_ADMIN / ORG_ADMIN (SOD policies)",
	WorkgroupAdministrator: "Governance group membership",
	FullAccessCertification: "CERT_ADMIN",
	DashboardAdministrator: "DASHBOARD (user level)",
	IdentityRequestAdministrator: "HELPDESK",
};

const CERT_TYPES = {
	Manager: "MANAGER",
	ApplicationOwner: "SOURCE_OWNER",
	DataOwner: "SEARCH (entitlement owner)",
	EntitlementOwner: "SEARCH (entitlement owner)",
	AdvancedCertification: "SEARCH",
	Group: "SEARCH",
	Identity: "SEARCH",
	RoleComposition: "ROLE_COMPOSITION",
	BusinessRoleComposition: "ROLE_COMPOSITION",
	Focused: "SEARCH",
};

// ------------------------------------------------------------------ small utils

const slug = (s) => String(s).trim().replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed";
const bool = (v) => String(v).toLowerCase() === "true";
const descOf = (el) => {
	const d = kid(el, "Description");
	if (d) return text(d);
	const a = mapToObject(kid(el, "Attributes"));
	if (typeof a.description === "string") return a.description;
	if (a.descriptions && typeof a.descriptions === "object") return a.descriptions.en_US || Object.values(a.descriptions)[0] || "";
	return attr(el, "description");
};
const ownerOf = (el) => refName(kid(el, "Owner")) || attr(el, "owner");
const csv = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((s) => String(s).trim()).filter(Boolean);
const ownerRef = (name, opts) => {
	const n = name || opts.defaultOwner;
	return n ? { type: "IDENTITY", name: n } : { type: "IDENTITY", name: "<<OWNER>>" };
};
const camel = (s) =>
	String(s)
		.replace(/[^A-Za-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : ""))
		.replace(/^[A-Z]/, (c) => c.toLowerCase());

// ------------------------------------------------------------------ extraction

function collect(el, out) {
	for (const c of el.children) {
		if (KNOWN.has(c.name)) out.push(c);
		else collect(c, out);
	}
}

export function extract(files) {
	const objects = [];
	const errors = [];
	for (const f of files) {
		try {
			const root = parseXml(f.text);
			const before = objects.length;
			collect(root, objects);
			for (let i = before; i < objects.length; i++) objects[i]._file = f.name;
			if (objects.length === before) errors.push({ file: f.name, message: "No recognisable IdentityIQ objects found." });
		} catch (e) {
			errors.push({ file: f.name, message: e instanceof XmlError ? e.message : `Could not parse: ${e.message}` });
		}
	}
	return { objects, errors };
}

// ------------------------------------------------------------------ convert

export function convert(files, userOpts = {}) {
	const opts = { defaultOwner: "", prefix: "", clusterId: "", tenant: "", ...userOpts };
	const { objects, errors } = extract(files);
	const by = (t) => objects.filter((o) => o.name === t);

	const ctx = {
		opts,
		items: [],
		out: new Map(), // path -> content (string)
		steps: [], // deploy manifest
		secrets: [],
		ruleUse: new Map(), // rule name -> ["App.key"]
		apAliases: new Map(), // IT role name -> [access profile names]
		ruleIndex: new Map(by("Rule").map((r) => [attr(r, "name"), r])),
		appIndex: new Map(by("Application").map((a) => [attr(a, "name"), a])),
		corrIndex: new Map(by("CorrelationConfig").map((c) => [attr(c, "name"), c])),
		bundleIndex: new Map(by("Bundle").map((b) => [attr(b, "name"), b])),
		taskIndex: new Map(by("TaskDefinition").map((t) => [attr(t, "name"), t])),
	};

	const addItem = (it) => {
		ctx.items.push({ notes: [], warnings: [], files: [], ...it });
		return ctx.items[ctx.items.length - 1];
	};
	const put = (path, obj) => {
		ctx.out.set(path, typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) + "\n");
		return path;
	};
	ctx.addItem = addItem;
	ctx.put = put;

	indexRuleUsage(ctx);

	const appResults = new Map();
	for (const app of by("Application")) appResults.set(attr(app, "name"), convertApplication(ctx, app));

	convertIdentityConfig(ctx, by("ObjectConfig"), appResults);

	for (const b of by("Bundle")) prepareBundle(ctx, b);
	for (const b of by("Bundle")) convertBundle(ctx, b);
	for (const p of by("Policy")) convertPolicy(ctx, p);

	convertSchedules(ctx, by("TaskDefinition"), by("TaskSchedule"));
	for (const w of by("Workflow")) convertWorkflow(ctx, w);
	for (const e of by("EmailTemplate")) convertEmailTemplate(ctx, e);
	for (const c of by("CertificationDefinition")) convertCertification(ctx, c);
	for (const c of by("Capability")) convertCapability(ctx, c);
	for (const t of by("IdentityTrigger")) convertTrigger(ctx, t);
	for (const f of by("Form")) convertTopLevelForm(ctx, f);
	for (const q of by("QuickLink")) convertQuickLink(ctx, q);
	for (const c of by("Configuration")) convertConfiguration(ctx, c);
	for (const o of objects.filter((x) => ["Scope", "DynamicScope", "Custom", "SPRight", "ManagedAttribute", "GroupDefinition", "Dictionary", "AuditConfig", "ServiceDefinition", "RoleTypeDefinition"].includes(x.name))) {
		convertMisc(ctx, o);
	}

	// Rules last: every other converter has recorded how rules are used.
	for (const r of by("Rule")) convertRule(ctx, r);

	// Pending placeholders
	const placeholders = [];
	for (const [p, content] of ctx.out) if (p.endsWith(".json") && content.includes("<<")) placeholders.push(p);

	// Deploy order: dependencies first (transforms, sources, then what hangs off a source, then profiles, then access).
	const ORDER = ["transform", "source", "source-schema", "correlation", "provisioning-policy", "identity-attribute", "identity-profile", "access-profile", "role", "sod-policy"];
	ctx.steps.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

	const stats = tally(ctx.items);
	const manifest = {
		generatedBy: "IIQ to ISC migration tool",
		generatedAt: new Date().toISOString(),
		tenant: opts.tenant || null,
		steps: ctx.steps,
		secrets: ctx.secrets,
		placeholders,
	};
	put("manifest.json", manifest);
	ctx.out.set("deploy.mjs", DEPLOY_SCRIPT);
	const report = { stats, items: ctx.items.map(({ detail, ...rest }) => rest), errors, placeholders, secrets: ctx.secrets };
	put("report.json", report);
	ctx.out.set("REPORT.md", renderMarkdown(ctx, stats, errors, placeholders));

	return {
		items: ctx.items,
		files: [...ctx.out].map(([path, content]) => ({ path, content })),
		stats,
		errors,
		placeholders,
		secrets: ctx.secrets,
		steps: ctx.steps,
		objectCount: objects.length,
	};
}

function tally(items) {
	const s = { total: items.length, converted: 0, review: 0, manual: 0, unsupported: 0, byKind: {} };
	for (const it of items) {
		s[it.status]++;
		const k = (s.byKind[it.kind] ||= { total: 0, converted: 0, review: 0, manual: 0, unsupported: 0 });
		k.total++;
		k[it.status]++;
	}
	return s;
}

// ------------------------------------------------------------------ rule usage index

function indexRuleUsage(ctx) {
	const note = (rule, where) => {
		if (!rule) return;
		const l = ctx.ruleUse.get(rule) || [];
		if (!l.includes(where)) l.push(where);
		ctx.ruleUse.set(rule, l);
	};
	for (const app of ctx.appIndex.values()) {
		const an = attr(app, "name");
		const attrs = mapToObject(kid(app, "Attributes"));
		for (const [k, v] of Object.entries(attrs)) if (typeof v === "string" && ctx.ruleIndex.has(v) && /rule/i.test(k)) note(v, `${an}.${k}`);
		for (const el of walk(app)) {
			if (el.name === "RuleRef" || (el.name === "Reference" && /Rule$/.test(attr(el, "class")))) note(refName(el), `${an} (reference)`);
		}
	}
}

// ------------------------------------------------------------------ rules

function ruleSource(rule) {
	const s = kid(rule, "Source");
	return s ? s.text.trim() : "";
}

function ruleTransformFor(ctx, ruleName, sourceName) {
	const rule = ctx.ruleIndex.get(ruleName);
	if (!rule) return { ok: false, reason: `Rule "${ruleName}" not in the export` };
	return translateRule(ruleSource(rule), { sourceName });
}

function convertRule(ctx, rule) {
	const name = attr(rule, "name");
	const type = attr(rule, "type");
	const target = classifyRule(type);
	const source = ruleSource(rule);
	const scan = scanRule(source);
	const used = ctx.ruleUse.get(name) || [];
	const item = {
		kind: "Rule",
		name,
		iiqType: type || "(none)",
		isc: target.isc,
		status: "manual",
		notes: [target.hint],
		warnings: [...scan.warnings],
		blockers: scan.blockers,
		usedBy: used,
		files: [],
	};

	if (used.length === 0) item.notes.push("Not referenced by any exported object; may be unused.");

	if (target.mode === "transform") {
		const tr = translateRule(source, {});
		if (tr.ok) {
			const hasPlaceholder = JSON.stringify(tr.transform).includes("<<SOURCE>>");
			const body = { name: ctx.opts.prefix + name, ...tr.transform };
			item.files.push(ctx.put(`transforms/${slug(name)}.json`, body));
			if (!hasPlaceholder) ctx.steps.push({ kind: "transform", name: body.name, method: "POST", path: "/v3/transforms", body, stage: 1 });
			item.status = tr.notes.length || hasPlaceholder ? "review" : "converted";
			item.notes = [`Translated to an ISC "${tr.transform.type}" transform.`, ...tr.notes];
			if (hasPlaceholder) item.notes.push("Contains <<SOURCE>>: replace with the source name, or rely on the inline copy placed in the identity profile or provisioning policy that references this rule.");
			item.detail = body;
		} else {
			item.notes.unshift(`Automatic translation not possible: ${tr.reason}.`);
			item.status = "manual";
		}
	} else if (target.mode === "unsupported") {
		item.status = "unsupported";
	} else if (target.mode === "connectorRule") {
		item.status = scan.blockers.length ? "manual" : "review";
		item.notes.push("Keep the BeanShell body, then submit as a cloud/connector rule. SailPoint validates rules before they run in a tenant.");
	} else if (target.mode === "declarative") {
		item.status = "review";
		item.notes.push("Handled declaratively where the referencing object was exported; check the converted file for that object.");
	}

	if (item.status !== "converted" && item.status !== "unsupported") {
		const xml = `<?xml version='1.0' encoding='UTF-8'?>\n<!DOCTYPE Rule PUBLIC "sailpoint.dtd" "sailpoint.dtd">\n<!-- Migration notes: ${target.isc}${scan.blockers.length ? "\n     BLOCKERS:\n       - " + scan.blockers.join("\n       - ") : ""} -->\n<Rule language="beanshell" name="${escapeXml(name)}" type="${escapeXml(type)}">\n  <Description>${escapeXml(descOf(rule))}</Description>\n  <Source><![CDATA[\n${source.replace(/]]>/g, "]]]]><![CDATA[>")}\n]]></Source>\n</Rule>\n`;
		item.files.push(ctx.put(`rules/${slug(name)}.xml`, xml));
	}
	ctx.addItem(item);
}

const escapeXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ------------------------------------------------------------------ applications

function connectorFor(app) {
	const cls = attr(app, "connector");
	const type = attr(app, "type");
	const probe = `${cls} ${type}`;
	for (const [re, v] of CONNECTORS) if (re.test(probe)) return { ...v, cls, type };
	return { isc: null, label: type || cls || "Unknown", sure: false, cls, type };
}

function convertApplication(ctx, app) {
	const name = attr(app, "name");
	const conn = connectorFor(app);
	const item = ctx.addItem({
		kind: "Application",
		name,
		iiqType: attr(app, "type") || attr(app, "connector"),
		isc: `Source (${conn.label})`,
		status: "review",
		files: [],
	});
	const attrs = mapToObject(kid(app, "Attributes"));
	const authoritative = bool(attr(app, "authoritative"));
	const features = csv(attr(app, "featuresString"));
	const out = { authoritative, schemaIdentityAttr: "", conn };

	// connector attributes
	const connectorAttributes = {};
	const rename = RENAME_BY_CONNECTOR[conn.isc] || {};
	const dropped = [];
	const ruleKeys = [];
	for (const [k, v] of Object.entries(attrs)) {
		if (DROP_ATTRS.has(k)) {
			if (/rule$/i.test(k) && typeof v === "string") ruleKeys.push(`${k} = ${v}`);
			else dropped.push(k);
			continue;
		}
		if (v === "" || v === null || v === undefined) continue;
		const target = rename[k] || k;
		if (SECRET_KEY.test(k) && typeof v === "string") {
			connectorAttributes[target] = "";
			const env = `SECRET__${slug(name).toUpperCase().replace(/[^A-Z0-9]/g, "_")}__${slug(target).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
			ctx.secrets.push({ source: ctx.opts.prefix + name, attribute: target, env });
			continue;
		}
		connectorAttributes[target] = v;
	}
	if (ctx.secrets.some((s) => s.source === ctx.opts.prefix + name)) {
		item.warnings.push("Secrets were not exported. Provide them through environment variables listed in manifest.json when you deploy, or enter them in the ISC UI.");
	}
	if (dropped.length) item.notes.push(`Dropped IIQ-only connector attributes: ${dropped.join(", ")}.`);
	if (ruleKeys.length) item.notes.push(`Rules attached in IIQ (re-attach after review): ${ruleKeys.join("; ")}.`);
	if (attrs.IQServiceHost || attrs.IQServicePort) item.notes.push("Uses IQService: in ISC, run this source through a Virtual Appliance cluster (set the cluster id).");
	if (!conn.isc) {
		item.status = "manual";
		item.notes.push(`No known ISC connector for "${conn.label}". Pick the closest one (GET /v3/connectors) or use Web Services/SaaS connectivity.`);
	} else if (!conn.sure) {
		item.notes.push(`Connector name "${conn.isc}" is a best guess; confirm with GET /v3/connectors.`);
	}
	if (conn.isc) item.notes.push("Connector attribute names are passed through (known renames applied). Run Test Connection and compare against a fresh source of the same type.");
	if (features.length) item.notes.push(`IIQ features: ${features.join(", ")}. ISC derives features from the connector; check provisioning, enable/disable and unlock behave as before.`);

	const body = {
		name: ctx.opts.prefix + name,
		description: descOf(app),
		owner: ownerRef(ownerOf(app), ctx.opts),
		connector: conn.isc || `<<MAP-ME: ${conn.label}>>`,
		connectorAttributes,
	};
	if (ctx.opts.clusterId) body.cluster = { type: "CLUSTER", id: ctx.opts.clusterId };
	else if (["delimited-file", "jdbc", "active-directory", "ldap", "unix"].includes(conn.isc)) item.warnings.push("This connector usually needs a Virtual Appliance cluster; set the cluster id in the options.");
	if (authoritative) item.notes.push("Authoritative in IIQ: becomes the authoritative source of an identity profile.");

	// manager correlation
	const mgr = findAny(app, "ManagerCorrelationFilter");
	if (mgr) {
		body.managerCorrelationMapping = { accountAttributeName: attr(mgr, "value"), identityAttributeName: attr(mgr, "property") };
	} else if (attrs.managerCorrelationRule) {
		item.warnings.push(`Manager correlation uses rule "${attrs.managerCorrelationRule}": express it as a managerCorrelationMapping or keep as a ManagerCorrelation cloud rule.`);
	}

	ctx.steps.push({ kind: "source", name: body.name, method: "POST", path: "/v3/sources", body, stage: 1 });
	item.files.push(ctx.put(`sources/${slug(name)}/source.json`, body));

	// schemas
	const schemas = kids(kid(app, "Schemas"), "Schema").map((s) => {
		const objectType = attr(s, "objectType") || attr(s, "nativeObjectType") || "account";
		const identityAttribute = attr(s, "identityAttribute");
		if (objectType === "account") out.schemaIdentityAttr = identityAttribute;
		return {
			name: objectType,
			nativeObjectType: attr(s, "nativeObjectType") || objectType,
			identityAttribute,
			displayAttribute: attr(s, "displayAttribute"),
			hierarchyAttribute: attr(s, "hierarchyAttribute") || null,
			includePermissions: false,
			attributes: kids(s, "AttributeDefinition").map((a) => ({
				name: attr(a, "name"),
				type: ({ int: "INT", long: "INT", boolean: "BOOLEAN" }[attr(a, "type").toLowerCase()] || "STRING"),
				description: attr(a, "description") || descOf(a),
				isMulti: bool(attr(a, "multi")),
				isEntitlement: bool(attr(a, "entitlement")) || bool(attr(a, "managed")),
				isGroup: !!attr(a, "schemaObjectType"),
				...(attr(a, "schemaObjectType") ? { schema: { type: "CONNECTOR_SCHEMA", name: attr(a, "schemaObjectType") } } : {}),
			})),
		};
	});
	if (schemas.length) {
		item.files.push(ctx.put(`sources/${slug(name)}/schemas.json`, schemas));
		ctx.steps.push({ kind: "source-schema", name: `${body.name} schemas`, method: "SCHEMAS", path: `{source:${body.name}}`, body: schemas, stage: 1 });
		const entCount = schemas.reduce((n, s) => n + s.attributes.filter((a) => a.isEntitlement).length, 0);
		item.notes.push(`${schemas.length} schema(s), ${entCount} entitlement attribute(s) mapped.`);
	}

	// correlation
	const corr = correlationFor(ctx, app, item);
	if (corr) {
		item.files.push(ctx.put(`sources/${slug(name)}/correlation.json`, corr));
		ctx.steps.push({ kind: "correlation", name: `${body.name} correlation`, method: "PUT", path: `/beta/sources/{source:${body.name}}/correlation-config`, body: corr, stage: 1 });
	}

	// provisioning policies
	const policies = provisioningPolicies(ctx, app, item, name);
	if (policies.length) {
		item.files.push(ctx.put(`sources/${slug(name)}/provisioning-policies.json`, policies));
		for (const p of policies) ctx.steps.push({ kind: "provisioning-policy", name: `${body.name}: ${p.usage}`, method: "POST", path: `/v3/sources/{source:${body.name}}/provisioning-policies`, body: p, stage: 1 });
	} else if (features.includes("PROVISIONING")) {
		item.warnings.push("Source supports provisioning in IIQ but no provisioning forms were exported.");
	}

	out.body = body;
	out.name = name;
	return out;
}

function findAny(root, name) {
	for (const el of walk(root)) if (el.name === name) return el;
	return undefined;
}

function correlationFor(ctx, app, item) {
	let cfg = null;
	const ref = kid(app, "AccountCorrelationConfig");
	const cfgName = ref && refName(ref);
	if (cfgName) cfg = ctx.corrIndex.get(cfgName);
	if (!cfg) cfg = kid(app, "CorrelationConfig");
	if (!cfg) {
		const rn = mapToObject(kid(app, "Attributes")).correlationRule || refName(kid(app, "CorrelationRule"));
		if (rn) item.warnings.push(`Account correlation is rule-based ("${rn}"): express as attribute assignments, or keep as a Correlation cloud rule.`);
		else if (cfgName) item.warnings.push(`Correlation config "${cfgName}" is referenced but not in the export.`);
		return null;
	}
	const assignments = [];
	for (const f of walk(cfg)) {
		if (f.name === "Filter" && f.attrs.property) {
			const op = attr(f, "operation", "EQ");
			if (op !== "EQ") { item.warnings.push(`Correlation filter with operation ${op} on ${f.attrs.property} was skipped; ISC attribute assignments are equality matches.`); continue; }
			const identityAttr = f.attrs.property;
			const accountAttr = f.attrs.value;
			assignments.push({
				property: accountAttr,
				value: identityAttr,
				operation: "EQ",
				complex: false,
				ignoreCase: bool(attr(f, "ignoreCase")),
				matchMode: "ANYWHERE",
				filterString: `${accountAttr} == "${identityAttr}"`,
			});
		}
	}
	for (const d of walk(cfg)) if (d.name === "DirectAssignment" || d.name === "DirectAssignments") { item.warnings.push("Direct (hard-coded) correlation assignments cannot be exported; use account-to-identity attribute matching."); break; }
	if (!assignments.length) return null;
	item.notes.push(`Correlation: ${assignments.length} attribute assignment(s). Assumed IIQ Filter orientation: property = identity attribute, value = account attribute. Verify against the first correlated account.`);
	return { name: `${cfgName || attr(app, "name")} Correlation`, attributeAssignments: assignments };
}

const USAGE = { create: "CREATE", update: "UPDATE", enable: "ENABLE", disable: "DISABLE", delete: "DELETE", unlock: "UNLOCK", changepassword: "CHANGE_PASSWORD", assign: "UPDATE" };
function provisioningPolicies(ctx, app, item, appName) {
	const forms = [];
	for (const f of walk(app)) if ((f.name === "Form" || f.name === "Template") && (f.attrs.type || f.attrs.usage)) forms.push(f);
	const out = [];
	for (const f of forms) {
		const usageRaw = (attr(f, "type") || attr(f, "usage")).toLowerCase().replace(/\s+/g, "");
		const usage = USAGE[usageRaw];
		if (!usage) { item.notes.push(`Form "${attr(f, "name")}" of type ${usageRaw} has no provisioning-policy usage in ISC; skipped.`); continue; }
		if (out.some((p) => p.usage === usage)) { item.notes.push(`Second ${usage} form "${attr(f, "name")}" skipped; ISC allows one policy per usage.`); continue; }
		const fields = [];
		for (const fld of walk(f)) {
			if (fld.name !== "Field" || !fld.attrs.name) continue;
			const field = {
				name: fld.attrs.name,
				attributes: {},
				isRequired: bool(attr(fld, "required")),
				type: ({ int: "int", boolean: "boolean" }[attr(fld, "type").toLowerCase()] || "string"),
				isMultiValued: bool(attr(fld, "multi")),
			};
			const rn = refName(kid(fld, "RuleRef")) || (kid(fld, "Script") ? "" : "");
			const src = text(kid(kid(fld, "Script"), "Source")) || text(kid(fld, "Script"));
			let tr = null;
			if (rn) tr = ruleTransformFor(ctx, rn, undefined);
			else if (src) tr = translateRule(src, {});
			if (tr && tr.ok) {
				field.transform = tr.transform;
				if (tr.notes.length) item.notes.push(`Field ${fld.attrs.name}: ${tr.notes.join(" ")}`);
			} else if (tr) {
				item.warnings.push(`Provisioning field ${fld.attrs.name}${rn ? ` (rule ${rn})` : ""}: ${tr.reason}. Rebuild the value as a transform or a FieldValue rule.`);
				field.transform = { type: "static", attributes: { value: `<<TODO field ${fld.attrs.name}>>` } };
			}
			fields.push(field);
		}
		if (!fields.length) continue;
		out.push({ name: `${appName} ${usage[0] + usage.slice(1).toLowerCase().replace(/_/g, " ")}`, description: "", usage, fields });
	}
	if (out.length) item.notes.push(`${out.length} provisioning polic${out.length === 1 ? "y" : "ies"} created from IIQ forms.`);
	return out;
}

// ------------------------------------------------------------------ identity configuration

function convertIdentityConfig(ctx, configs, appResults) {
	const identityCfg = configs.find((c) => attr(c, "name") === "Identity");
	for (const c of configs) {
		const n = attr(c, "name");
		if (n === "Identity") continue;
		ctx.addItem({
			kind: "Object config",
			name: `ObjectConfig-${n}`,
			iiqType: "ObjectConfig",
			isc: n === "Bundle" ? "Role / access profile attributes" : n === "Link" ? "Source account schema attributes" : n === "ManagedAttribute" ? "Entitlement metadata" : "No direct equivalent",
			status: "manual",
			notes: [`${kids(c, "ObjectAttribute").length} extended attribute(s). ${n === "Bundle" ? "ISC roles carry no custom attributes; use tags or description conventions." : n === "ManagedAttribute" ? "Use ISC entitlement metadata: description, owner, requestable and privileged flags." : "Review whether the data is still needed."}`],
		});
	}
	if (!identityCfg) {
		if (appResults.size) ctx.addItem({ kind: "Identity attributes", name: "ObjectConfig-Identity", iiqType: "ObjectConfig", isc: "Identity attributes and profiles", status: "manual", notes: ["ObjectConfig-Identity was not in the export. Without it, identity profiles cannot be built. Export it with: export ObjectConfig \"Identity\"."] });
		return;
	}
	const rawAttrs = kids(identityCfg, "ObjectAttribute");
	const attrs = rawAttrs.map((a) => {
		const srcs = [];
		for (const s of kids(a, "AttributeSource")) {
			const ruleName = refName(kid(s, "RuleRef")) || (/rule/i.test(attr(s, "type")) ? attr(s, "name") || refName(s) : "");
			const appName = attr(s, "application") || refName(kid(s, "ApplicationRef"));
			if (ruleName || (/rule/i.test(attr(s, "type")) && !appName)) srcs.push({ kind: "rule", rule: ruleName || attr(s, "name") });
			else if (appName) srcs.push({ kind: "app", app: appName, attr: attr(s, "name") || attr(a, "name") });
		}
		const rr = refName(kid(a, "RuleRef"));
		if (rr) srcs.push({ kind: "rule", rule: rr });
		return {
			name: attr(a, "name"),
			displayName: attr(a, "displayName"),
			type: attr(a, "type") || "string",
			multi: bool(attr(a, "multi")),
			searchable: bool(attr(a, "searchable")) || bool(attr(a, "extended")),
			standard: bool(attr(a, "standard")),
			sources: srcs,
		};
	});

	// identity attribute definitions
	const defs = [];
	const attrItem = ctx.addItem({ kind: "Identity attributes", name: "ObjectConfig-Identity", iiqType: "ObjectConfig", isc: "Identity attributes (custom)", status: "review", files: [] });
	const renamed = [];
	for (const a of attrs) {
		const iscName = SYSTEM_IDENTITY_ATTRS.has(a.name) ? a.name : camel(a.name);
		a.iscName = iscName;
		if (SYSTEM_IDENTITY_ATTRS.has(a.name) || a.standard && ["firstname", "lastname", "email", "manager"].includes(a.name)) continue;
		if (iscName !== a.name) renamed.push(`${a.name} -> ${iscName}`);
		if (a.type.toLowerCase() === "date") attrItem.notes.push(`${a.name} is a date: ISC identity attributes are string, int or boolean, so it is created as string.`);
		if (a.type.toLowerCase() === "identity") attrItem.notes.push(`${a.name} references another identity: store the identity name as a string.`);
		const body = {
			name: iscName,
			displayName: a.displayName || a.name,
			type: ({ int: "int", long: "int", boolean: "boolean" }[a.type.toLowerCase()] || "string"),
			multi: a.multi,
			searchable: a.searchable,
			system: false,
			standard: false,
		};
		defs.push(body);
		ctx.steps.push({ kind: "identity-attribute", name: iscName, method: "POST", path: "/beta/identity-attributes", body, stage: 1 });
	}
	if (renamed.length) attrItem.notes.push(`Renamed to valid ISC attribute names: ${renamed.join(", ")}.`);
	attrItem.notes.push(`${defs.length} custom attribute(s) defined; ${attrs.length - defs.length} map onto ISC system attributes.`);
	attrItem.files.push(ctx.put("identity-attributes/identity-attributes.json", defs));

	// identity profiles: one per authoritative application
	const authApps = [...appResults.values()].filter((r) => r.authoritative);
	if (!authApps.length) {
		ctx.addItem({ kind: "Identity profile", name: "(none)", iiqType: "authoritative Applications", isc: "Identity profile", status: "manual", notes: ["No Application is flagged authoritative=\"true\" in the export. ISC needs one authoritative source per identity profile."] });
		return;
	}
	authApps.forEach((authApp, idx) => {
		const transforms = [];
		const item = ctx.addItem({ kind: "Identity profile", name: `${authApp.name} Identities`, iiqType: "ObjectConfig-Identity", isc: "Identity profile", status: "review", files: [] });
		let manualRules = 0;
		for (const a of attrs) {
			if (a.name === "manager") { item.notes.push("manager: handled by the source's managerCorrelationMapping, not an attribute transform."); continue; }
			if (!a.sources.length) continue;
			const nodes = [];
			for (const s of a.sources) {
				if (s.kind === "app") {
					nodes.push({ type: "accountAttribute", attributes: { sourceName: ctx.opts.prefix + s.app, attributeName: s.attr } });
				} else {
					const tr = ruleTransformFor(ctx, s.rule, ctx.opts.prefix + authApp.name);
					if (tr.ok) {
						nodes.push(tr.transform);
						if (tr.notes.length) item.notes.push(`${a.name} (rule ${s.rule}): ${tr.notes.join(" ")}`);
					} else {
						manualRules++;
						nodes.push({ type: "rule", attributes: { name: s.rule } });
						const why = scanRule(ruleSource(ctx.ruleIndex.get(s.rule) || { children: [] })).blockers[0];
						item.warnings.push(`${a.name}: rule "${s.rule}" could not be translated (${why || tr.reason}). Left as a rule reference.`);
					}
				}
			}
			const def = nodes.length === 1 ? nodes[0] : { type: "firstValid", attributes: { values: nodes, ignoreErrors: true } };
			transforms.push({ identityAttributeName: a.iscName, transformDefinition: def });
		}
		if (!transforms.some((t) => t.identityAttributeName === "uid")) {
			const idAttr = authApp.schemaIdentityAttr || "username";
			transforms.unshift({ identityAttributeName: "uid", transformDefinition: { type: "accountAttribute", attributes: { sourceName: ctx.opts.prefix + authApp.name, attributeName: idAttr } } });
			item.notes.push(`uid was not mapped in IIQ; defaulted to ${authApp.name}.${idAttr}. Confirm this is the unique, stable identifier.`);
		}
		const body = {
			name: `${authApp.name} Identities`,
			description: `Migrated from IdentityIQ ObjectConfig-Identity (authoritative: ${authApp.name})`,
			owner: ownerRef("", ctx.opts),
			priority: (idx + 1) * 10,
			authoritativeSource: { type: "SOURCE", name: ctx.opts.prefix + authApp.name },
			identityAttributeConfig: { enabled: true, attributeTransforms: transforms },
		};
		ctx.steps.push({ kind: "identity-profile", name: body.name, method: "POST", path: "/v3/identity-profiles", body, stage: 1 });
		item.files.push(ctx.put(`identity-profiles/${slug(authApp.name)}.json`, body));
		item.notes.push(`${transforms.length} attribute mapping(s). Multiple IIQ sources per attribute became firstValid in IIQ priority order.`);
		if (manualRules) item.status = "manual";
		if (idx === 0 && authApps.length > 1) item.notes.push("IIQ has one global identity configuration; here it is repeated per authoritative source. Trim each profile to the attributes that source should own.");
	});
}

// ------------------------------------------------------------------ roles and access profiles

const FILTER_OPS = { EQ: "EQUALS", NE: "NOT_EQUALS", CONTAINS: "CONTAINS", STARTSWITH: "STARTS_WITH", ENDSWITH: "ENDS_WITH" };

function filterToCriteria(f, warn) {
	const op = attr(f, "operation").toUpperCase();
	const prop = attr(f, "property");
	const key = { type: "IDENTITY", property: `attribute.${prop}` };
	const val = f.attrs.value !== undefined ? f.attrs.value : text(kid(f, "Value")) || text(kid(kid(kid(f, "Value"), "List"), "String"));
	if (op === "AND" || op === "OR") {
		const children = kids(f).filter((c) => c.name === "Filter" || c.name === "CompositeFilter").map((c) => filterToCriteria(c, warn)).filter(Boolean);
		return children.length ? { operation: op, children } : null;
	}
	if (FILTER_OPS[op]) return { operation: FILTER_OPS[op], key, stringValue: val };
	if (op === "LIKE") {
		const mm = attr(f, "matchMode").toUpperCase();
		return { operation: mm === "START" ? "STARTS_WITH" : mm === "END" ? "ENDS_WITH" : "CONTAINS", key, stringValue: val };
	}
	if (op === "IN") {
		const vals = [...walk(f)].filter((x) => x.name === "String").map((x) => text(x));
		return { operation: "OR", children: vals.map((v) => ({ operation: "EQUALS", key, stringValue: v })) };
	}
	warn(`Filter operation ${op} on ${prop} has no ISC membership operator (EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, AND, OR); skipped.`);
	return null;
}

function termToCriteria(t, ctxApp, warn) {
	const nested = kids(t, "MatchTerm");
	if (nested.length) {
		const children = nested.map((n) => termToCriteria(n, ctxApp, warn)).filter(Boolean);
		if (!children.length) return null;
		return children.length === 1 ? children[0] : { operation: bool(attr(t, "and")) ? "AND" : "OR", children };
	}
	const name = attr(t, "name");
	const value = attr(t, "value");
	const app = attr(t, "application");
	const type = attr(t, "type").toLowerCase();
	if (type === "permission") { warn(`Permission term on ${name} cannot be a role membership criterion; skipped.`); return null; }
	if (app || type === "entitlement") {
		return { operation: "EQUALS", key: { type: "ENTITLEMENT", property: `attribute.${name}`, sourceName: app || ctxApp || "<<SOURCE>>" }, stringValue: value };
	}
	return { operation: "EQUALS", key: { type: "IDENTITY", property: `attribute.${camel(name)}` }, stringValue: value };
}

function selectorToMembership(bundle, warn, ctx) {
	const sel = kid(bundle, "Selector");
	if (!sel) return null;
	const idSel = kid(sel, "IdentitySelector") || sel;
	const me = kid(idSel, "MatchExpression");
	const cf = kid(idSel, "CompoundFilter") || kid(idSel, "Filter") || kid(idSel, "CompositeFilter");
	let criteria = null;
	if (me) {
		const terms = kids(me, "MatchTerm").map((t) => termToCriteria(t, "", warn)).filter(Boolean);
		if (terms.length) criteria = terms.length === 1 ? terms[0] : { operation: bool(attr(me, "and")) ? "AND" : "OR", children: terms };
	} else if (cf) {
		const f = cf.name === "CompoundFilter" ? kid(cf, "Filter") || kid(cf, "CompositeFilter") : cf;
		if (f) criteria = filterToCriteria(f, warn);
	} else if (kid(idSel, "RuleRef") || kid(idSel, "Script") || kid(idSel, "PopulationRef")) {
		warn("Selector is rule, script or population based: ISC membership criteria are declarative. Recreate as criteria or populate through a workflow.");
		return null;
	}
	if (!criteria) return null;
	if (depth(criteria) > 3) warn("Membership criteria nest more than 3 levels; ISC limits nesting, so flatten before importing.");
	return { type: "STANDARD", criteria };
}
const depth = (c) => (c && c.children ? 1 + Math.max(...c.children.map(depth)) : 1);

function approvalFrom(b) {
	const attrs = mapToObject(kid(b, "Attributes"));
	const scheme = String(attrs.approvalScheme || attr(b, "approvalScheme") || "").toLowerCase();
	const schemes = [];
	for (const s of scheme.split(",").map((x) => x.trim()).filter(Boolean)) {
		if (s === "manager") schemes.push({ approverType: "MANAGER" });
		else if (s === "owner") schemes.push({ approverType: "OWNER" });
		else if (s === "applicationowner" || s === "securityofficer") schemes.push({ approverType: "SOURCE_OWNER" });
	}
	return { commentsRequired: false, denialCommentsRequired: false, approvalSchemes: schemes };
}

function profilesOf(b) {
	const out = [];
	for (const p of kids(kid(b, "Profiles"), "Profile")) {
		const app = refName(kid(p, "ApplicationRef")) || attr(p, "application");
		const ents = [];
		const perms = [];
		for (const f of walk(kid(p, "Constraints") || p)) {
			if (f.name === "Filter" && f.attrs.property) {
				const op = attr(f, "operation").toUpperCase();
				if (op === "EQ" && f.attrs.value !== undefined) ents.push({ attribute: f.attrs.property, value: f.attrs.value });
				else if (op === "CONTAINS_ALL" || op === "IN" || op === "CONTAINS_ANY") {
					for (const s of walk(f)) if (s.name === "String") ents.push({ attribute: f.attrs.property, value: text(s) });
				}
			}
		}
		for (const pm of walk(kid(p, "Permissions") || { children: [] })) if (pm.name === "Permission") perms.push({ target: attr(pm, "target"), rights: attr(pm, "rights") });
		out.push({ app, ents, perms, hasFilter: !!kid(p, "Constraints") });
	}
	return out;
}

function prepareBundle(ctx, b) {
	const name = attr(b, "name");
	const profiles = profilesOf(b);
	if (!profiles.length) return;
	const names = [];
	const withApp = profiles.filter((p) => p.app);
	const multi = withApp.length > 1;
	for (const p of withApp) names.push(multi ? `${name} - ${p.app}` : name);
	ctx.apAliases.set(name, names);
}

function flattenRequirements(ctx, b, seen = new Set()) {
	const name = attr(b, "name");
	if (seen.has(name)) return [];
	seen.add(name);
	const req = kids(kid(b, "Requirements"), "Reference").map((r) => attr(r, "name"))
		.concat(kids(kid(b, "Requirements"), "RoleRef").map((r) => refName(r)));
	const inh = kids(kid(b, "Inheritance"), "Reference").map((r) => attr(r, "name"));
	let aps = [];
	for (const r of req) {
		if (ctx.apAliases.has(r)) aps = aps.concat(ctx.apAliases.get(r));
		else if (ctx.bundleIndex.has(r)) aps = aps.concat(flattenRequirements(ctx, ctx.bundleIndex.get(r), seen));
	}
	for (const i of inh) if (ctx.bundleIndex.has(i)) aps = aps.concat(flattenRequirements(ctx, ctx.bundleIndex.get(i), seen));
	return [...new Set(aps)];
}

function convertBundle(ctx, b) {
	const name = attr(b, "name");
	const type = attr(b, "type") || "business";
	const profiles = profilesOf(b);
	const owner = ownerRef(ownerOf(b), ctx.opts);
	const disabled = bool(attr(b, "disabled"));
	const warnings = [];
	const warn = (m) => warnings.push(m);
	const files = [];
	let status = "converted";
	const notes = [];

	if (profiles.length) {
		const apNames = ctx.apAliases.get(name) || [];
		let i = 0;
		for (const p of profiles) {
			if (!p.app) { warn("A profile has no application; skipped."); continue; }
			const apName = apNames[i++] || name;
			const body = {
				name: ctx.opts.prefix + apName,
				description: descOf(b),
				enabled: !disabled,
				requestable: true,
				owner,
				source: { type: "SOURCE", name: ctx.opts.prefix + p.app },
				entitlements: p.ents.map((e) => ({ type: "ENTITLEMENT", _lookup: { source: ctx.opts.prefix + p.app, attribute: e.attribute, value: e.value } })),
				accessRequestConfig: approvalFrom(b),
			};
			if (p.perms.length) { warn(`Profile for ${p.app} uses direct permissions (${p.perms.map((x) => x.target).join(", ")}); access profiles hold entitlements only. Model them as entitlements or aggregate permissions as entitlements.`); status = "review"; }
			if (!p.ents.length && !p.perms.length) { warn(`Profile for ${p.app} has no simple entitlement filter; the access profile will be empty until entitlements are added.`); status = "review"; }
			if (!owner.name || owner.name === "<<OWNER>>") warn("No owner found; set the default owner option.");
			files.push(ctx.put(`access-profiles/${slug(apName)}.json`, body));
			ctx.steps.push({ kind: "access-profile", name: body.name, method: "POST", path: "/v3/access-profiles", body, stage: 2 });
		}
		notes.push(`IT role "${name}" (${type}) became ${apNames.length} access profile(s).${apNames.length > 1 ? " One per source, because an ISC access profile belongs to a single source." : ""}`);
		if (kid(b, "Permits")) notes.push("Permitted roles have no ISC equivalent: the permitted IT roles are ordinary requestable access profiles.");
		if (kid(b, "Requirements") || kid(b, "Inheritance")) { notes.push("Role hierarchy (requirements/inheritance) on an IT role is flattened away in ISC."); status = "review"; }
		ctx.addItem({ kind: "Role (IT)", name, iiqType: type, isc: "Access profile", status: warnings.length ? "review" : status, notes, warnings, files });
		return;
	}

	// business-style role
	const aps = flattenRequirements(ctx, b);
	const membership = selectorToMembership(b, warn, ctx);
	const body = {
		name: ctx.opts.prefix + name,
		description: descOf(b),
		enabled: !disabled,
		requestable: true,
		owner,
		accessProfiles: aps.map((n) => ({ type: "ACCESS_PROFILE", name: ctx.opts.prefix + n })),
		membership,
		accessRequestConfig: approvalFrom(b),
	};
	if (!membership) delete body.membership;
	if (!aps.length) { warn("No access profiles resolved from the role's requirements; the role will be empty."); status = "review"; }
	if (kid(b, "Inheritance")) { notes.push("Inherited roles were flattened into this role's access profiles (ISC has no role hierarchy)."); status = "review"; }
	if (kid(b, "Permits")) notes.push("Permitted (optional) IT roles are not attached: they become independently requestable access profiles.");
	if (/organizational/i.test(type)) { notes.push("Organizational roles group other roles; ISC has no equivalent. Converted as a plain role."); status = "review"; }
	if (!owner.name || owner.name === "<<OWNER>>") warn("No owner found; set the default owner option.");
	if (warnings.length && status === "converted") status = "review";
	files.push(ctx.put(`roles/${slug(name)}.json`, body));
	ctx.steps.push({ kind: "role", name: body.name, method: "POST", path: "/v3/roles", body, stage: 2 });
	ctx.addItem({ kind: "Role (business)", name, iiqType: type, isc: "Role", status, notes: notes.length ? notes : [`Role with ${aps.length} access profile(s)${membership ? " and membership criteria" : ""}.`], warnings, files });
}

// ------------------------------------------------------------------ SOD policies

function convertPolicy(ctx, p) {
	const name = attr(p, "name");
	const isSod = /sod/i.test(attr(p, "type")) || !!findAny(p, "SODConstraint");
	if (!isSod) {
		ctx.addItem({ kind: "Policy", name, iiqType: attr(p, "type") || "Policy", isc: "No direct equivalent", status: "manual", notes: ["Non-SOD policies (account, activity, risk, advanced) have no ISC equivalent; consider SOD policies, access request rules or workflows."] });
		return;
	}
	const cons = [];
	for (const el of walk(p)) if (el.name === "SODConstraint" || el.name === "BundleConstraint") cons.push(el);
	const item = ctx.addItem({ kind: "SOD policy", name, iiqType: "Policy (SOD)", isc: "SOD policy", status: "review", files: [] });
	if (!cons.length) { item.status = "manual"; item.notes.push("No SOD constraints found."); return; }
	let n = 0;
	for (const c of cons) {
		const side = (tag) => [...walk(kid(c, tag) || { children: [] })].filter((x) => x.name === "Reference").map((x) => attr(x, "name"));
		const left = side("LeftBundles");
		const right = side("RightBundles");
		if (!left.length || !right.length) { item.warnings.push(`Constraint "${attr(c, "name")}" has no left/right roles; skipped.`); continue; }
		const mk = (names, label) => ({
			name: label,
			criteriaList: names.map((r) => ({ type: "ENTITLEMENT", _expandBundle: ctx.opts.prefix + r })),
		});
		const body = {
			name: `${ctx.opts.prefix}${name}${cons.length > 1 ? ` - ${attr(c, "name") || ++n}` : ""}`,
			description: descOf(c) || descOf(p),
			ownerRef: ownerRef(ownerOf(p), ctx.opts),
			state: bool(attr(p, "disabled")) ? "NOT_ENFORCED" : "ENFORCED",
			type: "CONFLICTING_ACCESS_BASED",
			correctionAdvice: attr(c, "remediationAdvice") || text(kid(c, "RemediationAdvice")),
			compensatingControls: attr(c, "compensatingControl") || text(kid(c, "CompensatingControl")),
			conflictingAccessCriteria: { leftCriteria: mk(left, "Left"), rightCriteria: mk(right, "Right") },
		};
		for (const r of [...left, ...right]) if (!ctx.bundleIndex.has(r)) item.warnings.push(`Role "${r}" is not in the export; its entitlements cannot be resolved.`);
		ctx.steps.push({ kind: "sod-policy", name: body.name, method: "POST", path: "/v3/sod-policies", body, stage: 2 });
		item.files.push(ctx.put(`sod-policies/${slug(body.name)}.json`, body));
	}
	item.notes.push("ISC SOD criteria are entitlement based. Each IIQ role named in a constraint is expanded to the entitlements of its access profiles at deploy time.");
}

// ------------------------------------------------------------------ tasks and schedules

function convertSchedules(ctx, tasks, schedules) {
	const isAgg = (t) => /Aggregat/i.test(attr(t, "executor") || "") || /aggregat/i.test(attr(t, "name")) || mapToObject(kid(t, "Attributes")).applications !== undefined;
	const taskApps = (t) => csv(mapToObject(kid(t, "Attributes")).applications);
	const handled = new Set();
	const cronOf = (s) => {
		const out = [];
		if (s.attrs.cronExpressions) out.push(...csv(s.attrs.cronExpressions));
		if (s.attrs.cronExpression) out.push(s.attrs.cronExpression);
		for (const c of walk(s)) if (c.name === "CronExpressions" || c.name === "CronExpression") out.push(...[...walk(c)].filter((x) => x.name === "String").map((x) => text(x)), ...(text(c) ? [text(c)] : []));
		return [...new Set(out)];
	};
	for (const s of schedules) {
		const tn = attr(s, "taskDefinition") || refName(kid(s, "TaskDefinitionRef")) || attr(s, "name");
		const task = ctx.taskIndex.get(tn) || [...ctx.taskIndex.values()].find((t) => tn && attr(t, "name") === tn);
		const apps = task ? taskApps(task) : csv(mapToObject(kid(s, "Arguments")).applications);
		const crons = cronOf(s);
		const group = task && /group/i.test(attr(task, "name") + attr(task, "executor"));
		const item = ctx.addItem({ kind: "Schedule", name: attr(s, "name"), iiqType: "TaskSchedule", isc: "Source aggregation schedule", status: "review", files: [] });
		if (task) handled.add(attr(task, "name"));
		if (!apps.length || !crons.length) {
			item.status = "manual";
			item.notes.push(!apps.length ? "Could not determine the target applications." : "No cron expression found.");
			continue;
		}
		const out = [];
		for (const a of apps) for (const cron of crons) {
			const body = { type: group ? "GROUP_AGGREGATION" : "ACCOUNT_AGGREGATION", cronExpression: cron };
			out.push({ source: ctx.opts.prefix + a, ...body });
		}
		item.files.push(ctx.put(`schedules/${slug(attr(s, "name"))}.json`, out));
		item.notes.push(`${out.length} source schedule(s) recorded for reference only. The public ISC API has no create-schedule endpoint for sources: set each aggregation schedule in the source's Aggregation tab, or call POST /beta/sources/{id}/load-accounts from your own scheduler (the cron is kept so you can reuse it). Check the time zone too.`);
		item.status = "manual";
	}
	for (const t of tasks) {
		if (handled.has(attr(t, "name"))) {
			ctx.addItem({ kind: "Task", name: attr(t, "name"), iiqType: "TaskDefinition", isc: "Schedule (see above)", status: "review", notes: ["Its cron schedule is recorded under the matching Schedule item; ISC has no public API to create it."] });
			continue;
		}
		const ex = attr(t, "executor");
		let status = "manual";
		let isc = "No direct equivalent";
		let note = "Review whether this task is still needed in ISC.";
		if (isAgg(t)) { isc = "Source aggregation schedule"; note = "No TaskSchedule was exported for this task. Define the aggregation schedule on each source in ISC."; }
		else if (/IdentityRefresh|Refresh/i.test(ex + attr(t, "name"))) { isc = "Identity processing (automatic)"; status = "unsupported"; note = "ISC processes identities after aggregation and on events; per-task identity refresh with custom options does not exist. Run Process Identities from the UI or API when needed."; }
		else if (/Certification|Campaign/i.test(ex + attr(t, "name"))) { isc = "Campaign"; note = "Recreate as a scheduled campaign."; }
		else if (/Report/i.test(ex)) { isc = "Search / scheduled search"; note = "Use saved searches and scheduled search subscriptions."; }
		else if (/Maintenance|Cleanup|Prune|Perform/i.test(ex + attr(t, "name"))) { isc = "None (managed service)"; status = "unsupported"; note = "Housekeeping is handled by the platform."; }
		ctx.addItem({ kind: "Task", name: attr(t, "name"), iiqType: ex.replace(/^.*\./, "") || "TaskDefinition", isc, status, notes: [note] });
	}
}

// ------------------------------------------------------------------ workflows, templates, campaigns, misc

const WF_STEP_HINTS = [
	["Approval", "Approval: Create form instance / Send email, then wait on form submission (workflow form + approval action)"],
	["Script", "Script: no equivalent; use workflow operators (compare, mutate, loop) or an HTTP request step"],
	["Rule", "Rule call: no equivalent; rebuild with operators or a transform"],
	["Call", "Sub-workflow call: call another workflow via a custom trigger"],
	["Email", "Email: Send Email action"],
];

function convertWorkflow(ctx, w) {
	const name = attr(w, "name");
	const type = attr(w, "type");
	const steps = kids(w, "Step");
	const item = ctx.addItem({ kind: "Workflow", name, iiqType: type || "Workflow", isc: "Workflow", status: "manual", files: [] });
	const rows = steps.map((s) => {
		const kindEl = s.children.find((c) => ["Approval", "Script", "Description"].includes(c.name) && c.name !== "Description");
		const kind = kindEl ? kindEl.name : s.attrs.action ? "Call" : s.attrs.icon || "Step";
		const hint = WF_STEP_HINTS.find(([k]) => k === kind);
		return { step: attr(s, "name"), kind, hint: hint ? hint[1] : "Map to the nearest workflow operator or action" };
	});
	const triggerHint =
		/LCM.*Provision|LCMProvisioning|IdentityRequest/i.test(type + name) ? "Access request / identity request event trigger" :
		/Joiner|Create/i.test(type + name) ? "Identity Created event trigger" :
		/Mover|Transfer/i.test(type + name) ? "Identity Attribute Changed event trigger" :
		/Leaver|Terminat/i.test(type + name) ? "Identity Attribute Changed (lifecycle state) event trigger" :
		/Scheduled|Schedule/i.test(type) ? "Scheduled trigger" : "Choose an event, scheduled, or external trigger";
	const body = {
		name: ctx.opts.prefix + name,
		description: `Migrated skeleton of IdentityIQ workflow "${name}" (${type || "unspecified type"}). Original steps: ${rows.map((r) => r.step).join(", ") || "none"}. Suggested trigger: ${triggerHint}.`,
		owner: ownerRef(ownerOf(w), ctx.opts),
		definition: { start: "Success", steps: { Success: { type: "success" } } },
		enabled: false,
	};
	item.files.push(ctx.put(`workflows/${slug(name)}.json`, body));
	ctx.put(`workflows/${slug(name)}.steps.json`, rows);
	item.files.push(`workflows/${slug(name)}.steps.json`);
	item.notes.push(`${steps.length} IIQ step(s). Only a disabled skeleton is produced; the step list with suggested ISC actions is in the .steps.json file. Suggested trigger: ${triggerHint}.`);
	item.notes.push("ISC workflows are not a superset of IIQ workflows: loops, rule calls and arbitrary BeanShell must be redesigned.");
}

function convertEmailTemplate(ctx, e) {
	const name = attr(e, "name");
	const body = { name, subject: attr(e, "subject") || text(kid(e, "Subject")), body: text(kid(e, "Body")), from: attr(e, "from"), replyTo: attr(e, "replyTo") };
	const item = ctx.addItem({ kind: "Email template", name, iiqType: "EmailTemplate", isc: "Notification template", status: "manual", files: [] });
	item.files.push(ctx.put(`notifications/${slug(name)}.json`, body));
	item.notes.push("ISC customises its own template keys (e.g. access request, certification); it does not accept arbitrary new templates. Copy the wording into the matching ISC template, and translate $variable references to the ISC placeholders for that template.");
}

function convertCertification(ctx, c) {
	const name = attr(c, "name");
	const type = attr(c, "type") || mapToObject(kid(c, "Attributes")).type || "";
	const iscType = CERT_TYPES[type] || "SEARCH";
	const body = { name: ctx.opts.prefix + name, description: descOf(c), type: iscType.split(" ")[0], deadline: "<<set deadline>>", emailNotificationEnabled: true, autoRevokeAllowed: false };
	const item = ctx.addItem({ kind: "Certification", name, iiqType: type || "CertificationDefinition", isc: `Campaign (${iscType})`, status: "manual", files: [] });
	item.files.push(ctx.put(`campaigns/${slug(name)}.json`, body));
	item.notes.push("A draft campaign body is provided but not deployed. Campaign scope, reviewers, reminders and remediation differ from IIQ; rebuild in the UI and compare.");
}

function convertCapability(ctx, c) {
	const name = attr(c, "name");
	const map = CAPABILITIES[name];
	ctx.addItem({
		kind: "Capability", name, iiqType: "Capability", isc: map ? `User level ${map}` : "Governance group / user level",
		status: map ? "review" : "manual",
		notes: [map ? `Closest ISC user level: ${map}. Assign through Admin > Identities > user level.` : "No standard ISC user level; use a governance group or a combination of user levels."],
	});
}

function convertTrigger(ctx, t) {
	const type = attr(t, "type");
	const handler = refName(kid(t, "WorkflowRef")) || attr(t, "handler") || refName(kid(t, "RuleRef"));
	ctx.addItem({
		kind: "Lifecycle trigger", name: attr(t, "name") || type, iiqType: `IdentityTrigger (${type || "?"})`,
		isc: "Lifecycle state / event trigger",
		status: "manual",
		notes: [`Handler: ${handler || "none"}. Map to an identity profile lifecycle state with a transition event or a workflow event trigger (Identity Created, Identity Attribute Changed, Identity Deleted).`],
	});
}

function convertTopLevelForm(ctx, f) {
	ctx.addItem({ kind: "Form", name: attr(f, "name"), iiqType: attr(f, "type") || "Form", isc: "ISC form definition", status: "manual", notes: ["IIQ forms (including those wired to workflows or QuickLinks) must be rebuilt as ISC form definitions; field types and conditions differ."] });
}

function convertQuickLink(ctx, q) {
	ctx.addItem({ kind: "QuickLink", name: attr(q, "name"), iiqType: attr(q, "category") || "QuickLink", isc: "Launcher / access request", status: "manual", notes: ["Self-service QuickLinks map to ISC access request and launchers (a launcher triggers a workflow). Work out which flows are still needed."] });
}

function convertConfiguration(ctx, c) {
	const name = attr(c, "name");
	const hint = {
		SystemConfiguration: "Global settings: re-apply by hand through tenant settings.",
		IdentityRequestConfig: "Access request settings: configure in ISC request center settings.",
		LCMConfig: "Lifecycle Manager settings: access request and password settings in ISC.",
		AuthenticationConfig: "Login and MFA: use ISC authentication settings or the tenant's SSO.",
		UIConfig: "UI customisation does not carry over.",
		ProvisioningConfig: "Provisioning settings are per source in ISC.",
	}[name] || "Configuration objects have no direct import path; review and re-apply manually.";
	ctx.addItem({ kind: "Configuration", name, iiqType: "Configuration", isc: "Tenant settings", status: "manual", notes: [hint] });
}

function convertMisc(ctx, o) {
	const name = attr(o, "name") || o.name;
	const hints = {
		Scope: "Scopes become ISC segments (organisational visibility), set by identity criteria.",
		DynamicScope: "Dynamic scopes become segments with identity-attribute criteria.",
		Custom: "Custom objects (lookup tables) become transform lookups (the lookup transform) or workflow data.",
		SPRight: "SPRights map to ISC user levels; see Capabilities.",
		ManagedAttribute: "Entitlement descriptions and owners: set through entitlement metadata after aggregation (bulk update through the API).",
		GroupDefinition: "Populations/groups map to ISC identity searches or segments.",
		Dictionary: "Password dictionaries: managed by ISC password policy.",
		AuditConfig: "Auditing is automatic in ISC (search and events).",
		ServiceDefinition: "Services map to scheduled work managed by ISC.",
		RoleTypeDefinition: "ISC has fixed object types: roles and access profiles.",
	};
	ctx.addItem({ kind: o.name, name, iiqType: o.name, isc: "See note", status: "manual", notes: [hints[o.name] || "Review manually."] });
}

// ------------------------------------------------------------------ markdown report

function renderMarkdown(ctx, stats, errors, placeholders) {
	const L = [];
	L.push("# IIQ to ISC migration report", "");
	L.push(`Generated ${new Date().toISOString()}.`, "");
	L.push("## Summary", "");
	L.push(`${stats.total} objects: ${stats.converted} converted, ${stats.review} need review, ${stats.manual} manual, ${stats.unsupported} with no ISC equivalent.`, "");
	L.push("| Kind | Total | Converted | Review | Manual | No equivalent |", "|---|---:|---:|---:|---:|---:|");
	for (const [k, v] of Object.entries(stats.byKind)) L.push(`| ${k} | ${v.total} | ${v.converted} | ${v.review} | ${v.manual} | ${v.unsupported} |`);
	L.push("");
	if (errors.length) { L.push("## Files that failed to parse", ""); for (const e of errors) L.push(`- ${e.file}: ${e.message}`); L.push(""); }
	if (placeholders.length) { L.push("## Placeholders to fill (<<...>>)", ""); for (const p of placeholders) L.push(`- ${p}`); L.push(""); }
	if (ctx.secrets.length) {
		L.push("## Secrets (not exported)", "", "Set these environment variables before running deploy.mjs, or enter the values in the ISC UI:", "");
		for (const s of ctx.secrets) L.push(`- ${s.env}  ->  ${s.source}.${s.attribute}`);
		L.push("");
	}
	L.push("## Objects", "");
	for (const status of ["manual", "review", "unsupported", "converted"]) {
		const list = ctx.items.filter((i) => i.status === status);
		if (!list.length) continue;
		L.push(`### ${STATUS[status]} (${list.length})`, "");
		for (const i of list) {
			L.push(`- **${i.kind}: ${i.name}** -> ${i.isc}`);
			for (const n of i.notes || []) L.push(`  - ${n}`);
			for (const w of i.warnings || []) L.push(`  - Warning: ${w}`);
			for (const b of i.blockers || []) L.push(`  - Blocker: ${b}`);
		}
		L.push("");
	}
	L.push("## Deploying", "", "1. Create an ISC personal access token (client id and secret).", "2. `export ISC_BASE_URL=https://TENANT.api.identitynow.com ISC_CLIENT_ID=... ISC_CLIENT_SECRET=...`", "3. `node deploy.mjs` runs a dry run. `node deploy.mjs --apply --stage 1` creates transforms, sources, schemas, correlation, provisioning policies, identity attributes and identity profiles.", "4. Aggregate the sources, then `node deploy.mjs --apply --stage 2` to create access profiles, roles and SOD policies, which need aggregated entitlements.", "");
	return L.join("\n");
}
