// Cron expression parser, explainer and next-run calculator for Unix (5 field) and Quartz (6 or 7 field) syntax.
// Pure functions, no DOM.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MACROS = {
	"@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *",
	"@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *",
};

export class CronError extends Error {
	constructor(message, field) {
		super(message);
		this.field = field;
	}
}

const ord = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]);

/** Field specs per flavor. dow numbering is normalised internally to 0-6 with 0 = Sunday. */
function specs(flavor) {
	const quartz = flavor === "quartz";
	return {
		second: { min: 0, max: 59 },
		minute: { min: 0, max: 59 },
		hour: { min: 0, max: 23 },
		dom: { min: 1, max: 31, special: quartz ? "?LW" : "" },
		month: { min: 1, max: 12, names: MONTHS, nameBase: 1 },
		dow: quartz ? { min: 1, max: 7, names: DAYS, nameBase: 1, special: "?L#" } : { min: 0, max: 7, names: DAYS, nameBase: 0 },
		year: { min: 1970, max: 2099 },
	};
}

function toNum(tok, spec, field) {
	const up = tok.toUpperCase();
	if (spec.names) {
		const i = spec.names.indexOf(up.slice(0, 3));
		if (i >= 0 && up.length === 3) return i + spec.nameBase;
	}
	if (!/^\d+$/.test(tok)) throw new CronError(`"${tok}" is not a valid ${field} value`, field);
	return Number(tok);
}

