// SCIM builder UI. Runs fully in the browser; nothing is sent anywhere.
import { h, $, setStatus, storageGet, storageSet } from "../shared/kit.js";
import { field, segmented, chips, codeBlock, findings, countPills, section, bindHelp, debounce, button, emptyState } from "../shared/fx.js";
import { SCHEMA, buildUser, buildGroup, buildPatch, parseFilter, explainFilter, evalFilter, filterQuery, validatePatch, validateResource, buildCurl, FilterError, SAMPLE_RESOURCE, FILTER_EXAMPLES, SAMPLE_PATCH } from "./scim.js";

const MODES = [
	{ value: "user", label: "User" },
	{ value: "group", label: "Group" },
	{ value: "patch", label: "PATCH" },
	{ value: "filter", label: "Filter" },
	{ value: "validate", label: "Validate" },
];
const MODE_KEY = "sk-scim-mode";
let mode = MODES.some((m) => m.value === storageGet(MODE_KEY)) ? storageGet(MODE_KEY) : "user";

// ------------------------------------------------------------------ forms

const USER_FIELDS = [
	["userName", "User name *", "bjensen@example.com"], ["externalId", "External id", "701984"],
	["givenName", "Given name", "Barbara"], ["familyName", "Family name", "Jensen"],
	["displayName", "Display name", "Babs Jensen"], ["title", "Title", "Tour Guide"],
	["emailWork", "Work email", "bjensen@example.com"], ["emailHome", "Home email", ""],
	["phoneWork", "Work phone", "+1 555 555 8377"], ["phoneMobile", "Mobile phone", ""],
	["userType", "User type", "Employee"], ["preferredLanguage", "Preferred language", "en-US"],
	["locale", "Locale", "en-US"], ["timezone", "Timezone", "America/Los_Angeles"],
];
const ENT_FIELDS = [
	["employeeNumber", "Employee number", "701984"], ["department", "Department", "Tour Operations"],
	["costCenter", "Cost center", "4130"], ["organization", "Organization", "Universal Studios"],
	["division", "Division", "Theme Park"], ["managerId", "Manager id", "26118915-6090-4610-87e4-49d8ca9f808d"],
	["managerName", "Manager name", "John Smith"],
];

const refresh = debounce(() => render(), 150);

function makeFields(defs, container) {
	const map = {};
	const grid = h("div", { class: "fx-grid2" });
	for (const [key, label, ph] of defs) {
		const f = field({ label, placeholder: ph, onInput: refresh });
		map[key] = f.input;
		grid.append(f.el);
	}
	container.append(grid);
	return map;
}

const request = {
	box: h("details", { class: "fx-details" }, h("summary", { text: "Request settings" })),
	method: field({ label: "Method", type: "select", options: ["POST", "PUT", "PATCH", "GET", "DELETE"].map((m) => ({ value: m, label: m })), onInput: refresh }),
	base: field({ label: "Base URL", value: "https://example.com/scim/v2", onInput: refresh }),
	id: field({ label: "Resource id (for PUT, PATCH, DELETE)", placeholder: "2819c223-7f76-453a-919d-413861904646", onInput: refresh }),
	token: field({ label: "Token environment variable", value: "SCIM_TOKEN", hint: "The command reads the token from this variable. Do not paste a real token.", onInput: refresh }),
};
request.box.append(h("div", { class: "tool-form fx-details-body" }, request.method.el, request.base.el, request.id.el, request.token.el));

const forms = {};

function userForm() {
	const el = h("div", { class: "tool-form" });
	const user = makeFields(USER_FIELDS, el);
	el.append(h("p", { class: "tool-subhead", text: "Enterprise extension" }));
	const ent = makeFields(ENT_FIELDS, el);
	const active = field({ label: "Active", type: "checkbox", value: true, onInput: refresh });
	el.append(active.el, h("div", { class: "tool-row" }, button("Fill sample", () => {
		for (const [k, , ph] of USER_FIELDS) user[k].value = ph;
		for (const [k, , ph] of ENT_FIELDS) ent[k].value = ph;
		render();
	}), button("Clear", () => {
		for (const i of [...Object.values(user), ...Object.values(ent)]) i.value = "";
		render();
	})));
	return { el, read: () => ({ ...Object.fromEntries(Object.entries({ ...user, ...ent }).map(([k, i]) => [k, i.value])), active: active.input.checked }) };
}

function groupForm() {
	const el = h("div", { class: "tool-form" });
	const name = field({ label: "Display name *", placeholder: "Tour Guides", onInput: refresh });
	const ext = field({ label: "External id", onInput: refresh });
	const members = field({ label: "Members (one per line: id or id,display name)", type: "textarea", rows: 5, mono: true, placeholder: "2819c223-7f76-453a-919d-413861904646,Babs Jensen", onInput: refresh });
	el.append(name.el, ext.el, members.el, h("div", { class: "tool-row" }, button("Fill sample", () => {
		name.input.value = "Tour Guides";
		members.input.value = "2819c223-7f76-453a-919d-413861904646,Babs Jensen\n902c246b-6245-4190-8e05-00816be7344a,Mandy Pepperidge";
		render();
	})));
	return {
		el,
		read: () => ({
			displayName: name.input.value,
			externalId: ext.input.value,
			members: members.input.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [value, ...d] = l.split(","); return d.length ? { value: value.trim(), display: d.join(",").trim() } : { value: value.trim() }; }),
		}),
	};
}

