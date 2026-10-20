/* Lumen Dental: shared layer: storage, availability engine, appointments, patient record, layout. */
(function () {
	const D = window.LD_DATA;
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => [...r.querySelectorAll(s)];
	const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
	const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
	const store = { get(k, d) { try { const v = localStorage.getItem("ld-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("ld-" + k, JSON.stringify(v)); } catch (e) {} } };
	const img = (k) => "img/" + k + ".jpg";
	const pd = (s) => (typeof s === "string" ? new Date(s + "T00:00:00") : new Date(s));
	const iso = (d) => { const x = pd(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
	const addDays = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return x; };
	const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };
	const svc = (id) => D.services.find((s) => s.id === id);
	const doc = (id) => D.doctors.find((d) => d.id === id);
	const tstr = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
	const tmin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
	const fmtT = (t) => { const h = +t.slice(0, 2); return ((h + 11) % 12 + 1) + ":" + t.slice(3, 5) + (h >= 12 ? " pm" : " am"); };
	const NAMES = ["Aarti Singh", "Rohit Malhotra", "Sneha Kulkarni", "Imran Qureshi", "Pooja Arora", "Karan Bedi", "Divya Menon", "Sahil Anand", "Nisha Gupta", "Aditya Rao", "Ritu Chawla", "Manav Khanna", "Tanvi Joshi", "Faisal Ahmed", "Simran Kohli", "Yash Tandon", "Meghna Das", "Harsh Vora"];

	/* ---------- schedule engine ---------- */
	const off = () => store.get("off", {}); // {"doc|date": true}
	const works = (d, date) => doc(d).days.includes(pd(date).getDay()) && !off()[d + "|" + date];
	function seeded(date) {
		const out = [];
		D.doctors.forEach((dc) => {
			if (!works(dc.id, date)) return;
			let t = D.hours.open * 60, i = 0;
			while (t < D.hours.close * 60) {
				const h = hash(dc.id + date + t);
				if (t >= D.hours.lunch[0] * 60 && t < D.hours.lunch[1] * 60) { t = D.hours.lunch[1] * 60; continue; }
				if (h % 100 < 52) {
					const sid = dc.skills[h % dc.skills.length], s = svc(sid), dur = Math.max(30, s.dur);
					if (t + dur <= D.hours.close * 60 && !(t < D.hours.lunch[0] * 60 && t + dur > D.hours.lunch[0] * 60)) {
						out.push({ id: "S" + date.replace(/-/g, "") + dc.id[0] + t, doc: dc.id, date, time: tstr(t), dur, svc: sid, name: NAMES[h % NAMES.length], phone: "98" + (10000000 + (h % 80000000)), seeded: true });
						t += dur; continue;
					}
				}
				t += 30; i++;
			}
		});
		return out;
	}
	const real = () => store.get("appts", []);
	const stat = () => store.get("st", {});
	function dayAppts(date) {
		const nowMin = new Date().getHours() * 60 + new Date().getMinutes(), isToday = date === iso(new Date()), st = stat();
		return [...seeded(date), ...real().filter((a) => a.date === date)].map((a) => {
			let s = st[a.id] || a.status;
			if (!s) s = date < iso(new Date()) || (isToday && tmin(a.time) + a.dur <= nowMin) ? "completed" : "booked";
			return { ...a, status: s };
		}).sort((a, b) => (a.time < b.time ? -1 : 1));
	}
	function slots(docId, date, dur, ignoreId) {
		if (!works(docId, date)) return [];
		const busy = dayAppts(date).filter((a) => a.doc === docId && a.status !== "cancelled" && a.id !== ignoreId);
		const out = [], nowMin = new Date().getHours() * 60 + new Date().getMinutes() + 60, isToday = date === iso(new Date());
		for (let t = D.hours.open * 60; t + dur <= D.hours.close * 60; t += 30) {
			if (t < D.hours.lunch[1] * 60 && t + dur > D.hours.lunch[0] * 60) continue;
			if (isToday && t < nowMin) continue;
			if (date < iso(new Date())) continue;
			const clash = busy.some((a) => t < tmin(a.time) + a.dur && t + dur > tmin(a.time));
			if (!clash) out.push(tstr(t));
		}
		return out;
	}
	function nextFree(sid) { // soonest slot across doctors able to do this service
		const s = svc(sid), docs = D.doctors.filter((d) => d.skills.includes(sid));
		for (let i = 0; i < 21; i++) { const date = iso(addDays(new Date(), i)); let best = null; docs.forEach((d) => { const f = slots(d.id, date, s.dur)[0]; if (f && (!best || f < best.time)) best = { date, time: f, doc: d.id }; }); if (best) return best; }
		return null;
	}
	function book(a) { const l = real(); const n = store.get("seq", 700) + 1; store.set("seq", n); a.id = "LD-" + n; a.ts = Date.now(); l.push(a); store.set("appts", l); return a; }
	function setStatus(id, s) { const st = stat(); st[id] = s; store.set("st", st); const l = real(), r = l.find((x) => x.id === id); if (r) { r.status = s; store.set("appts", l); } }
	function ics(a) {
		const s = svc(a.svc), st = pd(a.date).getTime() + tmin(a.time) * 60000, f = (t) => new Date(t).toISOString().replace(/[-:]|\.\d{3}/g, "");
		const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lumen Dental//EN", "BEGIN:VEVENT", "UID:" + a.id + "@lumendental.example", "DTSTAMP:" + f(Date.now()), "DTSTART:" + f(st), "DTEND:" + f(st + a.dur * 60000), "SUMMARY:" + s.name + ". Lumen Dental", "LOCATION:Lumen Dental, 21 Garden Lane, Sector 18, Noida", "DESCRIPTION:With " + doc(a.doc).name, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
		const el = document.createElement("a"); el.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" })); el.download = "lumen-appointment.ics"; el.click();
	}
	const patient = { get: () => store.get("patient", null), set: (p) => store.set("patient", p) };
	function toast(msg) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2600); }
	const isOpen = () => { const d = new Date(), m = d.getHours() * 60 + d.getMinutes(); return D.hours.days.includes(d.getDay()) && m >= D.hours.open * 60 && m < D.hours.close * 60; };

	const NAV = [["services.html", "Treatments"], ["team.html", "Our team"], ["financing.html", "Pricing & EMI"], ["smile-quiz.html", "Smile quiz"], ["contact.html", "Visit"]];
	function layout(active) {
		const h = $("#site-header"), f = $("#site-footer"), p = patient.get();
		if (h) h.innerHTML = `<header class="hdr"><div class="hdr-in"><a class="logo" href="index.html"><i>✦</i>Lumen Dental</a>
			<nav class="nav" id="nav">${NAV.map(([u, n]) => `<a href="${u}"${u === active ? ' aria-current="page"' : ""}>${n}</a>`).join("")}<a href="portal.html"${active === "portal.html" ? ' aria-current="page"' : ""}>${p ? "My portal" : "Patient portal"}</a></nav>
			<a class="btn sm" href="book.html">Book a visit</a><button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button></div></header>`;
		if (f) f.innerHTML = `<footer class="ftr"><div class="wrap ftr-grid"><div><a class="logo" href="index.html"><i>✦</i>Lumen Dental</a><p>Gentle, modern dentistry in Sector 18, Noida.</p><p>${isOpen() ? '<span class="open y">Open now</span>' : '<span class="open n">Closed</span>'} Mon–Sat 9 am – 6 pm</p></div>
			<div><h4>Treatments</h4>${D.services.slice(0, 6).map((s) => `<a href="service.html?s=${s.id}">${s.name}</a>`).join("")}</div>
			<div><h4>Clinic</h4>${NAV.map(([u, n]) => `<a href="${u}">${n}</a>`).join("")}<a href="admin.html">Clinic dashboard</a></div>
			<div><h4>Contact</h4><a href="tel:+911204001818">+91 120 400 1818</a><a href="mailto:smile@lumendental.example">smile@lumendental.example</a><p>21 Garden Lane, Sector 18, Noida</p></div></div>
			<div class="wrap ftr-fine"><span>© Lumen Dental, a fictional clinic, built as a concept demo.</span><span>Photography: <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a></span></div></footer>`;
		const b = $("#burger"); if (b) b.onclick = () => { const o = $("#nav").classList.toggle("open"); b.setAttribute("aria-expanded", o); };
	}
	window.LD = { D, $, $$, inr, esc, store, img, pd, iso, addDays, hash, svc, doc, tstr, tmin, fmtT, works, off, dayAppts, slots, nextFree, book, setStatus, ics, patient, toast, isOpen, layout, real, stat, NAMES };
})();
