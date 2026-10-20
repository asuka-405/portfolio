/* PayDesk data layer: employees, attendance, leave and payroll maths (concept build). */
const PD = (function () {
	const { iso, addDays, rng, store: mk, person, pick, hash } = UI, S = mk("pd-");
	const ymOf = (d) => iso(d).slice(0, 7), dim = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate(), shift = (ym, n) => ymOf(new Date(+ym.slice(0, 4), +ym.slice(5) - 1 + n, 1));
	const HOL = { "01-26": "Republic Day", "03-14": "Holi", "08-15": "Independence Day", "10-02": "Gandhi Jayanti", "10-21": "Dussehra", "11-09": "Diwali", "12-25": "Christmas" };
	const holiday = (date) => HOL[date.slice(5)] || null;
	const LT = { CL: ["Casual leave", 12], SL: ["Sick leave", 8], EL: ["Earned leave", 15] };

	function seed() {
		if (S.get("seeded", false)) return;
		const R = rng(51), D = [["Operations", ["Plant supervisor", "Machine operator", "Packer", "Quality checker", "Store keeper"]], ["Sales", ["Sales executive", "Sales manager", "Dispatch coordinator"]], ["Accounts", ["Accountant", "Accounts assistant"]], ["Admin", ["Office manager", "Receptionist", "Driver", "Peon"]]];
		const emps = []; let n = 1;
		const mk2 = (name, dept, role, basic, o = {}) => emps.push({ id: "e" + n, code: "VP" + String(100 + n++), name, dept, role, join: o.join || iso(addDays(new Date(), -Math.floor(120 + R() * 1800))), basic, hra: Math.round(basic * 0.4 / 100) * 100, allow: Math.round(basic * (0.1 + R() * 0.15) / 100) * 100, pf: basic >= 8000, esi: false, uan: "10" + String(1e9 + Math.floor(R() * 8e9)).slice(0, 10), bank: "HDFC XXXX" + String(1000 + Math.floor(R() * 8999)), phone: UI.phone(R), status: "active", ...o });
		[["Ramesh Chauhan", "Operations", "Plant supervisor", 24000], ["Sanjay Yadav", "Operations", "Machine operator", 14000], ["Dinesh Kumar", "Operations", "Machine operator", 13500], ["Mukesh Singh", "Operations", "Machine operator", 13000], ["Lakhan Pal", "Operations", "Packer", 10500], ["Sunil Rawat", "Operations", "Packer", 10000], ["Raju Thakur", "Operations", "Packer", 9800], ["Babita Devi", "Operations", "Quality checker", 15000], ["Omkar Nath", "Operations", "Store keeper", 14500], ["Ankit Sharma", "Sales", "Sales executive", 18000], ["Priyanka Das", "Sales", "Sales executive", 17500], ["Rohit Malik", "Sales", "Sales manager", 38000], ["Gaurav Tomar", "Sales", "Dispatch coordinator", 16000], ["Meenal Joshi", "Accounts", "Accountant", 28000], ["Suresh Nigam", "Accounts", "Accounts assistant", 15500], ["Kamla Verma", "Admin", "Office manager", 32000], ["Nisha Kohli", "Admin", "Receptionist", 14000], ["Harpal Singh", "Admin", "Driver", 15000], ["Bablu Ram", "Admin", "Peon", 9500], ["Pankaj Goel", "Sales", "Sales executive", 17000, { join: iso(addDays(new Date(), -12)) }]].forEach((e) => mk2(e[0], e[1], e[2], e[3], e[4]));
		emps.forEach((e) => { e.esi = e.basic + e.hra + e.allow <= 21000; });
		const ym = ymOf(new Date()), att = {}, today = iso(new Date());
		[shift(ym, -2), shift(ym, -1), ym].forEach((m) => { att[m] = {}; emps.forEach((e) => { const row = []; for (let d = 1; d <= dim(m); d++) { const date = m + "-" + String(d).padStart(2, "0"), dt = new Date(date + "T00:00:00"); if (date > today) { row.push(""); continue; } if (date < e.join) { row.push("NA"); continue; } if (dt.getDay() === 0) row.push("WO"); else if (holiday(date)) row.push("H"); else { const r = R(); row.push(r < 0.035 ? "A" : r < 0.06 ? "HD" : r < 0.085 ? "L" : "P"); } } att[m][e.id] = row; }); });
		const pays = {}; [shift(ym, -2), shift(ym, -1)].forEach((m) => (pays[m] = { status: "paid", paidOn: m && iso(new Date(+shift(m, 1).slice(0, 4), +shift(m, 1).slice(5) - 1, 1)), adj: {} }));
		pays[ym] = { status: "draft", adj: {} }; pays[shift(ym, -1)].adj = { e12: { bonus: 2000 }, e2: { ot: 1800 } }; pays[ym].adj = { e2: { ot: 2400 }, e5: { ded: 500, note: "Uniform" } };
		const leaves = []; for (let i = 0; i < 9; i++) { const e = pick(emps, R), from = iso(addDays(new Date(), i < 3 ? 2 + i * 3 : -Math.floor(R() * 60))), days = 1 + Math.floor(R() * 2); leaves.push({ id: "l" + i, emp: e.id, type: pick(["CL", "SL", "EL"], R), from, to: iso(addDays(from, days - 1)), days, reason: pick(["Family function", "Fever", "Travel", "Personal work", "Medical check-up"], R), status: i < 3 ? "pending" : "approved", ts: Date.now() - i * 864e5 }); }
		const adv = [{ id: "ad1", emp: "e2", amt: 12000, emi: 2000, left: 8000, date: iso(addDays(new Date(), -60)), note: "Medical advance" }, { id: "ad2", emp: "e9", amt: 6000, emi: 1500, left: 3000, date: iso(addDays(new Date(), -90)), note: "Festival advance" }];
		S.set("emps", emps); S.set("att", att); S.set("pays", pays); S.set("leaves", leaves); S.set("adv", adv); S.set("settings", { co: "Verma Packaging Pvt Ltd", addr: "Plot 22, Sector 63, Noida", pan: "AABCV1234F", pfCode: "DLCPM1234567000", esiCode: "11000123450000999", pt: 200, ptFrom: 15000, payDay: 1 }); S.set("seeded", true);
	}
	seed();
	const emps = () => S.get("emps", []), att = (ym) => S.get("att", {})[ym] || {}, st = () => S.get("settings", {});
	function calc(e, ym) {
		const row = (att(ym)[e.id] || []), days = dim(ym), cnt = (c) => row.filter((x) => x === c).length, adj = ((S.get("pays", {})[ym] || {}).adj || {})[e.id] || {}, na = cnt("NA");
		const payable = Math.max(0, cnt("P") + cnt("HD") * 0.5 + cnt("L") + cnt("WO") + cnt("H")), lop = Math.max(0, days - na - payable), f = days - na ? payable / (days - na) : 0;
		const pr = (x) => Math.round(x * f), basic = pr(e.basic), hra = pr(e.hra), allow = pr(e.allow), ot = adj.ot || 0, bonus = adj.bonus || 0, gross = basic + hra + allow + ot + bonus;
		const pf = e.pf ? Math.round(Math.min(basic, 15000) * 0.12) : 0, esi = e.esi ? Math.ceil(gross * 0.0075) : 0, pt = gross > st().ptFrom ? st().pt : 0;
		const adv = (S.get("adv", []).find((a) => a.emp === e.id && a.left > 0) || { emi: 0 }).emi, ded = adj.ded || 0, totalDed = pf + esi + pt + adv + ded;
		return { days, na, payable, lop, present: cnt("P"), absent: cnt("A"), half: cnt("HD"), leave: cnt("L"), basic, hra, allow, ot, bonus, gross, pf, esi, pt, adv, ded, totalDed, net: gross - totalDed, erPf: e.pf ? Math.round(Math.min(basic, 15000) * 0.13) : 0, erEsi: e.esi ? Math.ceil(gross * 0.0325) : 0, note: adj.note || "" };
	}
	const leaveBal = (id) => { const used = { CL: 0, SL: 0, EL: 0 }; S.get("leaves", []).filter((l) => l.emp === id && l.status === "approved" && l.from.slice(0, 4) === iso(new Date()).slice(0, 4)).forEach((l) => (used[l.type] += l.days)); return Object.fromEntries(Object.entries(LT).map(([k, v]) => [k, v[1] - used[k]])); };
	return { S, ymOf, dim, shift, holiday, HOL, LT, emps, att, calc, leaveBal, settings: st };
})();
