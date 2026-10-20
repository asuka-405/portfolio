/* FitForge: shared layer: storage, timetable engine, bookings, membership, layout. */
(function () {
	const D = window.FF_DATA;
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => [...r.querySelectorAll(s)];
	const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
	const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
	const store = {
		get(k, d) { try { const v = localStorage.getItem("ff-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
		set(k, v) { try { localStorage.setItem("ff-" + k, JSON.stringify(v)); } catch (e) {} },
	};
	const img = (k) => "img/" + k + ".jpg";
	const iso = (d) => { const x = pd(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
	const addDays = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return x; };
	const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };
	const pd = (s) => (typeof s === "string" ? new Date(s + "T00:00:00") : new Date(s));
	const DAYN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

	/* ---------- config overrides (admin can edit capacity / cancel a class) ---------- */
	const over = () => store.get("over", {}); // {progId: {cap}}  and  {cancelled: {sessionId:true}}
	const prog = (id) => { const p = D.programs[id]; const o = over()[id]; return o ? { ...p, ...o } : p; };

	/* ---------- sessions ---------- */
	function sessionsOn(date) {
		const dow = pd(date).getDay(), ds = iso(pd(date)), now = Date.now();
		return (D.schedule[dow] || []).map(([time, pid]) => {
			const p = prog(pid), id = ds + "|" + time + "|" + pid, start = new Date(ds + "T" + time + ":00").getTime();
			const seed = hash(id) % 100, base = Math.min(p.cap, Math.floor(p.cap * (0.35 + seed / 160)));
			const mine = bookings.get().filter((b) => b.id === id);
			const booked = mine.some((b) => b.st === "booked"), wait = mine.some((b) => b.st === "wait");
			const taken = Math.min(p.cap, base + (booked ? 1 : 0));
			return { id, date: ds, time, pid, p, start, end: start + p.dur * 60000, taken, left: p.cap - taken, full: taken >= p.cap, past: start < now, booked, wait, cancelled: !!over().cancelled?.[id] };
		});
	}
	const bookings = {
		get: () => store.get("bookings", []),
		save: (b) => store.set("bookings", b),
		weekCount(date) { const d = pd(date), mon = addDays(d, -((d.getDay() + 6) % 7)); const a = iso(mon), z = iso(addDays(mon, 6)); return bookings.get().filter((b) => b.st === "booked" && b.id.slice(0, 10) >= a && b.id.slice(0, 10) <= z).length; },
	};
	const windowDays = () => { const m = member.get(); return m ? ({ offpeak: 3, unlimited: 7, coached: 14, trial: 7, day: 1 }[m.plan] || 7) : 0; };
	function book(s) {
		const m = member.get();
		if (!m) return { ok: false, need: "join", msg: "Join or start a free week to book classes." };
		if (m.status === "frozen") return { ok: false, msg: "Your membership is frozen. Unfreeze it from your account to book." };
		const days = Math.round((pd(s.date) - pd(iso(new Date()))) / 864e5);
		if (days > windowDays()) return { ok: false, msg: `Your ${planName(m.plan)} plan books up to ${windowDays()} days ahead.` };
		if (m.plan === "offpeak" && bookings.weekCount(s.date) >= 2) return { ok: false, msg: "Off-peak includes 2 classes a week. Upgrade to Unlimited for more." };
		const l = bookings.get();
		if (l.some((b) => b.id === s.id)) return { ok: false, msg: "You're already on this class." };
		const clash = l.find((b) => b.st === "booked" && b.id.slice(0, 10) === s.date && Math.abs(new Date(b.id.slice(0, 10) + "T" + b.id.slice(11, 16)) - s.start) < 60 * 60000);
		if (clash) return { ok: false, msg: "That overlaps another class you've booked." };
		const st = s.full ? "wait" : "booked"; l.push({ id: s.id, st, ts: Date.now() }); bookings.save(l);
		return { ok: true, st, msg: st === "wait" ? "You're on the waitlist, we'll text you if a spot opens." : "Spot reserved. See you there!" };
	}
	function cancel(id) { bookings.save(bookings.get().filter((b) => b.id !== id)); }
	function ics(s) {
		const f = (t) => new Date(t).toISOString().replace(/[-:]|\.\d{3}/g, "");
		const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FitForge//EN", "BEGIN:VEVENT", "UID:" + s.id + "@fitforge.example", "DTSTAMP:" + f(Date.now()), "DTSTART:" + f(s.start), "DTEND:" + f(s.end), "SUMMARY:" + s.p.name + " at FitForge", "LOCATION:FitForge, Sector 62, Noida", "DESCRIPTION:Coach " + D.coaches[s.p.coach].name, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
		const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" })); a.download = s.p.name.replace(/\W+/g, "-").toLowerCase() + ".ics"; a.click();
	}

	/* ---------- membership ---------- */
	const planName = (id) => (({ trial: "Free 7-day pass", day: "Day pass" })[id]) || (D.plans.find((p) => p.id === id) || {}).name || id;
	const member = {
		get: () => store.get("member", null),
		set: (m) => store.set("member", m),
		create({ name, phone, email, plan, billing, goal }) {
			const n = store.get("seq", 4100) + 1; store.set("seq", n);
			const m = { id: "FF" + n, name, phone, email, plan, billing: billing || "monthly", goal: goal || "", joined: Date.now(), status: "active", expires: Date.now() + (plan === "trial" ? 7 : plan === "day" ? 1 : billing === "annual" ? 365 : 30) * 864e5 };
			member.set(m); seedHistory(m); leads.add(m); return m;
		},
	};
	function seedHistory(m) { // plausible past 10 weeks of check-ins for the member portal demo
		if (m.plan === "trial" || m.plan === "day") { store.set("checkins", []); return; }
		const out = []; let seed = hash(m.id);
		for (let d = 70; d >= 1; d--) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; if (seed % 100 < 42) out.push(iso(addDays(new Date(), -d))); }
		store.set("checkins", out);
	}
	const leads = { get: () => store.get("leads", []), add(m) { const l = leads.get(); l.push({ id: m.id, name: m.name, phone: m.phone, plan: m.plan, ts: Date.now() }); store.set("leads", l); } };
	function streak() { const c = new Set(store.get("checkins", [])); let n = 0, d = new Date(); if (!c.has(iso(d))) d = addDays(d, -1); while (c.has(iso(d))) { n++; d = addDays(d, -1); } return n; }

	/* ---------- ui ---------- */
	function toast(msg) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2600); }
	const NAV = [["classes.html", "Classes"], ["memberships.html", "Membership"], ["coaches.html", "Coaches"], ["facilities.html", "Facilities"], ["tools.html", "Calculators"]];
	function layout(active) {
		const m = member.get();
		const h = $("#site-header"), f = $("#site-footer");
		if (h) h.innerHTML = `<header class="hdr"><div class="hdr-in"><a class="logo" href="index.html">FIT<b>FORGE</b></a>
			<nav class="nav" id="nav">${NAV.map(([u, n]) => `<a href="${u}"${u === active ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>
			<a class="btn sm ghost" href="${m ? "account.html" : "join.html?plan=trial"}">${m ? "My account" : "Free week"}</a><a class="btn sm" href="${m ? "classes.html" : "join.html"}">${m ? "Book a class" : "Join now"}</a>
			<button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button></div></header>`;
		if (f) f.innerHTML = `<footer class="ftr"><div class="wrap ftr-grid"><div><a class="logo" href="index.html">FIT<b>FORGE</b></a><p>Strength, conditioning and mobility. Sector 62, Noida.</p><p>Mon–Fri 5:30 am – 10:30 pm<br>Sat–Sun 7 am – 8 pm</p></div>
			<div><h4>Train</h4>${NAV.map(([u, n]) => `<a href="${u}">${n}</a>`).join("")}</div>
			<div><h4>Members</h4><a href="join.html">Join</a><a href="account.html">My account</a><a href="admin.html">Owner dashboard</a></div>
			<div><h4>Contact</h4><a href="tel:+911204005000">+91 120 400 5000</a><a href="mailto:train@fitforge.example">train@fitforge.example</a></div></div>
			<div class="wrap ftr-fine"><span>© FitForge, a fictional gym, built as a concept demo. No payments are taken.</span><span>Photography: <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a></span></div></footer>`;
		const b = $("#burger"); if (b) b.onclick = () => { const o = $("#nav").classList.toggle("open"); b.setAttribute("aria-expanded", o); };
	}
	window.FF = { pd, D, $, $$, inr, esc, store, img, iso, addDays, hash, DAYN, prog, sessionsOn, bookings, book, cancel, ics, windowDays, planName, member, leads, streak, toast, layout };
})();
