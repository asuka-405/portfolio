/* Brew & Bean: shared layer: storage, cart, orders, loyalty, layout. Everything lives in localStorage (demo). */
(function () {
	const D = window.BB_DATA;
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => [...r.querySelectorAll(s)];
	const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
	const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
	const store = {
		get(k, d) { try { const v = localStorage.getItem("bb-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
		set(k, v) { try { localStorage.setItem("bb-" + k, JSON.stringify(v)); } catch (e) {} },
	};

	/* ---------- catalogue with admin overrides ---------- */
	const prices = () => store.get("prices", {});
	const unavailable = () => store.get("unavail", []);
	const item = (id) => D.items.find((i) => i.id === id);
	const priceOf = (i) => (prices()[i.id] != null ? prices()[i.id] : i.price);
	const isAvail = (id) => !unavailable().includes(id);

	/* ---------- cart ---------- */
	const cart = {
		get: () => store.get("cart", []),
		save(c) { store.set("cart", c); badge(); },
		unit(l) {
			const it = item(l.id); if (!it) return 0;
			let p = priceOf(it);
			if (it.drink) {
				p += (D.options.sizes.find((s) => s.n === l.size) || { p: 0 }).p;
				p += (D.options.milks.find((m) => m.n === l.milk) || { p: 0 }).p;
				(l.extras || []).forEach((x) => { p += (D.options.extras.find((e) => e.n === x) || { p: 0 }).p; });
			}
			return p;
		},
		add(l) {
			const c = cart.get(), key = JSON.stringify([l.id, l.size, l.milk, l.extras, l.note]);
			const ex = c.find((x) => JSON.stringify([x.id, x.size, x.milk, x.extras, x.note]) === key);
			if (ex) ex.qty += l.qty || 1; else c.push({ ...l, qty: l.qty || 1 });
			cart.save(c);
		},
		setQty(i, q) { const c = cart.get(); if (q <= 0) c.splice(i, 1); else c[i].qty = q; cart.save(c); },
		clear() { cart.save([]); },
		count: () => cart.get().reduce((s, l) => s + l.qty, 0),
		sub: () => cart.get().reduce((s, l) => s + cart.unit(l) * l.qty, 0),
	};
	function badge() { $$("[data-cart-count]").forEach((e) => { const n = cart.count(); e.textContent = n; e.hidden = !n; }); }

	/* ---------- totals ---------- */
	function totals(lines, o = {}) {
		const sub = lines.reduce((s, l) => s + cart.unit(l) * l.qty, 0);
		let disc = 0, freeItem = null, couponMsg = "";
		const cp = o.coupon && D.coupons[o.coupon];
		if (o.coupon && !cp) couponMsg = "That code isn't valid.";
		if (cp) {
			if (cp.type === "pct") disc = Math.min(cp.cap, sub * cp.v / 100);
			else if (cp.type === "flat") { if (sub >= cp.min) disc = cp.v; else couponMsg = "Add " + inr(cp.min - sub) + " more to use this code."; }
			else if (cp.type === "item") { if (lines.some((l) => (item(l.id) || {}).drink)) freeItem = cp.item; else couponMsg = "Add a drink to claim your free cookie."; }
		}
		const redeem = Math.max(0, Math.min(o.redeem || 0, Math.floor((sub - disc) * 10)));
		const rv = redeem * 0.1;
		const taxable = Math.max(0, sub - disc - rv);
		const gst = taxable * 0.05;
		const fee = o.mode === "delivery" && sub > 0 ? (sub >= 399 ? 0 : 40) : 0;
		const tip = o.tip || 0;
		return { sub, disc, freeItem, couponMsg, redeem, rv, gst, fee, tip, total: Math.round(taxable + gst + fee + tip) };
	}

	/* ---------- orders ---------- */
	const FLOW = { delivery: ["received", "preparing", "ready", "out", "completed"], pickup: ["received", "preparing", "ready", "completed"], dinein: ["received", "preparing", "ready", "completed"] };
	const LABEL = { received: "Order received", preparing: "Being prepared", ready: "Ready", out: "Out for delivery", completed: "Completed" };
	const DEMO_MS = { received: 15000, preparing: 45000, ready: 40000, out: 60000 }; // demo-speed auto progress
	const orders = {
		all: () => store.get("orders", []),
		save: (o) => store.set("orders", o),
		get: (id) => orders.all().find((o) => o.id === id),
		create(o) {
			const all = orders.all(); const n = 1000 + all.length + 1;
			o.id = "BB-" + n; o.ts = Date.now(); o.status = "received"; o.hist = [{ s: "received", t: o.ts }];
			all.push(o); orders.save(all);
			const p = profile.get(); if (p && o.phone === p.phone) { /* points are derived from orders */ }
			return o;
		},
		advance(id, to) {
			const all = orders.all(), o = all.find((x) => x.id === id); if (!o) return;
			const flow = FLOW[o.mode] || FLOW.pickup, i = flow.indexOf(o.status);
			const next = to || flow[Math.min(flow.length - 1, i + 1)];
			if (next !== o.status) { o.status = next; o.hist.push({ s: next, t: Date.now() }); orders.save(all); }
		},
		tick() {
			if (!store.get("auto", true)) return false;
			let changed = false; const all = orders.all(), now = Date.now();
			all.forEach((o) => {
				if (o.seeded) return;
				const flow = FLOW[o.mode] || FLOW.pickup;
				while (o.status !== "completed" && now - o.hist[o.hist.length - 1].t >= DEMO_MS[o.status]) {
					const next = flow[flow.indexOf(o.status) + 1];
					o.hist.push({ s: next, t: o.hist[o.hist.length - 1].t + DEMO_MS[o.status] }); o.status = next; changed = true;
				}
			});
			if (changed) orders.save(all);
			return changed;
		},
	};

	/* ---------- loyalty ---------- */
	const profile = { get: () => store.get("profile", null), set: (p) => store.set("profile", p) };
	function pointsFor(phone) {
		const earned = orders.all().filter((o) => o.phone === phone && o.status !== "cancelled").reduce((s, o) => s + Math.floor(o.total / 10), 0);
		const spent = orders.all().filter((o) => o.phone === phone).reduce((s, o) => s + (o.redeem || 0), 0);
		return { earned, spent, balance: Math.max(0, earned - spent) };
	}
	const tierFor = (pts) => [...D.tiers].reverse().find((t) => pts >= t.min) || D.tiers[0];

	/* ---------- demo data (seeded once so the dashboards are never empty) ---------- */
	function seed() {
		if (store.get("seeded", false)) return;
		let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
		const names = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Isha", "Vihaan", "Anaya", "Arjun", "Sara", "Neel", "Tara"];
		const list = [], day = 864e5, now = Date.now();
		for (let d = 6; d >= 0; d--) {
			const n = 14 + Math.floor(r() * 12);
			for (let k = 0; k < n; k++) {
				const hr = 7 + Math.floor(r() * 14), ts = new Date(now - d * day).setHours(hr, Math.floor(r() * 60), 0, 0);
				if (ts > now) continue;
				const lines = []; for (let j = 0; j < 1 + Math.floor(r() * 3); j++) { const it = D.items[Math.floor(r() * D.items.length * 0.85)]; lines.push({ id: it.id, name: it.name, size: it.drink ? "Regular" : null, milk: it.drink && !it.noMilk ? "Whole milk" : null, extras: [], qty: 1 + Math.floor(r() * 2), unit: priceOf(it) + (it.drink ? 30 : 0) }); }
				const sub = lines.reduce((a, l) => a + l.unit * l.qty, 0), mode = r() > 0.3 ? "pickup" : r() > 0.5 ? "dinein" : "delivery";
				list.push({ id: "BB-D" + list.length, ts, mode, store: D.stores[Math.floor(r() * 3)].id, name: names[Math.floor(r() * names.length)], phone: "98" + Math.floor(10000000 + r() * 8e7), items: lines, sub, disc: 0, gst: sub * 0.05, fee: 0, tip: 0, total: Math.round(sub * 1.05), pay: "upi", status: "completed", hist: [{ s: "completed", t: ts }], seeded: true });
			}
		}
		orders.save(list);
		store.set("catering", [{ id: "CQ-101", ts: now - 2 * day, name: "Priya Menon", org: "Northwind Labs", pkg: "Coffee cart", guests: 60, date: new Date(now + 9 * day).toISOString().slice(0, 10), est: 11400, status: "new" }]);
		store.set("seeded", true);
	}

	/* ---------- UI helpers ---------- */
	function toast(msg) {
		let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
		t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2400);
	}
	function openNow(st, d = new Date()) {
		const h = st.hours[d.getDay()], x = d.getHours() + d.getMinutes() / 60;
		return x >= h[0] && x < h[1];
	}
	const fmtH = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60), ap = hh >= 12 ? "pm" : "am"; return ((hh + 11) % 12 + 1) + (mm ? ":" + String(mm).padStart(2, "0") : "") + ap; };
	const img = (k) => "img/" + k + ".jpg";

	const NAV = [["menu.html", "Menu"], ["order.html", "Order"], ["rewards.html", "Rewards"], ["catering.html", "Catering"], ["locations.html", "Visit"], ["about.html", "Our story"]];
	function layout(active) {
		const hdr = $("#site-header"), ftr = $("#site-footer");
		if (hdr) hdr.innerHTML = `<header class="hdr"><div class="hdr-in">
			<a class="logo" href="index.html">Brew<span>&amp;</span>Bean</a>
			<nav class="nav" id="nav">${NAV.map(([h, n]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>
			<a class="cart-btn" href="order.html" aria-label="Open your order">Bag <b data-cart-count hidden>0</b></a>
			<button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button>
		</div></header>`;
		if (ftr) ftr.innerHTML = `<footer class="ftr"><div class="wrap ftr-grid">
			<div><a class="logo" href="index.html">Brew<span>&amp;</span>Bean</a><p>Small-batch roasters and bakers in Delhi NCR since 2016.</p></div>
			<div><h4>Explore</h4>${NAV.map(([h, n]) => `<a href="${h}">${n}</a>`).join("")}</div>
			<div><h4>Visit</h4>${D.stores.map((s) => `<a href="locations.html#${s.id}">${esc(s.name)}</a>`).join("")}</div>
			<div><h4>Team</h4><a href="admin.html">Staff dashboard</a><a href="track.html">Track an order</a><a href="mailto:hello@brewandbean.example">hello@brewandbean.example</a></div>
		</div><div class="wrap ftr-fine"><span>© Brew &amp; Bean, a fictional café, built as a concept demo.</span><span>Photography: <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a></span></div></footer>`;
		const b = $("#burger"); if (b) b.onclick = () => { const o = $("#nav").classList.toggle("open"); b.setAttribute("aria-expanded", o); };
		badge();
	}

	seed();
	window.BB = { $, $$, inr, esc, store, item, priceOf, isAvail, cart, totals, orders, FLOW, LABEL, DEMO_MS, profile, pointsFor, tierFor, toast, openNow, fmtH, img, layout, badge, D };
})();
