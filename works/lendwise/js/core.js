/* LendWise core: loan maths, scoring/underwriting rules and demo portfolio (concept build). */
(function () {
	const { iso, addDays, hash, rng, store } = UI;
	const S = store("lw3-");
	const day = 864e5;
	const PRODUCTS = [{ id: "home", name: "Home loan", rate: 8.5, min: 500000, max: 50000000, tmax: 30, fee: 0.5, color: "#2563eb", icon: "🏠", docs: ["ID proof", "Address proof", "Salary slips (3 mo)", "Bank statement (6 mo)", "Property papers"] }, { id: "personal", name: "Personal loan", rate: 11.5, min: 50000, max: 2500000, tmax: 5, fee: 1.5, color: "#7c3aed", icon: "💳", docs: ["ID proof", "Address proof", "Salary slips (3 mo)", "Bank statement (3 mo)"] }, { id: "auto", name: "Vehicle loan", rate: 9.2, min: 100000, max: 2500000, tmax: 7, fee: 1, color: "#0891b2", icon: "🚗", docs: ["ID proof", "Address proof", "Income proof", "Vehicle quotation"] }, { id: "business", name: "Business loan", rate: 13.5, min: 200000, max: 10000000, tmax: 7, fee: 2, color: "#ea580c", icon: "🏪", docs: ["ID proof", "GST registration", "ITR (2 yrs)", "Bank statement (12 mo)"] }, { id: "edu", name: "Education loan", rate: 9.8, min: 100000, max: 5000000, tmax: 15, fee: 0.5, color: "#16a34a", icon: "🎓", docs: ["ID proof", "Admission letter", "Co-applicant income proof", "Fee structure"] }];
	const emi = (P, rate, months) => { const r = rate / 1200; return r ? P * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1) : P / months; };
	function schedule(P, rate, months, extra = 0) { const r = rate / 1200, e = emi(P, rate, months), rows = []; let bal = P, m = 0, ti = 0; while (bal > 0.5 && m < months + 1) { m++; const i = bal * r, p = Math.min(bal, e - i + extra); bal -= p; ti += i; rows.push({ m, p, i, paid: p + i, bal: Math.max(0, bal) }); } return { emi: e, rows, ti, months: m }; }
	const score = (pan, income) => 560 + (hash((pan || "x").toUpperCase()) % 300) + Math.min(60, Math.round(income / 5000));
	function evaluate(app, settings) {
		const prod = PRODUCTS.find((p) => p.id === app.product) || PRODUCTS[0], e = emi(app.amount, app.rate || prod.rate, app.tenure * 12), foir = (e + (app.existingEmi || 0)) / Math.max(1, app.income), sc = app.score || score(app.pan, app.income);
		const rules = [{ k: "Credit score ≥ " + settings.minScore, ok: sc >= settings.minScore, v: sc }, { k: "FOIR ≤ " + Math.round(settings.foir * 100) + "%", ok: foir <= settings.foir, v: Math.round(foir * 100) + "%" }, { k: "Amount within product limits", ok: app.amount >= prod.min && app.amount <= prod.max, v: UI.inr(app.amount) }, { k: "Tenure within limit (" + prod.tmax + " yrs)", ok: app.tenure <= prod.tmax, v: app.tenure + " yrs" }, { k: "Age 21–60 at maturity", ok: (() => { const a = new Date().getFullYear() - new Date(app.dob).getFullYear(); return a >= 21 && a + app.tenure <= 65; })(), v: new Date().getFullYear() - new Date(app.dob).getFullYear() + " yrs" }];
		const fails = rules.filter((r) => !r.ok).length; let rec = fails === 0 ? "approve" : fails === 1 && sc >= settings.minScore - 30 ? "refer" : "decline"; if (sc >= 750 && foir <= settings.foir - 0.1 && fails === 0) rec = "approve";
		const rate = Math.round((prod.rate + (sc >= 800 ? -0.5 : sc >= 750 ? 0 : sc >= 700 ? 0.75 : 1.5)) * 100) / 100;
		return { prod, emi: e, foir, sc, rules, rec, rate };
	}
	function seed() {
		if (S.get("seeded", false)) return;
		const settings = { org: "LendWise Finance", foir: 0.55, minScore: 680, auto: true };
		const R = rng(31), names = ["Aarav Mehta", "Diya Nair", "Kabir Singh", "Meera Iyer", "Rohan Gupta", "Isha Verma", "Vihaan Joshi", "Anaya Das", "Arjun Khanna", "Sara Qureshi", "Neel Bansal", "Tara Menon", "Yash Agarwal", "Kiara Bose", "Dhruv Rao", "Ira Kulkarni", "Ishaan Malik", "Mira Sethi", "Reyansh Jain", "Zoya Ahmed", "Aditya Pillai", "Navya Reddy", "Samar Chopra", "Pari Thakur", "Veer Saxena", "Anvi Desai", "Kavya Shah", "Rudra Bhatt", "Myra Sinha", "Atharv Dutta", "Riya Kapoor", "Kunal Arora", "Esha Bhatia", "Varun Tandon", "Nisha Rao", "Manav Sethi", "Tanvi Joshi", "Faisal Khan", "Simran Kohli", "Harsh Vora"];
		const apps = [], loans = [];
		names.forEach((nm, i) => { const prod = PRODUCTS[Math.floor(R() * R() * PRODUCTS.length)], amount = Math.round((prod.min + R() * (prod.max * 0.35 - prod.min)) / 5000) * 5000, tenure = Math.max(1, Math.round(prod.tmax * (0.3 + R() * 0.6))), income = Math.round((25000 + R() * 180000) / 1000) * 1000, pan = "ABCDE" + String(1000 + i * 37) + "F", ts = Date.now() - Math.floor(R() * 60) * day - Math.floor(R() * 5e7);
			const a = { id: "LW-" + (5001 + i), ts, name: nm, phone: "98" + (10000000 + hash(nm) % 80000000), email: nm.split(" ")[0].toLowerCase() + "@example.com", pan, dob: (1972 + Math.floor(R() * 28)) + "-0" + (1 + Math.floor(R() * 9)) + "-15", emp: ["Salaried", "Salaried", "Self-employed"][Math.floor(R() * 3)], employer: ["Infosys", "Acme Traders", "Tata Motors", "Self", "Fortis Healthcare", "Reliance Retail"][Math.floor(R() * 6)], income, existingEmi: Math.round(R() * income * 0.2 / 500) * 500, product: prod.id, amount, tenure, purpose: "", docs: prod.docs.slice(0, 2 + Math.floor(R() * (prod.docs.length - 1))), verified: [], status: "submitted", notes: [] };
			a.score = score(a.pan, a.income); const ev = evaluate(a, settings); a.rate = ev.rate; const r = R();
			a.status = i < 5 ? ["submitted", "submitted", "review", "review", "docs"][i] : ev.rec === "decline" ? (r < 0.7 ? "rejected" : "review") : r < 0.15 ? "review" : r < 0.3 ? "approved" : "disbursed"; if (a.status === "disbursed" || a.status === "approved" || a.status === "rejected") a.decision = { by: "Credit team", reason: a.status === "rejected" ? "Score / FOIR outside policy" : "Meets policy", ts: ts + 2 * day };
			apps.push(a);
			if (a.status === "disbursed") { const start = iso(addDays(new Date(ts + 4 * day), 0)), months = a.tenure * 12, paid = Math.min(months, Math.max(0, Math.floor((Date.now() - (ts + 4 * day)) / (30 * day)))), dpd = loans.length % 4 === 2 ? [8, 22, 41, 66, 97, 125][loans.length % 6] : 0; loans.push({ id: "LN-" + (9001 + loans.length), app: a.id, name: nm, phone: a.phone, product: a.product, principal: a.amount, rate: a.rate, tenure: a.tenure, start, emi: emi(a.amount, a.rate, months), paid, dpd, status: dpd > 90 ? "npa" : "active", ptp: "" }); }
		});
		S.set("settings", settings); S.set("products", PRODUCTS); S.set("apps", apps); S.set("loans", loans); S.set("seeded", true);
	}
	seed();
	const api = { S, emi, schedule, score, evaluate, day,
		settings: () => S.get("settings"), products: () => S.get("products", PRODUCTS), prod: (id) => api.products().find((p) => p.id === id) || api.products()[0],
		apps: () => S.get("apps", []), saveApps: (a) => S.set("apps", a), loans: () => S.get("loans", []), saveLoans: (l) => S.set("loans", l),
		outstanding(l) { const s = schedule(l.principal, l.rate, l.tenure * 12); const row = s.rows[Math.min(l.paid, s.rows.length) - 1]; return l.paid <= 0 ? l.principal : row ? row.bal : 0; },
		nextDue(l) { return iso(addDays(l.start, (l.paid + 1) * 30 + 0)); },
		submit(a) { const l = api.apps(), s = api.settings(); a.id = "LW-" + (5001 + l.length); a.ts = Date.now(); a.score = score(a.pan, a.income); const ev = evaluate(a, s); a.rate = ev.rate; a.status = "submitted"; a.docs = a.docs || []; a.verified = []; a.notes = []; a.auto = s.auto && ev.rec === "approve" ? "pre-approved" : ev.rec === "decline" ? "likely-decline" : "refer"; l.push(a); api.saveApps(l); return a; },
		disburse(id) { const l = api.apps(), a = l.find((x) => x.id === id), ln = api.loans(); a.status = "disbursed"; a.decision = { ...(a.decision || {}), by: "Credit team", reason: "Disbursed", ts: Date.now() }; ln.push({ id: "LN-" + (9001 + ln.length), app: a.id, name: a.name, phone: a.phone, product: a.product, principal: a.amount, rate: a.rate, tenure: a.tenure, start: iso(new Date()), emi: emi(a.amount, a.rate, a.tenure * 12), paid: 0, dpd: 0, status: "active", ptp: "" }); api.saveApps(l); api.saveLoans(ln); },
		reset() { S.clear(); location.reload(); } };
	window.LW = api;
})();