function patchForm() {
	const el = h("div", { class: "tool-form" });
	const list = h("div", { class: "sc-ops" });
	let rows = [{ op: "replace", path: "", value: "" }];
	const draw = () => {
		list.replaceChildren(...rows.map((r, i) => {
			const op = h("select", { class: "tool-input", "aria-label": `Operation ${i + 1}` }, ["add", "replace", "remove"].map((o) => h("option", { value: o, text: o })));
			op.value = r.op;
			op.addEventListener("change", () => { r.op = op.value; refresh(); });
			const path = h("input", { class: "tool-input fx-mono", placeholder: 'path, e.g. emails[type eq "work"].value', "aria-label": `Path ${i + 1}`, value: r.path, spellcheck: "false" });
			path.addEventListener("input", () => { r.path = path.value; refresh(); });
			const val = h("input", { class: "tool-input fx-mono", placeholder: 'value: text, false, {"a":1}', "aria-label": `Value ${i + 1}`, value: r.value, spellcheck: "false" });
			val.addEventListener("input", () => { r.value = val.value; refresh(); });
			const rm = h("button", { class: "btn btn--ghost wb-btn tool-small", type: "button", text: "Remove", "aria-label": `Remove operation ${i + 1}` });
			rm.addEventListener("click", () => { rows.splice(i, 1); if (!rows.length) rows.push({ op: "replace", path: "", value: "" }); draw(); render(); });
			return h("div", { class: "sc-op" }, op, path, val, rm);
		}));
	};
	draw();
	el.append(
		h("p", { class: "tool-hint", text: "A value that is valid JSON is sent as JSON. Leave the path empty to add or replace an object of attributes." }),
		list,
		h("div", { class: "tool-row" },
			button("Add operation", () => { rows.push({ op: "replace", path: "", value: "" }); draw(); }),
			button("Fill sample", () => { rows = SAMPLE_PATCH.map((r) => ({ ...r })); draw(); render(); }),
		),
	);
	return { el, read: () => rows.map((r) => ({ ...r })) };
}

function filterForm() {
	const el = h("div", { class: "tool-form" });
	const f = field({ label: "Filter", type: "textarea", rows: 3, mono: true, value: FILTER_EXAMPLES[2], onInput: refresh });
	const res = field({ label: "Test against this resource (JSON)", type: "textarea", rows: 10, mono: true, value: JSON.stringify(SAMPLE_RESOURCE, null, 2), onInput: refresh });
	el.append(f.el, h("div", { class: "tool-field" }, h("label", { text: "Examples" }), chips(FILTER_EXAMPLES.map((x) => ({ label: x.length > 34 ? `${x.slice(0, 32)}...` : x, title: x, q: x })), (it) => { f.input.value = it.q; render(); })), res.el);
	return { el, read: () => ({ filter: f.input.value, resource: res.input.value }) };
}

function validateForm() {
	const el = h("div", { class: "tool-form" });
	const t = field({ label: "Body to check (User, Group or PATCH JSON)", type: "textarea", rows: 16, mono: true, placeholder: "Paste a SCIM request or response body", onInput: refresh });
	el.append(t.el, h("div", { class: "tool-row" }, button("Load a faulty User", () => {
		t.input.value = JSON.stringify({ schemas: [SCHEMA.user], userName: "", active: "true", emails: [{ value: "not-an-email", primary: true }, { value: "b@example.com", primary: true }], [SCHEMA.enterprise]: { department: "IT" } }, null, 2);
		render();
	}), button("Load a faulty PATCH", () => {
		t.input.value = JSON.stringify({ schemas: [], Operations: [{ op: "remove" }, { op: "add" }, { op: "update", path: "x" }] }, null, 2);
		render();
	})));
	return { el, read: () => t.input.value };
}

const BUILDERS = { user: userForm, group: groupForm, patch: patchForm, filter: filterForm, validate: validateForm };

// ------------------------------------------------------------------ output

function curlSection(method, resource, body, extra = {}) {
	const m = request.method.input.value;
	const useMethod = extra.method || m;
	return codeBlock({
		title: "curl",
		text: buildCurl({ method: useMethod, baseUrl: request.base.input.value, resource, id: request.id.input.value.trim() || undefined, body, tokenVar: request.token.input.value.trim() || "SCIM_TOKEN", ...extra }),
		filename: "request.sh",
		wrap: true,
	});
}

