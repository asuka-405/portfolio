// Minimal dependency-free XML parser for SailPoint IdentityIQ exports.
// Handles elements, attributes, text, CDATA, comments, DOCTYPE and entities.
// Kept DOM-free so the same code runs in the browser and in Node tests.

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decode(s) {
	if (s.indexOf("&") < 0) return s;
	return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
		if (e[0] === "#") {
			const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : m;
		}
		return Object.prototype.hasOwnProperty.call(ENTITIES, e) ? ENTITIES[e] : m;
	});
}

export class XmlError extends Error {}

/** Parse XML text into { name, attrs, children, text }. Throws XmlError. */
export function parseXml(src) {
	let i = 0;
	const n = src.length;
	const root = { name: "#document", attrs: {}, children: [], text: "" };
	const stack = [root];
	const line = (pos) => src.slice(0, pos).split("\n").length;

	while (i < n) {
		const lt = src.indexOf("<", i);
		const cur = stack[stack.length - 1];
		if (lt < 0) {
			cur.text += decode(src.slice(i));
			break;
		}
		if (lt > i) cur.text += decode(src.slice(i, lt));
		i = lt;

		if (src.startsWith("<!--", i)) {
			const end = src.indexOf("-->", i + 4);
			if (end < 0) throw new XmlError(`Unterminated comment at line ${line(i)}`);
			i = end + 3;
		} else if (src.startsWith("<![CDATA[", i)) {
			const end = src.indexOf("]]>", i + 9);
			if (end < 0) throw new XmlError(`Unterminated CDATA at line ${line(i)}`);
			cur.text += src.slice(i + 9, end);
			i = end + 3;
		} else if (src.startsWith("<?", i)) {
			const end = src.indexOf("?>", i + 2);
			if (end < 0) throw new XmlError(`Unterminated processing instruction at line ${line(i)}`);
			i = end + 2;
		} else if (src.startsWith("<!", i)) {
			// DOCTYPE, possibly with an internal subset in [...]
			let depth = 0;
			let j = i + 2;
			for (; j < n; j++) {
				const c = src[j];
				if (c === "[") depth++;
				else if (c === "]") depth--;
				else if (c === ">" && depth <= 0) break;
			}
			i = j + 1;
		} else if (src.startsWith("</", i)) {
			const end = src.indexOf(">", i);
			if (end < 0) throw new XmlError(`Unterminated closing tag at line ${line(i)}`);
			const name = src.slice(i + 2, end).trim();
			const open = stack.pop();
			if (!open || open === root || open.name !== name) {
				throw new XmlError(
					`Mismatched </${name}> at line ${line(i)}${open && open !== root ? ` (expected </${open.name}>)` : ""}`
				);
			}
			i = end + 1;
		} else {
			// start tag
			let j = i + 1;
			while (j < n && !/[\s/>]/.test(src[j])) j++;
			const name = src.slice(i + 1, j);
			if (!name) throw new XmlError(`Stray "<" at line ${line(i)}`);
			const attrs = {};
			let selfClose = false;
			for (;;) {
				while (j < n && /\s/.test(src[j])) j++;
				if (j >= n) throw new XmlError(`Unterminated tag <${name}> at line ${line(i)}`);
				if (src[j] === ">") { j++; break; }
				if (src[j] === "/" && src[j + 1] === ">") { selfClose = true; j += 2; break; }
				let k = j;
				while (k < n && !/[\s=/>]/.test(src[k])) k++;
				const an = src.slice(j, k);
				if (!an) throw new XmlError(`Bad attribute in <${name}> at line ${line(j)}`);
				j = k;
				while (j < n && /\s/.test(src[j])) j++;
				let val = "";
				if (src[j] === "=") {
					j++;
					while (j < n && /\s/.test(src[j])) j++;
					const q = src[j];
					if (q !== '"' && q !== "'") throw new XmlError(`Unquoted attribute ${an} in <${name}> at line ${line(j)}`);
					const e = src.indexOf(q, j + 1);
					if (e < 0) throw new XmlError(`Unterminated attribute ${an} in <${name}> at line ${line(j)}`);
					val = decode(src.slice(j + 1, e));
					j = e + 1;
				}
				attrs[an] = val;
			}
			const el = { name, attrs, children: [], text: "" };
			cur.children.push(el);
			if (!selfClose) stack.push(el);
			i = j;
		}
	}
	if (stack.length > 1) throw new XmlError(`Unclosed <${stack[stack.length - 1].name}>`);
	return root;
}

// ---- tree helpers -------------------------------------------------------

export const kids = (el, name) => (el ? el.children.filter((c) => !name || c.name === name) : []);
export const kid = (el, name) => (el ? el.children.find((c) => c.name === name) : undefined);
export const attr = (el, name, dflt = "") => (el && el.attrs[name] !== undefined ? el.attrs[name] : dflt);
export const text = (el) => (el ? el.text.trim() : "");

export function* walk(el) {
	yield el;
	for (const c of el.children) yield* walk(c);
}

/** Reference name from <Foo><Reference class="..." name="X"/></Foo> or <Foo name="X"/>. */
export function refName(el) {
	if (!el) return "";
	const r = kid(el, "Reference");
	if (r) return attr(r, "name") || attr(r, "id");
	return attr(el, "name") || attr(el, "value") || text(el);
}

/**
 * Turn an IIQ <Attributes><Map><entry key=".." value=".."/> or <entry key><value>..</value></entry>
 * structure into a plain JS object. Nested <Map>, <List> and <Script>/<String> are handled.
 */
export function mapToObject(mapEl) {
	const out = {};
	if (!mapEl) return out;
	const map = mapEl.name === "Map" ? mapEl : kid(mapEl, "Map");
	if (!map) return out;
	for (const e of kids(map, "entry")) {
		const key = attr(e, "key");
		if (!key) continue;
		if (e.attrs.value !== undefined) { out[key] = e.attrs.value; continue; }
		if (e.attrs.valueRef !== undefined) { out[key] = e.attrs.valueRef; continue; }
		const v = kid(e, "value");
		const holder = v || e;
		out[key] = valueOf(holder);
	}
	return out;
}

function valueOf(holder) {
	const m = kid(holder, "Map");
	if (m) return mapToObject(m);
	const l = kid(holder, "List");
	if (l) {
		return l.children.map((c) => {
			if (c.name === "Map") return mapToObject(c);
			if (c.name === "String") return text(c);
			if (c.name === "Reference") return attr(c, "name");
			return c.attrs.value !== undefined ? c.attrs.value : text(c);
		});
	}
	const ref = kid(holder, "Reference");
	if (ref) return attr(ref, "name");
	const s = kid(holder, "String");
	if (s) return text(s);
	const sc = kid(holder, "Script");
	if (sc) return text(kid(sc, "Source")) || text(sc);
	const inner = holder.children.find((c) => c.name === "Boolean" || c.name === "Integer");
	if (inner) return text(inner);
	return text(holder);
}