/** Parse one field into {any, values:Set, raw, special?}. Values use the flavor's own numbering. */
function parseField(raw, field, spec, flavor) {
	const text = raw.trim();
	if (text === "") throw new CronError(`${field} is empty`, field);
	const out = { raw: text, any: false, noSpecific: false, values: new Set(), specials: [] };
	if (text === "?") {
		if (!spec.special || !spec.special.includes("?")) throw new CronError(`"?" is not allowed in ${field}`, field);
		out.noSpecific = true;
		return out;
	}
	for (const part of text.split(",")) {
		if (part === "") throw new CronError(`${field} has an empty list item`, field);
		const [rangePart, stepPart] = part.split("/");
		let step = 1;
		if (stepPart !== undefined) {
			if (!/^\d+$/.test(stepPart) || Number(stepPart) < 1) throw new CronError(`Step "${stepPart}" in ${field} must be a positive number`, field);
			step = Number(stepPart);
		}
		// Quartz specials
		if (spec.special && /[LW#]/i.test(rangePart) && !/^[A-Z]{3}$/i.test(rangePart)) {
			const t = rangePart.toUpperCase();
			if (field === "dom") {
				let m;
				if (t === "L") { out.specials.push({ kind: "lastDay" }); continue; }
				if (t === "LW") { out.specials.push({ kind: "lastWeekday" }); continue; }
				if ((m = /^L-(\d+)$/.exec(t))) { out.specials.push({ kind: "lastDayOffset", n: Number(m[1]) }); continue; }
				if ((m = /^(\d+)W$/.exec(t))) {
					const d = Number(m[1]);
					if (d < 1 || d > 31) throw new CronError(`${field} nearest-weekday day ${d} is out of range 1-31`, field);
					out.specials.push({ kind: "nearestWeekday", d });
					continue;
				}
			}
			if (field === "dow") {
				let m;
				if ((m = /^(\d|[A-Z]{3})L$/.exec(t))) { out.specials.push({ kind: "lastDow", dow: toNum(m[1], spec, field) }); continue; }
				if ((m = /^(\d|[A-Z]{3})#(\d)$/.exec(t))) {
					const nth = Number(m[2]);
					if (nth < 1 || nth > 5) throw new CronError(`${field} "#${nth}": the occurrence must be 1-5`, field);
					out.specials.push({ kind: "nthDow", dow: toNum(m[1], spec, field), nth });
					continue;
				}
				if (t === "L") { out.specials.push({ kind: "lastDow", dow: spec.min + 6 }); continue; }
			}
			throw new CronError(`"${rangePart}" is not valid in ${field}`, field);
		}
		let lo;
		let hi;
		if (rangePart === "*") {
			lo = spec.min; hi = spec.max;
			if (field === "dow" && flavor === "unix") hi = 6;
			if (stepPart === undefined && parts(text) === 1) out.any = true;
		} else if (rangePart.includes("-")) {
			const [a, b] = rangePart.split("-");
			lo = toNum(a, spec, field); hi = toNum(b, spec, field);
			if (lo > hi && !(field === "dow" && flavor === "unix" && hi === 0)) throw new CronError(`Range ${rangePart} in ${field} runs backwards`, field);
		} else {
			lo = toNum(rangePart, spec, field);
			hi = stepPart !== undefined ? spec.max : lo;
		}
		if (lo < spec.min || hi > spec.max) throw new CronError(`${field} value out of range (${spec.min}-${spec.max}): ${rangePart}`, field);
		for (let v = lo; v <= hi; v += step) out.values.add(v);
	}
	return out;
}
const parts = (t) => t.split(",").length;

/** @param {string} expr  @param {"unix"|"quartz"|"auto"} [flavor] */
export function parseCron(expr, flavor = "auto") {
	let text = String(expr || "").trim().replace(/\s+/g, " ");
	if (!text) throw new CronError("Enter a cron expression");
	let macro = null;
	if (text[0] === "@") {
		if (flavor === "quartz") throw new CronError("Quartz has no @macros");
		if (!MACROS[text.toLowerCase()]) throw new CronError(`Unknown macro ${text}`);
		macro = text;
		text = MACROS[text.toLowerCase()];
		flavor = "unix";
	}
	const tokens = text.split(" ");
	if (flavor === "auto") {
		flavor = tokens.length >= 6 || /[?LW#]/.test(text.replace(/\b[A-Z]{3}\b/g, "")) ? "quartz" : "unix";
		if (flavor === "quartz" && tokens.length === 5) throw new CronError("This has 5 fields but uses Quartz syntax (? L W #). Quartz needs a leading seconds field, for example: 0 " + text);
	}
	const warnings = [];
	let names;
	if (flavor === "unix") {
		if (tokens.length !== 5) throw new CronError(`Unix cron has 5 fields (minute hour day-of-month month day-of-week), found ${tokens.length}`);
		names = ["minute", "hour", "dom", "month", "dow"];
	} else {
		if (tokens.length !== 6 && tokens.length !== 7) throw new CronError(`Quartz cron has 6 or 7 fields (second minute hour day-of-month month day-of-week [year]), found ${tokens.length}`);
		names = ["second", "minute", "hour", "dom", "month", "dow", "year"].slice(0, tokens.length);
	}
	const sp = specs(flavor);
	const fields = {};
	names.forEach((n, i) => { fields[n] = parseField(tokens[i], n, sp[n], flavor); });
	if (flavor === "unix") {
		fields.second = { raw: "0", any: false, noSpecific: false, values: new Set([0]), specials: [] };
		// normalise day-of-week 7 to 0
		if (fields.dow.values.has(7)) { fields.dow.values.delete(7); fields.dow.values.add(0); }
		if (!fields.dom.any && !fields.dow.any) warnings.push("Both day-of-month and day-of-week are restricted. Standard (Vixie) cron runs when EITHER matches; some implementations differ.");
	} else {
		const d = fields.dom, w = fields.dow;
		if (d.noSpecific === w.noSpecific) throw new CronError(d.noSpecific ? 'Quartz needs a value in either day-of-month or day-of-week: both are "?"' : 'Quartz needs "?" in either day-of-month or day-of-week (cannot restrict both)', "dom");
		// normalise Quartz dow 1-7 (1 = Sunday) to 0-6
		const norm = (n) => n - 1;
		fields.dow.values = new Set([...w.values].map(norm));
		fields.dow.specials = w.specials.map((s) => (s.dow !== undefined ? { ...s, dow: norm(s.dow) } : s));
		if (!fields.year) fields.year = { raw: "*", any: true, values: new Set(), specials: [] };
	}
	return { flavor, macro, source: text, fields, warnings, tokens };
}

// ------------------------------------------------------------------ human description

const pad2 = (n) => String(n).padStart(2, "0");
const sortedVals = (f) => [...f.values].sort((a, b) => a - b);

function listText(items) {
	if (items.length <= 1) return items.join("");
	return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

function arithmetic(f, min, max) {
	const v = sortedVals(f);
	if (v.length < 3) return null;
	const step = v[1] - v[0];
	for (let i = 2; i < v.length; i++) if (v[i] - v[i - 1] !== step) return null;
	return { start: v[0], step, end: v[v.length - 1], full: v[0] === min && v[v.length - 1] + step > max };
}

function timeWords(c) {
	const { second: s, minute: m, hour: h } = c.fields;
	const single = (f) => (f.values.size === 1 && !f.any ? [...f.values][0] : null);
	const sv = single(s), mv = single(m), hv = single(h);
	const sAny = s.any, mAny = m.any, hAny = h.any;
	const stepOf = (f, min, max) => (/^(\*|\d+-\d+|\d+)\/\d+$/.test(f.raw) ? arithmetic(f, min, max) : null);

	if (c.flavor === "quartz" ? sAny && mAny && hAny : mAny && hAny) return c.flavor === "quartz" ? "every second" : "every minute";
	if (sv === 0 && hv !== null && mv !== null) return `at ${pad2(hv)}:${pad2(mv)}`;
	if (sv !== null && hv !== null && mv !== null) return `at ${pad2(hv)}:${pad2(mv)}:${pad2(sv)}`;
	const parts = [];
	// seconds
	if (c.flavor === "quartz") {
		const st = stepOf(s, 0, 59);
		if (sAny) parts.push("every second");
		else if (st) parts.push(`every ${st.step} seconds${st.start ? ` starting at second ${st.start}` : ""}`);
		else if (sv !== 0) parts.push(`at second ${listText(sortedVals(s).map(String))}`);
	}
	const mt = stepOf(m, 0, 59);
	if (mAny) { if (!(c.flavor === "quartz" && sAny)) parts.push(c.flavor === "quartz" && !(sv === 0) ? "every minute" : "every minute"); }
	else if (mt) parts.push(`every ${mt.step} minutes${mt.start ? ` starting at minute ${mt.start}` : ""}`);
	else if (mv !== null) parts.push(hAny ? `at minute ${mv} of every hour` : null);
	else parts.push(`at minutes ${listText(sortedVals(m).map(String))}`);
	const ht = stepOf(h, 0, 23);
	if (hAny) { /* already covered */ }
	else if (ht) parts.push(`every ${ht.step} hours${ht.start ? ` from ${pad2(ht.start)}:00` : ""}`);
	else if (hv !== null && mv !== null) { parts.length = c.flavor === "quartz" && !sAny && sv !== 0 ? 1 : 0; parts.push(`at ${pad2(hv)}:${pad2(mv)}`); }
	else if (hv !== null) parts.push(`during the ${pad2(hv)}:00 hour`);
	else {
		const hv2 = sortedVals(h);
		const contiguous = hv2.every((x, i) => i === 0 || x === hv2[i - 1] + 1);
		if (contiguous && hv2.length > 1) parts.push(`between ${pad2(hv2[0])}:00 and ${pad2(hv2[hv2.length - 1])}:59`);
		else parts.push(`at hours ${listText(hv2.map((x) => pad2(x)))}`);
	}
	return parts.filter(Boolean).join(", ");
}

function dayWords(c) {
	const { dom, dow, month } = c.fields;
	const out = [];
	const domAny = dom.any || dom.noSpecific;
	const dowAny = dow.any || dow.noSpecific;
	const dowNames = (f) => listText(sortedVals(f).map((n) => DAY_NAMES[n]));
	const specialText = (s) => {
		switch (s.kind) {
			case "lastDay": return "on the last day of the month";
			case "lastWeekday": return "on the last weekday of the month";
			case "lastDayOffset": return `${s.n} day${s.n === 1 ? "" : "s"} before the last day of the month`;
			case "nearestWeekday": return `on the weekday nearest the ${ord(s.d)}`;
			case "lastDow": return `on the last ${DAY_NAMES[s.dow]} of the month`;
			case "nthDow": return `on the ${ord(s.nth)} ${DAY_NAMES[s.dow]} of the month`;
			default: return "";
		}
	};
	if (!domAny || dom.specials.length) {
		const bits = dom.specials.map(specialText);
		if (dom.values.size) bits.push(`on day ${listText(sortedVals(dom).map(String))} of the month`);
		out.push(listText(bits));
	}
	if (!dowAny || dow.specials.length) {
		const bits = dow.specials.map(specialText);
		if (dow.values.size) bits.push(`on ${dowNames(dow)}`);
		out.push(listText(bits));
	}
	let day = out.length === 2 && c.flavor === "unix" ? `${out[0]} or ${out[1]}` : out.join(", ");
	if (!day) day = "every day";
	const mon = month.any ? "" : ` in ${listText(sortedVals(month).map((n) => MONTH_NAMES[n - 1]))}`;
	return day + mon;
}

export function describe(c) {
	const time = timeWords(c);
	const day = dayWords(c);
	const yearF = c.fields.year;
	const year = yearF && !yearF.any ? ` in ${listText(sortedVals(yearF).map(String))}` : "";
	const everyDay = day === "every day";
	let s = everyDay && !/^at \d\d:\d\d/.test(time) ? `${time}${year}` : `${time}, ${day}${year}`;
	s = s.charAt(0).toUpperCase() + s.slice(1);
	return s;
}

// ------------------------------------------------------------------ time zone helpers

function offsetMinutes(utcMs, tz) {
	const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
	const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
	const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
	return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/** Wall-clock time in tz -> epoch ms, or null when the wall time does not exist (DST gap). */
export function wallToInstant(y, mo, d, h, mi, s, tz) {
	if (tz === "UTC") return Date.UTC(y, mo - 1, d, h, mi, s);
	const guess = Date.UTC(y, mo - 1, d, h, mi, s);
	for (const off of [offsetMinutes(guess, tz), offsetMinutes(guess - 3600000 * 3, tz), offsetMinutes(guess + 3600000 * 3, tz)]) {
		const t = guess - off * 60000;
		if (offsetMinutes(t, tz) === off) return t;
	}
	return null;
}

export function formatInTz(ms, tz) {
	const dtf = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", weekday: "short", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });
	return dtf.format(new Date(ms));
}

// ------------------------------------------------------------------ next runs

function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function dowOf(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

function dayMatches(c, y, m, d) {
	const { dom, dow } = c.fields;
	const last = dim(y, m);
	const dw = dowOf(y, m, d);
	const domMatch = () => {
		if (dom.values.has(d)) return true;
		for (const s of dom.specials) {
			if (s.kind === "lastDay" && d === last) return true;
			if (s.kind === "lastDayOffset" && d === last - s.n) return true;
			if (s.kind === "lastWeekday") {
				let t = last;
				while ([0, 6].includes(dowOf(y, m, t))) t--;
				if (d === t) return true;
			}
			if (s.kind === "nearestWeekday") {
				let t = Math.min(s.d, last);
				const w = dowOf(y, m, t);
				if (w === 6) t = t === 1 ? 3 : t - 1;
				else if (w === 0) t = t === last ? t - 2 : t + 1;
				if (d === t) return true;
			}
		}
		return false;
	};
	const dowMatch = () => {
		if (dow.values.has(dw)) return true;
		for (const s of dow.specials) {
			if (s.kind === "lastDow" && dw === s.dow && d + 7 > last) return true;
			if (s.kind === "nthDow" && dw === s.dow && Math.ceil(d / 7) === s.nth) return true;
		}
		return false;
	};
	const domRestricted = !dom.any && !dom.noSpecific;
	const dowRestricted = !dow.any && !dow.noSpecific;
	if (c.flavor === "unix") {
		if (domRestricted && dowRestricted) return domMatch() || dowMatch();
		if (domRestricted) return domMatch();
		if (dowRestricted) return dowMatch();
		return true;
	}
	if (dom.noSpecific) return dowMatch() || (dow.any && true);
	if (dow.noSpecific) return dom.any ? true : domMatch();
	return true;
}

/**
 * Next fire times after `from`.
 * @returns {{times:number[], skipped:string[]}}  times are epoch ms
 */
export function nextRuns(c, { count = 10, from = Date.now(), tz = "UTC" } = {}) {
	const f = c.fields;
	const secs = c.flavor === "quartz" ? (f.second.any ? Array.from({ length: 60 }, (_, i) => i) : sortedVals(f.second)) : [0];
	const mins = f.minute.any ? Array.from({ length: 60 }, (_, i) => i) : sortedVals(f.minute);
	const hrs = f.hour.any ? Array.from({ length: 24 }, (_, i) => i) : sortedVals(f.hour);
	const years = f.year && !f.year.any ? sortedVals(f.year) : null;
	const monthOk = (m) => f.month.any || f.month.values.has(m);
	const times = [];
	const skipped = [];
	const startParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(from)).map((x) => [x.type, x.value]));
	let y = +startParts.year, m = +startParts.month, d = +startParts.day;
	const lastYear = (years ? years[years.length - 1] : y + 8);
	for (let guard = 0; guard < 366 * 9 && times.length < count; guard++) {
		if (y > lastYear) break;
		if ((!years || years.includes(y)) && monthOk(m) && dayMatches(c, y, m, d)) {
			for (const h of hrs) for (const mi of mins) for (const s of secs) {
				const t = wallToInstant(y, m, d, h, mi, s, tz);
				if (t === null) { if (skipped.length < 3) skipped.push(`${y}-${pad2(m)}-${pad2(d)} ${pad2(h)}:${pad2(mi)}:${pad2(s)} does not exist in ${tz} (clock change)`); continue; }
				if (t > from && times.length < count) times.push(t);
			}
		}
		d++;
		if (d > dim(y, m)) { d = 1; m++; if (m > 12) { m = 1; y++; } }
	}
	times.sort((a, b) => a - b);
	return { times: times.slice(0, count), skipped };
}

// ------------------------------------------------------------------ conversion

const QDOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Convert a Unix cron to Quartz. Returns {expr, warnings}. */
export function unixToQuartz(c) {
	if (c.flavor !== "unix") throw new CronError("Not a Unix expression");
	const warnings = [];
	const [min, hour, dom, month, dow] = c.tokens;
	const mapDow = (t) => t.replace(/\b[0-7]\b/g, (n) => String((Number(n) % 7) + 1));
	let d = dom, w = mapDow(dow);
	if (dom !== "*" && dow !== "*") {
		warnings.push("Unix runs when day-of-month OR day-of-week matches; Quartz cannot do both, so only day-of-month is kept. Split into two triggers if you need both.");
		w = "?";
	} else if (dom === "*" && dow === "*") { w = "?"; }
	else if (dom === "*") d = "?";
	else w = "?";
	return { expr: `0 ${min} ${hour} ${d} ${month} ${w}`, warnings };
}

/** Convert a Quartz cron to Unix when it is representable. Returns {expr|null, warnings}. */
export function quartzToUnix(c) {
	if (c.flavor !== "quartz") throw new CronError("Not a Quartz expression");
	const warnings = [];
	const [sec, min, hour, dom, month, dow, year] = c.tokens;
	if (sec !== "0") warnings.push(`Seconds (${sec}) cannot be expressed in Unix cron.`);
	if (year && year !== "*") warnings.push(`Year (${year}) cannot be expressed in Unix cron.`);
	const special = (t) => /[LW#]/.test(t.replace(/\b[A-Z]{3}\b/gi, ""));
	if (special(dom) || special(dow)) warnings.push("L, W and # are Quartz-only.");
	if (warnings.length) return { expr: null, warnings };
	const mapDow = (t) => t.replace(/\b[1-7]\b/g, (n) => String(Number(n) - 1));
	const d = dom === "?" ? "*" : dom;
	const w = dow === "?" ? "*" : mapDow(dow);
	return { expr: `${min} ${hour} ${d} ${month} ${w}`, warnings };
}

/** One call for the UI. */
export function explain(expr, { flavor = "auto", tz = "UTC", count = 10, from = Date.now() } = {}) {
	try {
		const c = parseCron(expr, flavor);
		const runs = nextRuns(c, { count, from, tz });
		const warnings = [...c.warnings];
		if (runs.skipped.length) warnings.push(...runs.skipped);
		if (!runs.times.length) warnings.push("No run time was found in the search window: the expression may never fire.");
		let converted = null;
		try { converted = c.flavor === "unix" ? { to: "quartz", ...unixToQuartz(c) } : { to: "unix", ...quartzToUnix(c) }; } catch { /* not convertible */ }
		return { ok: true, flavor: c.flavor, macro: c.macro, description: describe(c), runs: runs.times, formatted: runs.times.map((t) => formatInTz(t, tz)), warnings, converted, fields: c.fields };
	} catch (e) {
		if (e instanceof CronError) return { ok: false, error: e.message, field: e.field || null };
		throw e;
	}
}

export const EXAMPLES = [
	{ label: "Every 15 minutes", expr: "*/15 * * * *" },
	{ label: "Weekdays at 09:30", expr: "30 9 * * 1-5" },
	{ label: "Quartz: every day 02:00", expr: "0 0 2 * * ?" },
	{ label: "Quartz: last Friday of the month, 17:00", expr: "0 0 17 ? * 6L" },
	{ label: "Quartz: weekday nearest the 15th", expr: "0 0 8 15W * ?" },
	{ label: "Quartz: 2nd Monday, every 10 minutes 9-17", expr: "0 0/10 9-17 ? * 2#2" },
	{ label: "@daily macro", expr: "@daily" },
];