function render() {
	const out = $("sc-out");
	const form = forms[mode];
	if (!form) return;
	const parts = [];
	let note = "";
	let status = "";
	if (mode === "user" || mode === "group") {
		const v = form.read();
		const body = mode === "user" ? buildUser(v) : buildGroup(v);
		const issues = (mode === "user" ? validateResource(body) : validateResource(body)).filter((i) => !(i.path === "id"));
		parts.push(
			section("Body", codeBlock({ title: mode === "user" ? "User" : "Group", text: JSON.stringify(body, null, 2), filename: `${mode}.json`, mime: "application/scim+json" })),
			section("Checks", countPills(issues), findings(issues, { empty: "The body passes the checks." })),
			section("Request", curlSection(null, mode === "user" ? "Users" : "Groups", body)),
		);
		status = `${issues.filter((i) => i.level === "error").length} error(s)`;
	} else if (mode === "patch") {
		const rows = form.read();
		const body = buildPatch(rows);
		const issues = validatePatch(body);
		parts.push(
			section("Body", codeBlock({ title: "PatchOp", text: JSON.stringify(body, null, 2), filename: "patch.json", mime: "application/scim+json" })),
			section("Checks", countPills(issues), findings(issues, { empty: "The PATCH body passes the checks." })),
			section("Request", curlSection(null, "Users", body, { method: "PATCH" })),
		);
		status = `${issues.filter((i) => i.level === "error").length} error(s)`;
	} else if (mode === "filter") {
		const { filter, resource } = form.read();
		if (!filter.trim()) {
			parts.push(emptyState("Type a filter, or pick an example."));
		} else {
			try {
				const ast = parseFilter(filter);
				parts.push(section("In words", h("p", { class: "sc-words", text: `Matches resources where ${explainFilter(ast)}.` })));
				parts.push(section("Query string", codeBlock({ title: "Add to the URL", text: filterQuery(filter.trim()), wrap: true })));
				let res = null;
				let err = "";
				try { res = JSON.parse(resource); } catch (e) { err = `The test resource is not valid JSON: ${e.message}`; }
				if (res) {
					const hit = evalFilter(ast, res);
					parts.push(section("Test", h("p", { class: hit ? "fx-ok" : "sc-miss", text: hit ? "This resource matches." : "This resource does not match." }), h("p", { class: "tool-hint", text: "String comparisons ignore case, as for attributes that are not caseExact." })));
				} else if (resource.trim()) parts.push(section("Test", findings([{ level: "error", message: err }])));
				parts.push(section("Request", curlSection(null, "Users", null, { method: "GET", filter: filter.trim(), count: 10 })));
				parts.push(section("Syntax tree", codeBlock({ title: "AST", text: JSON.stringify(ast, null, 2) })));
				status = "Filter parsed";
			} catch (e) {
				if (!(e instanceof FilterError)) throw e;
				const pos = e.pos === undefined ? filter.length : e.pos;
				parts.push(section("Cannot parse the filter", findings([{ level: "error", message: e.message }]), h("pre", { class: "fx-pre", text: `${filter}\n${" ".repeat(Math.min(pos, filter.length))}^` })));
				status = "Filter error";
			}
		}
	} else {
		const text = form.read();
		if (!text.trim()) parts.push(emptyState("Paste a body on the left, or load one of the faulty examples."));
		else {
			let obj;
			try { obj = JSON.parse(text); } catch (e) { obj = null; parts.push(section("Checks", findings([{ level: "error", message: `Not valid JSON: ${e.message}` }]))); }
			if (obj !== null) {
				const isPatch = obj && typeof obj === "object" && (Array.isArray(obj.schemas) && obj.schemas.includes(SCHEMA.patch) || "Operations" in obj || "operations" in obj);
				const issues = isPatch ? validatePatch(obj) : validateResource(obj);
				note = isPatch ? "PATCH body" : "Resource";
				parts.push(section(`Checks (${note})`, countPills(issues), findings(issues, { empty: "No problems found." })));
				status = `${issues.filter((i) => i.level === "error").length} error(s)`;
			}
		}
	}
	out.replaceChildren(...parts);
	$("sc-outnote").textContent = note;
	setStatus(status);
	$("sc-outtitle").textContent = mode === "validate" ? "Checks" : mode === "filter" ? "Filter" : "Request";
}

function setMode(m) {
	mode = m;
	storageSet(MODE_KEY, m);
	const body = $("sc-in");
	body.replaceChildren(h("div", { class: "tool-field" }, h("label", { text: "What to build" }), modeSeg.el));
	if (!forms[m]) forms[m] = BUILDERS[m]();
	body.append(forms[m].el);
	if (["user", "group", "patch"].includes(m)) {
		request.method.input.value = m === "patch" ? "PATCH" : "POST";
		body.append(request.box);
	} else if (m === "filter") {
		body.append(request.box);
	}
	render();
}

const modeSeg = segmented("sc-mode", MODES, mode, setMode);

function init() {
	bindHelp("sc");
	setMode(mode);
	document.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			render();
		}
	});
}

init();
