/* Harbor & Co.: shared layer: listings engine, shortlist/compare, leads, helpers, layout. */
(function () {
	const D = window.HR_DATA;
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => [...r.querySelectorAll(s)];
	const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
	const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
	const store = { get(k, d) { try { const v = localStorage.getItem("hr-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("hr-" + k, JSON.stringify(v)); } catch (e) {} } };
	const img = (k) => "img/" + k + ".jpg";
	const pd = (s) => (typeof s === "string" ? new Date(s + "T00:00:00") : new Date(s));
	const iso = (d) => { const x = pd(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
	const addDays = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return x; };
	const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };

	/* ---------- listings ---------- */
	const over = () => store.get("over", {});
	const custom = () => store.get("custom", []);
	function listings() { const o = over(); return [...D.listings, ...custom()].map((l) => ({ ...l, ...(o[l.id] || {}) })); }
	const get = (id) => listings().find((l) => l.id === id);
	const fmtLakh = (v) => (v >= 100 ? "₹" + (v / 100).toFixed(2).replace(/\.?0+$/, "") + " Cr" : "₹" + v + " L");
	const price = (l) => (l.purpose === "rent" ? inr(l.price) + "/mo" : fmtLakh(l.price));
	const psf = (l) => (l.purpose === "sale" && l.area ? Math.round(l.price * 1e5 / l.area) : null);
	const nb = (l) => D.nb[l.city + "|" + l.loc] || { psf: 8000, g: 12, walk: 6, school: 7, transit: 6, safety: 8, blurb: "A well-regarded locality with steady demand." };
	function addView(id) { const v = store.get("views", {}); v[id] = (v[id] || 0) + 1; store.set("views", v); }
	const viewCount = (l) => 120 + (hash(l.id) % 900) + (store.get("views", {})[l.id] || 0);
	const emi = (P, rate, years) => { const r = rate / 1200, n = years * 12; return r ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n; };

	/* ---------- shortlist / compare / leads ---------- */
	const favs = { get: () => store.get("fav", []), has: (id) => favs.get().includes(id), toggle(id) { let l = favs.get(); l = l.includes(id) ? l.filter((x) => x !== id) : [...l, id]; store.set("fav", l); return l.includes(id); } };
	const cmp = { get: () => store.get("cmp", []), has: (id) => cmp.get().includes(id), toggle(id) { let l = cmp.get(); if (l.includes(id)) l = l.filter((x) => x !== id); else { if (l.length >= 3) return null; l = [...l, id]; } store.set("cmp", l); return l.includes(id); } };
	const leads = { get: () => store.get("leads", []), add(o) { const l = leads.get(); const n = { id: "LD-" + (500 + l.length + 1), ts: Date.now(), stage: "new", ...o }; l.push(n); store.set("leads", l); return n; }, save: (l) => store.set("leads", l) };

	/* ---------- ui ---------- */
	function card(l, opts = {}) {
		const f = favs.has(l.id), c = cmp.has(l.id), p = psf(l);
		return `<article class="prop ${opts.list ? "list" : ""}"><a class="pic" href="property.html?id=${l.id}"><img src="${img(l.imgs[0])}" alt="${esc(l.title)}" loading="lazy"><span class="tag">${l.purpose === "rent" ? "For rent" : l.type}</span>${l.status === "sold" ? '<span class="sold">Sold</span>' : l.featured ? '<span class="feat">Featured</span>' : ""}</a><button class="fav ${f ? "on" : ""}" data-fav="${l.id}" aria-label="Save to shortlist" aria-pressed="${f}">♥</button>
		<div class="pb"><div class="pr">${price(l)}${p ? ` <small>· ₹${p.toLocaleString("en-IN")}/sq ft</small>` : ""}</div><h3><a href="property.html?id=${l.id}">${esc(l.title)}</a></h3><div class="loc">${esc(l.loc)}, ${esc(l.city)}</div>
		<div class="specs">${l.beds ? `<span>🛏 ${l.beds} bed</span><span>🛁 ${l.baths} bath</span>` : `<span>${esc(l.type)}</span>`}<span>📐 ${l.area >= 43560 ? (l.area / 43560).toFixed(0) + " acre" : l.area.toLocaleString("en-IN") + " sq ft"}</span></div>
		<label class="cmp"><input type="checkbox" data-cmp="${l.id}" ${c ? "checked" : ""}> Compare</label></div></article>`;
	}
	function toast(msg) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2600); }
	function tray() {
		let t = $("#tray"); const ids = cmp.get();
		if (!t) { t = document.createElement("div"); t.id = "tray"; t.className = "tray"; document.body.appendChild(t); }
		t.hidden = !ids.length;
		t.innerHTML = `<span><b>${ids.length}</b> to compare</span><span class="th">${ids.map((id) => { const l = get(id); return l ? `<img src="${img(l.imgs[0])}" alt="${esc(l.title)}">` : ""; }).join("")}</span><a class="btn sm" href="compare.html">Compare${ids.length < 2 ? " (add one more)" : ""}</a><button class="btn sm ghost light" id="trayx">Clear</button>`;
		$("#trayx").onclick = () => { store.set("cmp", []); $$("[data-cmp]").forEach((x) => (x.checked = false)); tray(); };
	}
	function bind() { // heart + compare handlers for any page
		document.addEventListener("click", (e) => {
			const f = e.target.closest("[data-fav]"); if (!f) return;
			const on = favs.toggle(f.dataset.fav); f.classList.toggle("on", on); f.setAttribute("aria-pressed", on); toast(on ? "Saved to your shortlist" : "Removed from shortlist"); upd();
		});
		document.addEventListener("change", (e) => {
			const c = e.target.closest("[data-cmp]"); if (!c) return;
			const r = cmp.toggle(c.dataset.cmp); if (r === null) { c.checked = false; toast("You can compare up to 3 properties"); } tray();
		});
	}
	function upd() { $$("[data-fav-count]").forEach((e) => { const n = favs.get().length; e.textContent = n; e.hidden = !n; }); }
	const NAV = [["listings.html?purpose=sale", "Buy", "buy"], ["listings.html?purpose=rent", "Rent", "rent"], ["sell.html", "Sell", "sell"], ["emi.html", "Calculators", "emi"], ["neighbourhoods.html", "Neighbourhoods", "nb"], ["agents.html", "Agents", "agents"]];
	function layout(active) {
		const h = $("#site-header"), f = $("#site-footer");
		if (h) h.innerHTML = `<header class="hdr"><div class="hdr-in"><a class="logo" href="index.html">Harbor<b>&amp;</b>Co.</a><nav class="nav" id="nav">${NAV.map(([u, n, k]) => `<a href="${u}"${k === active ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>
			<a class="sl" href="shortlist.html">♥ Shortlist <b data-fav-count hidden>0</b></a><button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button></div></header>`;
		if (f) f.innerHTML = `<footer class="ftr"><div class="wrap ftr-grid"><div><a class="logo" href="index.html">Harbor<b>&amp;</b>Co.</a><p>Verified homes, plots and offices across Delhi NCR.</p><p>B-9, Sector 18, Noida · +91 120 400 9000</p></div>
			<div><h4>Properties</h4><a href="listings.html?purpose=sale">Buy</a><a href="listings.html?purpose=rent">Rent</a><a href="listings.html?type=Plot">Plots</a><a href="listings.html?type=Villa">Villas</a><a href="listings.html?type=Commercial">Commercial</a></div>
			<div><h4>Tools</h4><a href="emi.html">EMI &amp; affordability</a><a href="emi.html#duty">Stamp duty</a><a href="sell.html">Price estimator</a><a href="compare.html">Compare</a><a href="neighbourhoods.html">Neighbourhood guide</a></div>
			<div><h4>Company</h4><a href="agents.html">Our agents</a><a href="admin.html">Agent CRM</a><a href="mailto:hello@harborandco.example">hello@harborandco.example</a></div></div>
			<div class="wrap ftr-fine"><span>© Harbor &amp; Co., a fictional agency, built as a concept demo. Listings are sample data.</span><span>Photography: <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a></span></div></footer>`;
		const b = $("#burger"); if (b) b.onclick = () => { const o = $("#nav").classList.toggle("open"); b.setAttribute("aria-expanded", o); };
		upd(); bind();
	}
	/* simple generated floor plan */
	function floorplan(l) {
		if (!l.beds) return "";
		const n = l.beds, W = 360, H = 240, room = (x, y, w, h, t, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="#0f1e3a" stroke-width="2"/><text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="11" fill="#0f1e3a">${t}</text>`;
		let s = room(10, 10, 170, 110, "Living", "#f7f1e1") + room(180, 10, 80, 70, "Kitchen", "#e8eef7") + room(180, 80, 80, 40, "Dining", "#f3ece0") + room(260, 10, 90, 110, "Balcony", "#e6f1e6");
		const rooms = Math.min(n, 5), w = 340 / rooms;
		for (let i = 0; i < rooms; i++) s += room(10 + i * w, 120, w, 110, i === 0 ? "Master" : "Bed " + (i + 1), i === 0 ? "#fbeaea" : "#eef0fb");
		return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;background:#fff;border-radius:12px"><title>Indicative floor plan</title>${s}</svg>`;
	}
	window.HR = { D, $, $$, esc, inr, store, img, pd, iso, addDays, hash, listings, get, fmtLakh, price, psf, nb, addView, viewCount, emi, favs, cmp, leads, card, toast, tray, layout, floorplan, upd };
})();
