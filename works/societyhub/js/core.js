/* SocietyHub data layer: flats, maintenance bills, visitors, complaints, polls and bookings (concept build). */
const SH = (function () {
	const { iso, addDays, rng, store: mk, person, pick, hash } = UI, S = mk("sh-"), day = 864e5, ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("sh-sync") : null;
	const ym = (d) => iso(d).slice(0, 7), shift = (k, n) => ym(new Date(+k.slice(0, 4), +k.slice(5) - 1 + n, 1));
	const FAC = [["Clubhouse hall", 1500, "Parties up to 60 people"], ["Banquet lawn", 3000, "Weddings and large events"], ["Tennis court", 200, "Per hour"], ["Swimming pool", 0, "Free for residents, slots only"], ["Gym", 0, "Free for residents, slots only"]];
	const SLOTS = ["6 am to 8 am", "8 am to 10 am", "4 pm to 6 pm", "6 pm to 8 pm", "8 pm to 10 pm"];
	const COMPC = ["Lift", "Water", "Security", "Parking", "Garbage", "Noise", "Electrical", "Other"];
	function seed() {
		if (S.get("seeded", false)) return;
		const R = rng(101), now = new Date(), flats = [];
		["A", "B", "C"].forEach((t) => { for (let f = 1; f <= 8; f++) for (let k = 1; k <= 4; k++) { const nm = person(R); flats.push({ id: t + "-" + f + "0" + k, tower: t, no: f + "0" + k, owner: nm, phone: UI.phone(R), occ: R() < 0.72 ? "Owner" : "Tenant", tenant: "", area: [850, 1150, 1150, 1450][k - 1], parking: k < 4 ? 1 : 2, vacant: R() < 0.04 }); } });
		flats.forEach((f) => { if (f.occ === "Tenant") f.tenant = person(R); });
		const rate = 3, sinking = 500, months = []; for (let i = -6; i <= 0; i++) months.push(shift(ym(now), i));
		const pays = []; flats.forEach((f) => { const lag = R() < 0.82 ? 0 : R() < 0.55 ? 1 : 2 + Math.floor(R() * 2); months.forEach((m, mi) => { if (mi > months.length - 1 - lag) return; const amt = f.area * rate + sinking; pays.push({ id: "p" + pays.length, flat: f.id, month: m, amt, ts: new Date(m + "-" + String(3 + Math.floor(R() * 12)).padStart(2, "0") + "T11:00:00").getTime(), mode: pick(["UPI", "UPI", "UPI", "Cheque", "Cash"], R) }); }); });
		const vis = []; for (let i = 0; i < 70; i++) { const f = pick(flats, R), ts = Date.now() - Math.floor(R() * 5 * day); vis.push({ id: "v" + i, flat: f.id, name: person(R), purpose: pick(["Guest", "Guest", "Delivery", "Cab", "Service staff", "Courier"], R), vehicle: R() < 0.4 ? "UP16 " + pick(["AB", "CD", "EF"], R) + " " + (1000 + Math.floor(R() * 8999)) : "", ts, out: ts + (10 + Math.floor(R() * 90)) * 6e4, status: "out", code: "" }); }
		vis.sort((a, b) => a.ts - b.ts);
		const comps = [...Array(14)].map((_, i) => ({ id: "c" + i, flat: pick(flats, R).id, cat: pick(COMPC, R), text: pick(["Lift stuck between floors", "No water supply since morning", "Stray dogs near the gate", "Visitor cars blocking my parking", "Garbage not collected", "Loud music late at night", "Corridor light not working", "Club gym treadmill broken"], R), status: i < 5 ? "open" : i < 9 ? "progress" : "resolved", ts: Date.now() - Math.floor(R() * 12) * day }));
		const exp = []; months.forEach((m) => [["Security guards", 190000, 8000], ["Housekeeping", 95000, 5000], ["Common electricity", 112000, 15000], ["Lift AMC", 42000, 0], ["Water and STP", 38000, 6000], ["Repairs", 30000, 25000], ["Garden", 14000, 2000], ["Office and admin", 12000, 3000]].forEach(([cat, a, v]) => exp.push({ id: "x" + exp.length, month: m, cat, amt: Math.round((a + R() * v) / 100) * 100, ts: new Date(m + "-18").getTime() })));
		const notices = [{ id: "n1", ts: Date.now() - 1 * day, title: "Water supply off on Sunday", body: "Tank cleaning on Sunday from 10 am to 2 pm. Please store water." }, { id: "n2", ts: Date.now() - 6 * day, title: "Diwali decoration and fireworks rules", body: "Fireworks only in the central lawn between 7 pm and 10 pm. Please keep corridors clear." }, { id: "n3", ts: Date.now() - 12 * day, title: "Annual general meeting", body: "AGM on the 28th at 11 am in the clubhouse. Agenda: accounts, audit, EV chargers, security contract." }];
		const polls = [{ id: "pl1", q: "Should we install EV charging points in the basement?", opts: ["Yes, install 4 chargers", "Yes, but only 2 for now", "No"], votes: {}, ends: iso(addDays(now, 6)) }]; flats.slice(0, 41).forEach((f, i) => (polls[0].votes[f.id] = i % 5 === 4 ? 2 : i % 3 === 0 ? 1 : 0));
		const book = [{ id: "b1", fac: 0, date: iso(addDays(now, 3)), slot: 3, flat: "A-402", by: "Sanjay Verma", status: "confirmed", fee: 1500 }, { id: "b2", fac: 2, date: iso(addDays(now, 1)), slot: 2, flat: "B-201", by: "Isha Jain", status: "confirmed", fee: 200 }, { id: "b3", fac: 1, date: iso(addDays(now, 9)), slot: 3, flat: "C-703", by: "Kavita Rao", status: "pending", fee: 3000 }];
		S.set("flats", flats); S.set("pays", pays); S.set("vis", vis); S.set("comps", comps); S.set("exp", exp); S.set("notices", notices); S.set("polls", polls); S.set("book", book); S.set("settings", { name: "Lotus Heights CHS", addr: "Sector 137, Noida", rate, sinking, due: 10, late: 100, upi: "lotusheights@upi", phone: "9811000800", secretary: "Mrs. Radha Menon" }); S.set("seeded", true);
	}
	seed();
	const sync = () => { try { ch && ch.postMessage("x"); } catch (e) {} };
	const flats = () => S.get("flats", []), flat = (id) => flats().find((f) => f.id === id), pays = () => S.get("pays", []), settings = () => S.get("settings", {});
	const charge = (f) => f.area * settings().rate + settings().sinking;
	function ledger(fid) { const f = flat(fid), cur = ym(new Date()), rows = [], s = settings(), now = new Date(); for (let m = shift(cur, -6); m <= cur; m = shift(m, 1)) rows.push({ month: m, due: charge(f), paid: 0 }); pays().filter((p) => p.flat === fid).forEach((p) => { const r = rows.find((x) => x.month === p.month); if (r) r.paid += p.amt; }); rows.forEach((r) => { r.out = r.due - r.paid; r.late = r.month < cur || now.getDate() > s.due; r.fine = r.out > 0 && r.late ? s.late : 0; }); return rows; }
	const owed = (fid) => ledger(fid).reduce((a, r) => a + Math.max(0, r.out) + (r.out > 0 ? r.fine : 0), 0);
	function onChange(fn) { ch && (ch.onmessage = () => fn()); window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith("sh-")) fn(); }); }
	return { S, FAC, SLOTS, COMPC, ym, shift, flats, flat, pays, charge, ledger, owed, settings, sync, onChange };
})();
