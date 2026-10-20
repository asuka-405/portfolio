/* Kiln & Clay: shared layer: catalogue, cart, wishlist, orders, workshops, layout. */
(function () {
	const D = window.KC_DATA;
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => [...r.querySelectorAll(s)];
	const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
	const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
	const store = { get(k, d) { try { const v = localStorage.getItem("kc-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("kc-" + k, JSON.stringify(v)); } catch (e) {} } };
	const img = (k) => "img/" + k + ".jpg";
	const pd = (s) => (typeof s === "string" ? new Date(s + "T00:00:00") : new Date(s));
	const iso = (d) => { const x = pd(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
	const addDays = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return x; };
	const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };

	/* ---------- catalogue ---------- */
	function products() { const ov = store.get("over", {}); return [...D.products, ...store.get("custom", [])].map((p) => ({ ...p, ...(ov[p.id] || {}) })); }
	const get = (id) => products().find((p) => p.id === id);
	const stockOf = (p) => p.stock;

	/* ---------- cart ---------- */
	const cart = {
		get: () => store.get("cart", []),
		save(c) { store.set("cart", c); badge(); },
		unit(l) { const p = get(l.id); if (!p) return 0; const s = p.sets && p.sets[l.set || 0]; return s ? Math.round(p.price * s[1] * (1 - s[2] / 100)) : p.price; },
		pieces(l) { const p = get(l.id), s = p && p.sets && p.sets[l.set || 0]; return (s ? s[1] : 1) * l.qty; },
		add(id, set = 0, qty = 1) {
			const p = get(id); if (!p || p.stock <= 0) return { ok: false, msg: "Sorry, that piece is sold out." };
			const c = cart.get(), ex = c.find((l) => l.id === id && (l.set || 0) === set), have = c.filter((l) => l.id === id).reduce((a, l) => a + cart.pieces(l), 0), need = (p.sets && p.sets[set] ? p.sets[set][1] : 1) * qty;
			if (have + need > p.stock) return { ok: false, msg: "Only " + p.stock + " left in stock." };
			if (ex) ex.qty += qty; else c.push({ id, set, qty }); cart.save(c); return { ok: true };
		},
		setQty(i, q) { const c = cart.get(); if (q <= 0) c.splice(i, 1); else { const p = get(c[i].id), per = p.sets && p.sets[c[i].set || 0] ? p.sets[c[i].set || 0][1] : 1; c[i].qty = Math.min(q, Math.max(1, Math.floor(p.stock / per))); } cart.save(c); },
		clear() { cart.save([]); },
		count: () => cart.get().reduce((s, l) => s + l.qty, 0),
		sub: () => cart.get().reduce((s, l) => s + cart.unit(l) * l.qty, 0),
	};
	function badge() { $$("[data-cart-count]").forEach((e) => { const n = cart.count(); e.textContent = n; e.hidden = !n; }); $$("[data-wish-count]").forEach((e) => { const n = wish.get().length; e.textContent = n; e.hidden = !n; }); }
	const wish = { get: () => store.get("wish", []), has: (id) => wish.get().includes(id), toggle(id) { let l = wish.get(); l = l.includes(id) ? l.filter((x) => x !== id) : [...l, id]; store.set("wish", l); badge(); return l.includes(id); } };

	function totals(lines, o = {}) {
		const sub = lines.reduce((s, l) => s + cart.unit(l) * l.qty, 0), cp = o.coupon && D.coupons[o.coupon];
		let disc = 0, msg = "", freeShip = false;
		if (o.coupon && !cp) msg = "That code isn't valid.";
		if (cp) { if (cp.min && sub < cp.min) msg = "Spend " + inr(cp.min - sub) + " more to use this code."; else { if (cp.pct) disc = Math.round(sub * cp.pct / 100); if (cp.ship) freeShip = true; } }
		const after = sub - disc, std = after >= 2000 || freeShip || sub === 0 ? 0 : 99, ship = o.ship === "exp" ? 249 : std, wrap = o.wrap ? 99 : 0;
		return { sub, disc, msg, ship, wrap, total: after + ship + wrap, gst: Math.round((after + wrap) * 12 / 112), toFree: Math.max(0, 2000 - after) };
	}
	function eta(pin, exp) { const f = pin[0], metro = ["1", "4", "5", "6"].includes(f); const lo = (metro ? 2 : 4) - (exp ? 1 : 0), hi = (metro ? 4 : 7) - (exp ? 2 : 0), a = addDays(new Date(), lo + 2), b = addDays(new Date(), hi + 2); const fm = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); return fm(a) + " – " + fm(b); }

	/* ---------- orders ---------- */
	const STAGES = ["placed", "packed", "shipped", "out", "delivered"], LABEL = { placed: "Order placed", packed: "Packed", shipped: "Shipped", out: "Out for delivery", delivered: "Delivered" }, STEP_MS = { placed: 30000, packed: 45000, shipped: 60000, out: 60000 };
	const orders = {
		all: () => store.get("orders", []), save: (o) => store.set("orders", o), get: (id) => orders.all().find((o) => o.id === id),
		create(o) { const a = orders.all(); o.id = "KC-" + (20400 + a.length + 1); o.ts = Date.now(); o.status = "placed"; o.hist = [{ s: "placed", t: o.ts }]; a.push(o); orders.save(a);
			const ov = store.get("over", {}); o.items.forEach((i) => { const p = get(i.id); if (p) { ov[i.id] = { ...(ov[i.id] || {}), stock: Math.max(0, p.stock - i.pieces) }; } }); store.set("over", ov); return o; },
		advance(id, to) { const a = orders.all(), o = a.find((x) => x.id === id); if (!o) return; const i = STAGES.indexOf(o.status), n = to || STAGES[Math.min(4, i + 1)]; if (n !== o.status) { o.status = n; o.hist.push({ s: n, t: Date.now() }); orders.save(a); } },
		tick() { let ch = false; const a = orders.all(), now = Date.now(); a.forEach((o) => { if (o.seeded || !store.get("auto", true)) return; while (o.status !== "delivered" && now - o.hist[o.hist.length - 1].t >= STEP_MS[o.status]) { const t = o.hist[o.hist.length - 1].t + STEP_MS[o.status]; o.status = STAGES[STAGES.indexOf(o.status) + 1]; o.hist.push({ s: o.status, t }); ch = true; } }); if (ch) orders.save(a); },
	};
	function seed() {
		if (store.get("seeded", false)) return; let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647), names = ["Aarav Singh", "Diya Mehra", "Kabir Anand", "Meera Joshi", "Rohan Das", "Isha Kapoor", "Neel Shah", "Tara Nair"], cities = ["Mumbai", "Bengaluru", "Delhi", "Pune", "Hyderabad", "Jaipur"], list = [], now = Date.now(), P = D.products;
		for (let d = 13; d >= 0; d--) { const n = 2 + Math.floor(r() * 5); for (let k = 0; k < n; k++) { const items = []; for (let j = 0; j < 1 + Math.floor(r() * 3); j++) { const p = P[Math.floor(r() * P.length)]; items.push({ id: p.id, name: p.name, set: 0, qty: 1, unit: p.price, pieces: 1 }); } const sub = items.reduce((a, i) => a + i.unit * i.qty, 0), ts = now - d * 864e5 - Math.floor(r() * 5e7), nm = names[Math.floor(r() * names.length)]; list.push({ id: "KC-D" + list.length, ts, name: nm, email: nm.split(" ")[0].toLowerCase() + "@example.com", city: cities[Math.floor(r() * cities.length)], items, sub, ship: sub > 2000 ? 0 : 99, total: sub + (sub > 2000 ? 0 : 99), status: d > 5 ? "delivered" : d > 3 ? "shipped" : d > 1 ? "packed" : "placed", hist: [{ s: "placed", t: ts }], seeded: true, pay: "upi" }); } }
		orders.save(list); store.set("seeded", true);
	}

	/* ---------- workshops ---------- */
	function sessions(w, weeks = 5) { const out = []; for (let i = 1; i <= weeks * 7; i++) { const d = addDays(new Date(), i); if (w.days.includes(d.getDay())) { const id = w.id + "|" + iso(d), taken = Math.min(w.cap, Math.floor(w.cap * 0.25) + (hash(id) % Math.ceil(w.cap * 0.7))); out.push({ id, w, date: iso(d), time: w.time, taken, taken0: taken }); } } return out; }
	const wbook = { get: () => store.get("wbook", []), add(b) { const l = wbook.get(); b.id = "WS-" + (300 + l.length + 1); b.ts = Date.now(); l.push(b); store.set("wbook", l); return b; } };

	function toast(msg) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2600); }
	function card(p) {
		const out = p.stock <= 0, low = p.stock > 0 && p.stock <= 5, w = wish.has(p.id), from = p.sets ? "" : "";
		return `<article class="p"><a class="ph" href="product.html?id=${p.id}"><img src="${img(p.img)}" alt="${esc(p.name)}" loading="lazy">${out ? '<span class="badge out">Sold out</span>' : low ? `<span class="badge low">Only ${p.stock} left</span>` : ""}</a><button class="wish ${w ? "on" : ""}" data-wish="${p.id}" aria-label="Add to wishlist" aria-pressed="${w}">♥</button><div class="pi"><a href="product.html?id=${p.id}"><h3>${esc(p.name)}</h3></a><span class="cat">${esc(p.cat)}</span><b>${inr(p.price)}${p.sets ? " <small>each</small>" : ""}</b></div></article>`;
	}
	const NAV = [["shop.html", "Shop"], ["collections.html", "Collections"], ["workshops.html", "Workshops"], ["story.html", "Our studio"], ["journal.html", "Journal"], ["wholesale.html", "Trade"]];
	function layout(active) {
		const h = $("#site-header"), f = $("#site-footer");
		if (h) h.innerHTML = `<div class="top">Free shipping over ₹2,000 · Use <b>WELCOME10</b> for 10% off your first order</div><header class="hdr"><div class="hdr-in"><a class="logo" href="index.html">Kiln<i>&amp;</i>Clay</a>
			<nav class="nav" id="nav">${NAV.map(([u, n]) => `<a href="${u}"${u === active ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>
			<form class="srch" id="srch" role="search"><input type="search" placeholder="Search pieces…" aria-label="Search" name="q"></form>
			<a class="ic" href="wishlist.html" aria-label="Wishlist">♡<b data-wish-count hidden>0</b></a><a class="ic" href="account.html" aria-label="Account">☺</a><a class="ic bag" href="cart.html" aria-label="Bag">Bag<b data-cart-count hidden>0</b></a>
			<button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button></div></header>`;
		if (f) f.innerHTML = `<footer class="ftr"><div class="wrap ftr-grid"><div><a class="logo" href="index.html">Kiln<i>&amp;</i>Clay</a><p>Handmade stoneware from our studio in Jaipur. Thrown, glazed and fired by seven potters.</p></div>
			<div><h4>Shop</h4>${D.cats.slice(0, 6).map((c) => `<a href="shop.html?cat=${encodeURIComponent(c)}">${c}</a>`).join("")}</div>
			<div><h4>Studio</h4><a href="workshops.html">Workshops</a><a href="story.html">Our story</a><a href="journal.html">Journal</a><a href="wholesale.html">Trade &amp; wholesale</a></div>
			<div><h4>Help</h4><a href="care.html">Care &amp; shipping</a><a href="order.html">Track an order</a><a href="account.html">My account</a><a href="admin.html">Studio dashboard</a></div></div>
			<div class="wrap ftr-fine"><span>© Kiln &amp; Clay, a fictional studio, built as a concept demo. No payments are taken.</span><span>Photography: <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a></span></div></footer>`;
		const b = $("#burger"); if (b) b.onclick = () => { const o = $("#nav").classList.toggle("open"); b.setAttribute("aria-expanded", o); };
		const sf = $("#srch"); if (sf) sf.onsubmit = (e) => { e.preventDefault(); location.href = "shop.html?q=" + encodeURIComponent(sf.q.value); };
		badge(); orders.tick();
		document.addEventListener("click", (e) => { const w = e.target.closest("[data-wish]"); if (!w) return; const on = wish.toggle(w.dataset.wish); w.classList.toggle("on", on); w.setAttribute("aria-pressed", on); toast(on ? "Saved to your wishlist" : "Removed from wishlist"); });
	}
	seed();
	window.KC = { D, $, $$, inr, esc, store, img, pd, iso, addDays, hash, products, get, cart, wish, totals, eta, orders, STAGES, LABEL, STEP_MS, sessions, wbook, toast, card, layout, badge };
})();
