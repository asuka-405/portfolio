/* SchoolDesk data layer, shared by the admin console and the parent portal (concept build). */
const SD = (function () {
	const { iso, addDays, hash, rng, store: mk, person, pick } = UI, S = mk("sd-"), day = 864e5;
	const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8], SECS = ["A", "B"], SUBJ = ["English", "Hindi", "Maths", "Science", "Social Studies", "Computer", "Art & PE"];
	const TUITION = { 1: 1600, 2: 1700, 3: 1800, 4: 1900, 5: 2100, 6: 2300, 7: 2500, 8: 2700 }, BUS = { A: 900, B: 1200, C: 1500 }, ANNUAL = 5500;
	const ayStart = () => { const n = new Date(); return new Date(n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1, 3, 1); };
	const months = () => { const s = ayStart(), n = new Date(), out = []; for (let d = new Date(s); d <= n; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push(new Date(d)); return out; };
	const mlabel = (d) => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
	const schoolDays = (n, from = new Date()) => { const out = []; let d = new Date(from); d.setHours(0, 0, 0, 0); while (out.length < n) { if (d.getDay() !== 0 && d.getDay() !== 6) out.push(iso(d)); d = addDays(d, -1); } return out.reverse(); };
	function grade(p) { return p >= 91 ? "A1" : p >= 81 ? "A2" : p >= 71 ? "B1" : p >= 61 ? "B2" : p >= 51 ? "C1" : p >= 41 ? "C2" : p >= 33 ? "D" : "E"; }

	function seed() {
		if (S.get("seeded", false)) return;
		const R = rng(31), T = [["Mrs. Anita Verma", "English"], ["Mr. Rajesh Kulkarni", "Maths"], ["Ms. Shweta Rao", "Science"], ["Mrs. Kiran Bedi", "Hindi"], ["Mr. Sanjay Dutt", "Social Studies"], ["Ms. Priya Nair", "Computer"], ["Mr. Arvind Menon", "Art & PE"], ["Mrs. Sunita Chawla", "English"], ["Mr. Faisal Khan", "Maths"], ["Ms. Deepa Iyer", "Science"], ["Mr. Ramesh Pillai", "Hindi"], ["Mrs. Neha Kapoor", "Social Studies"]];
		const staff = T.map((t, i) => ({ id: "t" + (i + 1), name: t[0], subject: t[1], phone: "98" + String(10000000 + Math.floor(R() * 89999999)), qual: ["B.Ed, M.A.", "B.Ed, M.Sc.", "M.Ed", "B.Ed, B.Sc."][i % 4], since: 2008 + Math.floor(R() * 16) }));
		const students = []; let adm = 1;
		const secs = []; CLASSES.forEach((c) => SECS.forEach((s) => secs.push(c + "-" + s)));
		secs.forEach((sec, si) => {
			const [c, s] = sec.split("-"); staff[si % staff.length].ct = sec;
			for (let k = 1; k <= 18 + Math.floor(R() * 5); k++) { const nm = person(R), fam = nm.split(" ")[1]; students.push({ id: "s" + (students.length + 1), adm: "GPS" + (2018 + (8 - +c)) + "-" + String(adm++).padStart(3, "0"), name: pick(UI.names.first, R) + " " + fam, cls: +c, sec: s, roll: k, father: pick(["Mr. ", "Mr. "], R) + pick(UI.names.first, R).replace(/a$/, "") + " " + fam, phone: UI.phone(R), dob: iso(new Date(2026 - 5 - +c - 1, Math.floor(R() * 12), 1 + Math.floor(R() * 27))), bus: R() < 0.4 ? pick(["A", "B", "C"], R) : "", disc: R() < 0.12 ? 10 : 0, blood: pick(["A+", "B+", "O+", "AB+", "O-", "B-"], R), addr: "Sector " + (15 + Math.floor(R() * 60)) + ", Noida" }); }
		});
		// fee payments
		const ms = months(), pays = []; let rc = 1;
		students.forEach((s) => {
			const lag = R() < 0.7 ? 0 : R() < 0.6 ? 1 : 2 + Math.floor(R() * 3), upto = Math.max(0, ms.length - lag), mode = pick(["UPI", "UPI", "Cash", "Card", "Cheque"], R);
			let owed = 0; ms.slice(0, upto).forEach((m, i) => { owed += monthly(s) + (i === 0 ? ANNUAL : 0); });
			const chunks = Math.max(1, Math.ceil(upto / 3)); for (let q = 0; q < chunks && owed > 0; q++) { const a = q === chunks - 1 ? owed : Math.round(owed / (chunks - q)); owed -= a; pays.push({ id: "r" + rc, sid: s.id, ts: new Date(ms[Math.min(q * 3, ms.length - 1)].getTime() + (2 + Math.floor(R() * 9)) * day).getTime(), amt: a, mode, rcpt: "GPS/" + String(ayStart().getFullYear()).slice(2) + "-" + String(ayStart().getFullYear() + 1).slice(2) + "/" + String(rc).padStart(4, "0"), note: "" }); rc++; }
		});
		pays.sort((a, b) => a.ts - b.ts);
		// attendance for last 30 school days
		const att = {}; schoolDays(30).forEach((d) => secs.forEach((sec) => { const [c, s] = sec.split("-"), ids = students.filter((x) => x.cls === +c && x.sec === s), abs = [], lv = []; ids.forEach((x) => { const r = R(); if (r < 0.055) abs.push(x.id); else if (r < 0.075) lv.push(x.id); }); att[d + "|" + sec] = { abs, lv }; }));
		// exams
		const exams = [{ id: "ut1", name: "Unit Test 1", date: iso(new Date(ayStart().getFullYear(), 6, 15)), max: 25 }, { id: "hy", name: "Half-yearly", date: iso(new Date(ayStart().getFullYear(), 8, 20)), max: 100 }];
		const marks = { ut1: {}, hy: {} }; students.forEach((s) => { const ab = 52 + R() * 36 - (s.cls > 6 ? 4 : 0); SUBJ.forEach((sub, j) => { const base = ab + (hash(s.id + sub) % 15) - 7; ["ut1", "hy"].forEach((e) => { const m = exams.find((x) => x.id === e).max; (marks[e][s.id] = marks[e][s.id] || {})[sub] = Math.max(8, Math.min(m, Math.round(((base + (R() * 10 - 5)) / 100) * m))); }); }); });
		// timetable
		const tt = {}; secs.forEach((sec, si) => { const bag = []; [["English", 5], ["Hindi", 4], ["Maths", 6], ["Science", 5], ["Social Studies", 4], ["Computer", 2], ["Art & PE", 4]].forEach(([sb, n]) => { for (let i = 0; i < n; i++) bag.push(sb); }); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } tt[sec] = [0, 1, 2, 3, 4].map((d) => bag.slice(d * 6, d * 6 + 6)); });
		const now = Date.now(), notices = [{ id: "n1", ts: now - 1 * day, title: "Parent-teacher meeting this Saturday", aud: "all", body: "PTM for all classes is on Saturday, 10 am to 1 pm. Please collect the progress report from the class teacher." }, { id: "n2", ts: now - 3 * day, title: "Diwali break and school timings", aud: "all", body: "School will remain closed from the 31st to 5th November. Classes resume on the 6th with regular timings." }, { id: "n3", ts: now - 6 * day, title: "Class 8 science project submission", aud: "8", body: "Projects on renewable energy are due on Friday. Submit to Ms. Shweta Rao in the science lab." }, { id: "n4", ts: now - 9 * day, title: "Fee reminder for the second term", aud: "all", body: "Fees for the second term are due. You can pay online from the parent portal or at the office counter." }, { id: "n5", ts: now - 14 * day, title: "Inter-house football trials", aud: "6", body: "Trials for Classes 6 to 8 are on Wednesday after lunch. Bring sports shoes." }];
		const enq = [["Aarohi Sharma", "Class 1", "Walk-in", "enquiry"], ["Vihaan Gupta", "Nursery", "Website", "enquiry"], ["Myra Khanna", "Class 3", "Referral", "visit"], ["Reyansh Jain", "Class 5", "Website", "visit"], ["Anika Bansal", "Class 2", "Walk-in", "applied"], ["Kabir Malhotra", "Class 6", "Referral", "applied"], ["Zoya Qureshi", "Class 4", "Website", "admitted"], ["Atharv Yadav", "Class 1", "Walk-in", "admitted"], ["Ira Chopra", "Class 7", "Website", "enquiry"], ["Dev Saxena", "Class 8", "Referral", "rejected"], ["Navya Tiwari", "Class 3", "Website", "visit"], ["Ishaan Mishra", "Class 2", "Walk-in", "applied"]].map((e, i) => ({ id: "q" + (i + 1), child: e[0], cls: e[1], src: e[2], stage: e[3], parent: person(R), phone: UI.phone(R), ts: now - Math.floor(R() * 24) * day, note: "" }));
		S.set("staff", staff); S.set("students", students); S.set("pays", pays); S.set("att", att); S.set("exams", exams); S.set("marks", marks); S.set("tt", tt); S.set("notices", notices); S.set("enq", enq); S.set("settings", { name: "Greenfield Public School", board: "CBSE affiliated", upi: "greenfieldschool@upi", principal: "Dr. Meenakshi Sethi" }); S.set("seeded", true);
	}
	function monthly(s) { return TUITION[s.cls] - Math.round((TUITION[s.cls] * (s.disc || 0)) / 100) + (s.bus ? BUS[s.bus] : 0); }
	seed();
	const students = () => S.get("students", []), pays = () => S.get("pays", []), student = (id) => students().find((s) => s.id === id);
	function fees(sid) {
		const s = student(sid), ms = months(), rows = ms.map((m, i) => ({ label: mlabel(m), amt: monthly(s) + (i === 0 ? ANNUAL : 0), note: i === 0 ? "Includes annual charges" : "" })), demand = rows.reduce((a, r) => a + r.amt, 0), p = pays().filter((x) => x.sid === sid), paid = p.reduce((a, x) => a + x.amt, 0);
		return { rows, demand, paid, due: demand - paid, pays: p, monthly: monthly(s) };
	}
	const attOf = (d, sec) => S.get("att", {})[d + "|" + sec] || null;
	function attPct(sid, n = 30) { const s = student(sid), A = S.get("att", {}), days = schoolDays(n); let t = 0, p = 0; days.forEach((d) => { const r = A[d + "|" + s.cls + "-" + s.sec]; if (r) { t++; if (!r.abs.includes(sid)) p++; } }); return t ? Math.round((p / t) * 100) : 100; }
	function result(sid, ex) { const m = S.get("marks", {})[ex] && S.get("marks", {})[ex][sid]; if (!m) return null; const e = S.get("exams", []).find((x) => x.id === ex), tot = Object.values(m).reduce((a, b) => a + b, 0), pct = (tot / (SUBJ.length * e.max)) * 100; return { m, tot, max: SUBJ.length * e.max, pct, grade: grade(pct), exam: e }; }
	function rank(sid, ex) { const s = student(sid), peers = students().filter((x) => x.cls === s.cls).map((x) => ({ id: x.id, t: (result(x.id, ex) || { tot: 0 }).tot })).sort((a, b) => b.t - a.t), i = peers.findIndex((x) => x.id === sid); return { pos: i + 1, of: peers.length }; }
	return { S, CLASSES, SECS, SUBJ, TUITION, BUS, ANNUAL, students, student, pays, fees, attOf, attPct, result, rank, grade, months, mlabel, schoolDays, monthly, settings: () => S.get("settings", {}), staff: () => S.get("staff", []), exams: () => S.get("exams", []), notices: () => S.get("notices", []) };
})();
