/* ShiftBoard core: data, scheduling helpers and compliance rules (concept build). */
(function () {
	const { iso, addDays, pd, hash, rng, store } = UI;
	const S = store("sb2-");
	const hr = 36e5, day = 864e5;
	const DEFAULT_SHIFTS = [{ id: "M", name: "Morning", start: "07:00", end: "15:00", color: "#fbbf24" }, { id: "E", name: "Evening", start: "15:00", end: "23:00", color: "#60a5fa" }, { id: "N", name: "Night", start: "23:00", end: "07:00", color: "#a78bfa" }, { id: "G", name: "General", start: "09:00", end: "17:00", color: "#34d399" }];
	const weekKey = (d) => { const x = pd(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); };
	const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
	function seed() {
		if (S.get("seeded", false)) return;
		const settings = { biz: "Metro Mart", locations: [{ id: "noida", name: "Noida · Sector 62" }, { id: "gurugram", name: "Gurugram · Sector 29" }], shifts: DEFAULT_SHIFTS, cover: { M: 2, E: 2, N: 1, G: 1 }, ot: 48, budget: 115000, rest: 11, published: {} };
		const people = [["Anita Sharma", "Store manager", 420, 45, "G", "noida"], ["Rohit Verma", "Cashier", 220, 40, "M", "noida"], ["Sana Khan", "Cashier", 220, 40, "E", "noida"], ["Vikram Singh", "Stock handler", 200, 40, "M", "noida"], ["Deepa Nair", "Floor associate", 210, 40, "E", "noida"], ["Imran Ali", "Security", 190, 48, "N", "noida"], ["Priya Menon", "Cashier", 220, 40, "E", "gurugram"], ["Karan Bedi", "Floor associate", 210, 40, "M", "gurugram"], ["Neha Gupta", "Cashier", 220, 32, "M", "gurugram"], ["Arjun Rao", "Stock handler", 200, 40, "E", "gurugram"], ["Meera Joshi", "Store manager", 420, 45, "G", "gurugram"], ["Sahil Anand", "Security", 190, 48, "N", "gurugram"]];
		const staff = people.map((p, i) => ({ id: "e" + (i + 1), name: p[0], role: p[1], rate: p[2], contract: p[3], pref: p[4], loc: p[5], phone: "98" + (10000000 + hash(p[0]) % 80000000), avail: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { M: p[4] !== "N", E: p[4] !== "N" && p[4] !== "M" || d === 6, N: p[4] === "N", G: p[4] === "G" }])) }));
		const roster = {}, R = rng(5), now = new Date();
		for (let w = -2; w <= 1; w++) { const k = weekKey(addDays(now, w * 7)); roster[k] = {}; staff.forEach((s, i) => { const offs = [(i + 2) % 7, (i * 3 + 5) % 7].map((x) => (x === 0 ? 6 : x - 1)); roster[k][s.id] = [0, 1, 2, 3, 4, 5, 6].map((d) => { if (offs.includes(d) || (w >= 0 && R() < 0.04)) return ""; if (s.pref === "G") return d >= 5 ? "" : "G"; if (s.pref === "N") return "N"; const alt = R() < 0.25; return s.pref === "M" ? (alt ? "E" : "M") : alt ? "M" : "E"; }); }); }
		const clock = []; const t = new Date(); t.setHours(0, 0, 0, 0);
		for (let d = 14; d >= 1; d--) { const date = addDays(t, -d), k = weekKey(date), di = (date.getDay() + 6) % 7; staff.forEach((s) => { const r = roster[k] && roster[k][s.id]; const sh = r && r[di]; if (!sh) return; if (R() < 0.04) return; const def = DEFAULT_SHIFTS.find((x) => x.id === sh), st = new Date(date); st.setHours(+def.start.slice(0, 2), +def.start.slice(3), 0, 0); const inn = st.getTime() + Math.round((R() * 14 - 4) * 6e4), len = (toMin(def.end) - toMin(def.start) + 1440) % 1440 * 6e4; clock.push({ id: "c" + clock.length, staff: s.id, in: inn, out: inn + len + Math.round((R() * 30 - 8) * 6e4), shift: sh }); }); }
		const requests = [{ id: "r1", type: "timeoff", staff: "e2", date: iso(addDays(now, 3)), note: "Family function", status: "pending", ts: Date.now() - 3 * hr }, { id: "r2", type: "swap", staff: "e3", date: iso(addDays(now, 2)), to: "e5", note: "Doctor's appointment", status: "pending", ts: Date.now() - 6 * hr }, { id: "r3", type: "timeoff", staff: "e8", date: iso(addDays(now, 6)), note: "Wedding", status: "approved", ts: Date.now() - 30 * hr }];
		S.set("settings", settings); S.set("staff", staff); S.set("roster", roster); S.set("clock", clock); S.set("requests", requests); S.set("seeded", true);
	}
	seed();
	const g = (k, d) => S.get(k, d), api = {
		S, weekKey, toMin, hr, day,
		settings: () => g("settings"), staff: () => g("staff", []), roster: () => g("roster", {}), clock: () => g("clock", []), requests: () => g("requests", []),
		save: (k, v) => S.set(k, v),
		shift(id) { return api.settings().shifts.find((s) => s.id === id); },
		hours(id) { const s = api.shift(id); if (!s) return 0; return (((toMin(s.end) - toMin(s.start)) + 1440) % 1440) / 60; },
		cell(wk, sid, d) { const r = api.roster()[wk]; return (r && r[sid] && r[sid][d]) || ""; },
		setCell(wk, sid, d, v) { const r = api.roster(); r[wk] = r[wk] || {}; r[wk][sid] = r[wk][sid] || ["", "", "", "", "", "", ""]; r[wk][sid][d] = v; api.save("roster", r); },
		weekHours(wk, sid) { return [0, 1, 2, 3, 4, 5, 6].reduce((a, d) => a + api.hours(api.cell(wk, sid, d)), 0); },
		approvedOff(sid, date) { return api.requests().some((r) => r.type === "timeoff" && r.status === "approved" && r.staff === sid && r.date === date); },
		// compliance: returns array of {level, msg} for a staff member's week
		issues(wk, sid) {
			const out = [], st = api.staff().find((x) => x.id === sid), s = api.settings(), base = pd(wk), DN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
			let run = 0;
			for (let d = 0; d < 7; d++) {
				const sh = api.cell(wk, sid, d), date = iso(addDays(base, d));
				if (!sh) { run = 0; continue; }
				run++;
				if (st && !st.avail[(d + 1) % 7][sh]) out.push({ level: "warn", msg: `${st.name} is marked unavailable for ${api.shift(sh).name} on ${DN[d]}` });
				if (api.approvedOff(sid, date)) out.push({ level: "bad", msg: `${st.name} has approved time off on ${DN[d]}` });
				const prev = d > 0 ? api.cell(wk, sid, d - 1) : "";
				if (prev) { const ps = api.shift(prev), endRel = toMin(ps.end) <= toMin(ps.start) ? toMin(ps.end) : toMin(ps.end) - 1440, rest = (toMin(api.shift(sh).start) - endRel) / 60; if (rest < s.rest) out.push({ level: "warn", msg: `${st.name}: only ${Math.max(0, Math.round(rest))} h rest before ${DN[d]}'s shift` }); }
				if (run > 6) out.push({ level: "bad", msg: `${st.name} works 7 days in a row` });
			}
			const h = api.weekHours(wk, sid); if (h > s.ot) out.push({ level: "bad", msg: `${st.name} is scheduled ${h} h (overtime above ${s.ot})` });
			return out;
		},
		coverage(wk, d, shId, loc) { return api.staff().filter((s) => (!loc || s.loc === loc) && api.cell(wk, s.id, d) === shId).length; },
		cost(wk, loc) { return api.staff().filter((s) => !loc || s.loc === loc).reduce((a, s) => { const h = api.weekHours(wk, s.id), ot = Math.max(0, h - api.settings().ot); return a + (h - ot) * s.rate + ot * s.rate * 1.5; }, 0); },
		dayCost(wk, d, loc) { return api.staff().filter((s) => !loc || s.loc === loc).reduce((a, s) => a + api.hours(api.cell(wk, s.id, d)) * s.rate, 0); },
		clockOpen(sid) { return api.clock().find((c) => c.staff === sid && !c.out); },
		clockIn(sid) { const l = api.clock(); if (l.some((c) => c.staff === sid && !c.out)) return false; const k = weekKey(new Date()), di = (new Date().getDay() + 6) % 7; l.push({ id: "c" + Date.now(), staff: sid, in: Date.now(), out: null, shift: api.cell(k, sid, di) }); api.save("clock", l); return true; },
		clockOut(sid) { const l = api.clock(), c = l.find((x) => x.staff === sid && !x.out); if (!c) return false; c.out = Date.now(); api.save("clock", l); return true; },
		autoFill(wk, loc) { // fill coverage gaps with available, least-loaded staff; returns count
			const s = api.settings(), staff = api.staff().filter((x) => !loc || x.loc === loc); let n = 0;
			for (let d = 0; d < 7; d++) s.shifts.forEach((sh) => { const need = (s.cover[sh.id] || 0) - api.coverage(wk, d, sh.id, loc); for (let k = 0; k < need; k++) { const date = iso(addDays(pd(wk), d)); const cand = staff.filter((x) => !api.cell(wk, x.id, d) && x.avail[(d + 1) % 7][sh.id] && !api.approvedOff(x.id, date) && api.weekHours(wk, x.id) + api.hours(sh.id) <= Math.min(x.contract + 4, s.ot)).sort((a, b) => api.weekHours(wk, a.id) - api.weekHours(wk, b.id))[0]; if (cand) { api.setCell(wk, cand.id, d, sh.id); n++; } } });
			return n;
		},
		reset() { S.clear(); location.reload(); },
	};
	window.SB = api;
})();
