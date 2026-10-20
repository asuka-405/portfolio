/* FilePilot data layer: clients, compliance filings, document checklists (concept build). */
const FP = (function () {
	const { iso, addDays, rng, store: mk, person, pick, hash, pd } = UI, S = mk("fp-"), day = 864e5;
	const TYPES = {
		gstr1: { name: "GSTR-1", full: "GST outward supplies", docs: ["Sales register", "Credit and debit notes"] },
		gstr3b: { name: "GSTR-3B", full: "GST monthly return and tax payment", docs: ["Purchase register", "ITC reconciliation"] },
		tdspay: { name: "TDS payment", full: "TDS deposited by the 7th", docs: ["Deduction sheet"] },
		pfesi: { name: "PF and ESI", full: "Provident fund and ESI contribution", docs: ["Salary register", "Attendance sheet"] },
		tdsret: { name: "TDS return", full: "Quarterly TDS return (24Q or 26Q)", docs: ["Challan details", "Deductee list"] },
		advtax: { name: "Advance tax", full: "Advance tax instalment", docs: ["Profit estimate"] },
		itr: { name: "ITR", full: "Income tax return", docs: ["Form 26AS and AIS", "Bank statements", "Investment proofs"] },
		roc: { name: "ROC annual filing", full: "AOC-4 and MGT-7 with the registrar", docs: ["Audited financials", "Board resolution"] },
	};
	const STATUS = [["awaiting", "Awaiting documents"], ["working", "In progress"], ["review", "In review"], ["filed", "Filed"]];
	const KIND = ["Proprietorship", "Partnership", "Private limited", "LLP", "Individual"];
	const BIZ = ["Traders", "Enterprises", "Foods", "Textiles", "Auto Parts", "Logistics", "Clinic", "Studio", "Hardware", "Pharma", "Infotech", "Builders", "Agro", "Exports", "Electricals"];
	const SVC = { gstr1: "GST", tdspay: "TDS", pfesi: "Payroll", itr: "Income tax", roc: "ROC", advtax: "Advance tax" };
	const mon = (d) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
	function dues(c, from, to) { // [{type, due, period}] inside [from, to]
		const out = [], f = pd(from), t = pd(to), y0 = f.getFullYear() - 1, y1 = t.getFullYear() + 1, add = (type, d, period) => { const x = iso(d); if (x >= iso(f) && x <= iso(t)) out.push({ type, due: x, period }); };
		for (let y = y0; y <= y1; y++) for (let m = 0; m < 12; m++) {
			if (c.sv.includes("gst")) { add("gstr1", new Date(y, m, 11), mon(new Date(y, m - 1, 1))); add("gstr3b", new Date(y, m, 20), mon(new Date(y, m - 1, 1))); }
			if (c.sv.includes("tds")) add("tdspay", new Date(y, m, 7), mon(new Date(y, m - 1, 1)));
			if (c.sv.includes("payroll")) add("pfesi", new Date(y, m, 15), mon(new Date(y, m - 1, 1)));
		}
		for (let y = y0; y <= y1; y++) {
			if (c.sv.includes("tds")) [[6, 31, "Q1"], [9, 31, "Q2"], [0, 31, "Q3"], [4, 31, "Q4"]].forEach(([m, d, q]) => add("tdsret", new Date(y, m, d), q + " FY " + (m > 3 ? y : y - 1) + "-" + String((m > 3 ? y + 1 : y) % 100).padStart(2, "0")));
			if (c.sv.includes("advtax")) [[5, 15, "1st instalment"], [8, 15, "2nd instalment"], [11, 15, "3rd instalment"], [2, 15, "4th instalment"]].forEach(([m, d, q]) => add("advtax", new Date(y, m, d), q));
			if (c.sv.includes("itr")) add("itr", new Date(y, c.kind === "Individual" ? 6 : 9, 31), "AY " + y + "-" + String((y + 1) % 100).padStart(2, "0"));
			if (c.sv.includes("roc")) add("roc", new Date(y, 10, 29), "FY " + (y - 1) + "-" + String(y % 100).padStart(2, "0"));
		}
		return out;
	}
	function mkFiling(c, d, R, team) {
		const today = iso(new Date()), id = c.id + "-" + d.type + "-" + d.due, soon = d.due <= iso(addDays(new Date(), 10)), r = R();
		let st; if (d.due < today) st = r < 0.96 ? "filed" : r < 0.985 ? "review" : "working"; else if (soon) st = r < 0.3 ? "awaiting" : r < 0.62 ? "working" : r < 0.82 ? "review" : "awaiting"; else st = r < 0.6 ? "awaiting" : "working";
		const docs = TYPES[d.type].docs.map((n, i) => ({ n, got: st !== "awaiting" || (R() < 0.4 && i < TYPES[d.type].docs.length - 1) })); if (st === "awaiting" && docs.every((x) => x.got)) docs[docs.length - 1].got = false;
		const f = { id, client: c.id, type: d.type, period: d.period, due: d.due, st, owner: c.owner, docs, note: "", ack: "", filedOn: "", remind: 0 };
		if (st === "filed") { f.filedOn = iso(addDays(d.due, R() < 0.08 ? 1 + Math.floor(R() * 4) : -Math.floor(R() * 6))); f.ack = ["GST", "ITD", "TRN"][hash(id) % 3] + "-" + (100000 + (hash(id) % 899999)); }
		return f;
	}
	function seed() {
		if (S.get("seeded", false)) return;
		const R = rng(212), team = [["CA Meenakshi Rao", "Partner"], ["Rohit Sethi", "Senior article"], ["Sana Qureshi", "GST associate"], ["Deepak Nair", "Audit assistant"]].map((t, i) => ({ id: "m" + i, name: t[0], role: t[1] })), clients = [], filings = [];
		const used = new Set();
		for (let i = 0; i < 28; i++) {
			let nm; do { nm = pick(UI.names.last, R) + " " + pick(BIZ, R); } while (used.has(nm)); used.add(nm);
			const k = i < 8 ? "Private limited" : pick(KIND, R), indiv = k === "Individual", nmx = indiv ? person(R) : nm;
			const sv = indiv ? ["itr", "advtax"] : ["gst", ...(R() < 0.55 ? ["tds"] : []), ...(R() < 0.45 ? ["payroll"] : []), "itr", ...(k === "Private limited" || k === "LLP" ? ["roc"] : []), ...(R() < 0.6 ? ["advtax"] : [])];
			clients.push({ id: "c" + i, name: nmx, kind: k, contact: person(R), phone: UI.phone(R), pan: [0, 0, 0, 0, 0].map(() => String.fromCharCode(65 + Math.floor(R() * 26))).join("") + String(1000 + Math.floor(R() * 8999)) + String.fromCharCode(65 + Math.floor(R() * 26)), gstin: sv.includes("gst") ? "07" + "AAB" + String(Math.floor(R() * 9e3) + 1e3) + "K1Z" + Math.floor(R() * 9) : "", sv, fee: pick([1500, 2000, 2500, 3500, 5000, 7500, 12000], R), owner: pick(team.slice(1), R).id, since: iso(addDays(new Date(), -Math.floor(R() * 900))) });
		}
		const from = iso(addDays(new Date(), -30)), to = iso(addDays(new Date(), 60));
		clients.forEach((c) => dues(c, from, to).forEach((d) => filings.push(mkFiling(c, d, R, team))));
		S.set("team", team); S.set("clients", clients); S.set("filings", filings); S.set("log", []);
		S.set("settings", { name: "Rao and Sethi Associates", addr: "Karol Bagh, New Delhi", frn: "012345N", phone: "9810012345" }); S.set("seeded", true);
	}
	seed();
	const clients = () => S.get("clients", []), client = (id) => clients().find((c) => c.id === id), filings = () => S.get("filings", []), team = () => S.get("team", []), settings = () => S.get("settings", {}), member = (id) => team().find((t) => t.id === id) || { name: "Unassigned" };
	const today = () => iso(new Date()), daysTo = (d) => Math.round((pd(d) - pd(today())) / day), overdue = (f) => f.st !== "filed" && f.due < today(), missing = (f) => f.docs.filter((d) => !d.got);
	function save(list) { S.set("filings", list); }
	function patch(id, p) { const L = filings(), f = L.find((x) => x.id === id); Object.assign(f, p); save(L); return f; }
	function logEv(text, client) { const l = S.get("log", []); l.unshift({ ts: Date.now(), text, client }); S.set("log", l.slice(0, 60)); }
	function addClient(v) {
		const c = { id: "c" + Date.now(), kind: "Proprietorship", contact: v.name, phone: "", pan: "", gstin: "", sv: ["gst", "itr"], fee: 2500, owner: team()[1].id, since: today(), ...v }, L = clients(); L.push(c); S.set("clients", L);
		const F = filings(), R = rng(hash(c.id)); dues(c, iso(addDays(new Date(), -5)), iso(addDays(new Date(), 75))).forEach((d) => { const f = mkFiling(c, d, R, team()); f.st = "awaiting"; f.docs = TYPES[d.type].docs.map((n) => ({ n, got: false })); f.filedOn = ""; f.ack = ""; F.push(f); }); save(F); logEv("Added client " + c.name, c.id); return c;
	}
	function waMsg(c, f) { const m = missing(f).map((d) => "- " + d.n).join("\n"), s = settings(); return `Hi ${c.contact.split(" ")[0]}, this is ${s.name}. For your ${TYPES[f.type].name} (${f.period}) due on ${UI.fdate(f.due)} we still need:\n${m}\nPlease upload them here: ${location.href.replace(/[^/]*$/, "")}portal.html?c=${c.id}`; }
	return { S, TYPES, STATUS, KIND, SVC, clients, client, filings, team, settings, member, today, daysTo, overdue, missing, patch, logEv, addClient, waMsg, dues, save };
})();
