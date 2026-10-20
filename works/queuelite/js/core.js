/* QueueLite core: queue engine shared by desk, display, kiosk, tracker, analytics and settings (concept build). */
(function () {
	const S = UI.store("ql2-");
	const day = 864e5, min = 6e4;
	const KEY = "state";
	const DEF_SERVICES = [
		{ id: "consult", name: "Consultation", prefix: "A", avg: 12, color: "#6c47ff" },
		{ id: "billing", name: "Billing & payments", prefix: "B", avg: 5, color: "#0ea5e9" },
		{ id: "pharma", name: "Pharmacy pick-up", prefix: "C", avg: 4, color: "#10b981" },
		{ id: "reports", name: "Lab reports", prefix: "D", avg: 6, color: "#f59e0b" },
	];
	function fresh() {
		const st = { seq: {}, services: DEF_SERVICES, counters: [{ id: "c1", name: "Counter 1", svc: ["consult", "reports"], open: true, cur: null }, { id: "c2", name: "Counter 2", svc: ["consult"], open: true, cur: null }, { id: "c3", name: "Counter 3", svc: ["billing", "pharma"], open: true, cur: null }, { id: "c4", name: "Counter 4", svc: ["billing", "pharma", "reports"], open: false, cur: null }], tickets: [], settings: { biz: "Greenleaf Clinic", voice: false, sms: "Hi {name}, your token {no} is {pos} in line (~{eta} min). Track: {link}", hours: "9:00 – 18:00", msg: "Please keep your token handy. Thank you for your patience." }, call: null };
		// history for analytics: last 7 days of completed tickets
		const R = UI.rng(99), names = ["Aarti", "Rohit", "Sneha", "Imran", "Pooja", "Karan", "Divya", "Sahil", "Nisha", "Aditya"];
		for (let d = 7; d >= 1; d--) { const n = 70 + Math.floor(R() * 60); for (let i = 0; i < n; i++) { const svc = st.services[Math.floor(R() * R() * 4)], hr = 9 + Math.floor(R() * 9 * (0.6 + R() * 0.4)), ts = new Date(Date.now() - d * day).setHours(hr, Math.floor(R() * 60), 0, 0), wait = Math.round((2 + R() * 14 + (hr === 11 || hr === 12 ? 8 : 0)) * min), serve = Math.round(svc.avg * (0.6 + R() * 0.9) * min); st.seq[svc.prefix] = (st.seq[svc.prefix] || 0) + 1; st.tickets.push({ id: "h" + d + "-" + i, no: svc.prefix + String(st.seq[svc.prefix]).padStart(3, "0"), svc: svc.id, name: names[i % names.length], ts, status: R() < 0.06 ? "noshow" : "done", counter: ["c1", "c2", "c3"][Math.floor(R() * 3)], calledAt: ts + wait, startAt: ts + wait, doneAt: ts + wait + serve, hist: true }); } }
		st.seq = {}; return st;
	}
	let st = S.get(KEY, null); if (!st) { st = fresh(); S.set(KEY, st); }
	const bc = "BroadcastChannel" in window ? new BroadcastChannel("ql2") : null;
	const listeners = [];
	function commit(evt) { S.set(KEY, st); bc && bc.postMessage(evt || { t: "state" }); listeners.forEach((f) => f(evt)); }
	function reload() { st = S.get(KEY, st); }
	window.addEventListener("storage", (e) => { if (e.key === "ql2-" + KEY) { reload(); listeners.forEach((f) => f({ t: "state" })); } });
	bc && (bc.onmessage = (e) => { reload(); listeners.forEach((f) => f(e.data)); });

	const svc = (id) => st.services.find((s) => s.id === id) || { name: "?", color: "#999", avg: 5, prefix: "?" };
	const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
	const todays = () => st.tickets.filter((t) => t.ts >= today0());
	const waiting = (svcId) => todays().filter((t) => t.status === "waiting" && (!svcId || t.svc === svcId)).sort((a, b) => (b.prio ? 1 : 0) - (a.prio ? 1 : 0) || a.ts - b.ts);
	const serving = () => todays().filter((t) => t.status === "serving");
	function openCountersFor(svcId) { return st.counters.filter((c) => c.open && c.svc.includes(svcId)).length || 1; }
	function estWait(t) { // minutes for a waiting ticket
		const q = waiting(t.svc), idx = q.findIndex((x) => x.id === t.id), ahead = idx < 0 ? q : q.slice(0, idx), base = ahead.reduce((a, x) => a + svc(x.svc).avg, 0);
		return Math.max(1, Math.round(base / openCountersFor(t.svc) + (serving().some((s) => s.svc === t.svc) ? svc(t.svc).avg / 3 : 0)));
	}
	const estNew = (svcId) => Math.max(1, Math.round(waiting(svcId).reduce((a, x) => a + svc(x.svc).avg, 0) / openCountersFor(svcId)));
	const position = (t) => waiting(t.svc).findIndex((x) => x.id === t.id) + 1;

	function issue({ svc: sid, name, phone, prio, source }) {
		const s = svc(sid); st.seq[s.prefix] = (st.seq[s.prefix] || 0) + 1; const day0 = today0();
		const n = todays().filter((t) => t.svc === sid).length + 1;
		const t = { id: "t" + Date.now() + Math.floor(Math.random() * 999), no: s.prefix + String(n).padStart(3, "0"), svc: sid, name: name || "Walk-in", phone: phone || "", prio: !!prio, ts: Date.now(), status: "waiting", source: source || "desk", counter: null };
		st.tickets.push(t); commit({ t: "issue", id: t.id }); return t;
	}
	function callNext(counterId, svcId) {
		const c = st.counters.find((x) => x.id === counterId); if (!c || !c.open) return null; if (c.cur) finish(counterId, "done", true);
		const pool = waiting().filter((t) => c.svc.includes(t.svc) && (!svcId || t.svc === svcId)); const t = pool[0]; if (!t) { commit(); return null; }
		t.status = "serving"; t.counter = counterId; t.calledAt = Date.now(); t.startAt = Date.now(); c.cur = t.id; st.call = { id: t.id, no: t.no, counter: c.name, ts: Date.now() }; commit({ t: "call", ...st.call }); return t;
	}
	function recall(counterId) { const c = st.counters.find((x) => x.id === counterId), t = c && c.cur && st.tickets.find((x) => x.id === c.cur); if (!t) return; st.call = { id: t.id, no: t.no, counter: c.name, ts: Date.now() }; commit({ t: "call", ...st.call }); }
	function finish(counterId, how, silent) { const c = st.counters.find((x) => x.id === counterId), t = c && c.cur && st.tickets.find((x) => x.id === c.cur); if (!t) return; t.status = how; t.doneAt = Date.now(); c.cur = null; if (!silent) commit(); }
	function transfer(tid, to) { const t = st.tickets.find((x) => x.id === tid); if (!t) return; const c = st.counters.find((x) => x.cur === tid); if (c) c.cur = null; t.svc = to; t.status = "waiting"; t.counter = null; t.ts = Date.now() - 1000; commit(); }
	function cancel(tid) { const t = st.tickets.find((x) => x.id === tid); if (!t) return; t.status = "cancelled"; commit(); }
	function setCounter(id, patch) { const c = st.counters.find((x) => x.id === id); Object.assign(c, patch); commit(); }
	function simulate(n = 10) { const R = Math.random; for (let i = 0; i < n; i++) { const s = st.services[Math.floor(R() * R() * st.services.length)]; issue({ svc: s.id, name: ["Anil", "Bhavna", "Chirag", "Deepa", "Eshaan", "Farah", "Girish", "Hema"][Math.floor(R() * 8)], phone: "98" + Math.floor(10000000 + R() * 8e7), source: "sim" }); } }
	function speak(t) { if (!st.settings.voice || !window.speechSynthesis) return; try { const u = new SpeechSynthesisUtterance(`Token ${t.no.split("").join(" ")}, please go to ${t.counter}`); u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
	function chime() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), g = c.createGain(); g.connect(c.destination); [880, 1175].forEach((f, i) => { const o = c.createOscillator(); o.frequency.value = f; o.connect(g); g.gain.setValueAtTime(0.14, c.currentTime + i * 0.25); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.25 + 0.4); o.start(c.currentTime + i * 0.25); o.stop(c.currentTime + i * 0.25 + 0.45); }); } catch (e) {} }

	function stats() {
		const all = st.tickets, t0 = today0(), done = all.filter((t) => t.status === "done" && t.startAt), tod = done.filter((t) => t.ts >= t0), avg = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0);
		return { waiting: waiting().length, serving: serving().length, servedToday: tod.length, avgWaitToday: avg(tod, (t) => t.calledAt - t.ts) / min, avgWait7: avg(done, (t) => t.calledAt - t.ts) / min, avgServe7: avg(done, (t) => t.doneAt - t.startAt) / min, noShowRate: all.length ? all.filter((t) => t.status === "noshow").length / all.length : 0 };
	}
	const nav = [["desk.html", "🎛 Desk", "desk"], ["display.html", "📺 Waiting-room display", "display"], ["kiosk.html", "Self check-in kiosk", "kiosk"], ["track.html", "📱 Customer tracker", "track"], ["analytics.html", "📊 Analytics", "analytics"], ["settings.html", "⚙ Settings", "settings"]];
	function side(active) {
		const el = UI.$(".side"); if (!el) return;
		el.innerHTML = `<a class="brand" href="index.html"><i>Q</i><span>QueueLite<small>${UI.esc(st.settings.biz)}</small></span></a><div class="grp">Console</div>${nav.map(([u, n, k]) => `<a class="nv ${k === active ? "on" : ""}" href="${u}">${n}${k === "desk" ? `<span class="n" id="wcount">${waiting().length}</span>` : ""}</a>`).join("")}<div class="sp"></div><a class="nv" href="index.html">← About QueueLite</a>`;
		listeners.push(() => { const w = UI.$("#wcount"); if (w) w.textContent = waiting().length; });
	}
	const api = { get state() { return st; }, svc, waiting, serving, todays, estWait, estNew, position, issue, callNext, recall, finish, transfer, cancel, setCounter, simulate, speak, chime, stats, commit, on: (f) => listeners.push(f), side, reset() { S.clear(); st = fresh(); S.set(KEY, st); commit(); }, openCountersFor, today0 };
	window.QL = api;
})();
