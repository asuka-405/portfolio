/* Item customiser modal shared by the home and menu pages. */
(function () {
	const { $, esc, inr, item, priceOf, cart, toast, img, D } = BB;
	let m;
	function ensure() {
		if (m) return m;
		m = document.createElement("div"); m.className = "modal"; m.id = "item-modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
		m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) close(); });
		document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
		document.body.appendChild(m); return m;
	}
	function close() { if (m) m.classList.remove("on"); }
	function open(id) {
		const it = item(id); if (!it) return; ensure();
		const radios = (name, list, cur) => list.map((o, i) => `<label><input type="radio" name="${name}" value="${esc(o.n)}" ${i === cur ? "checked" : ""}><span>${esc(o.n)}${o.p ? " +₹" + o.p : ""}</span></label>`).join("");
		m.innerHTML = `<div class="mbox"><button class="mx" data-close aria-label="Close">✕</button><img src="${img(it.img)}" alt="${esc(it.name)}">
		<form class="mb" id="item-form"><div><h3 style="font-size:1.6rem">${esc(it.name)}</h3><p class="msg" style="margin-top:6px">${esc(it.desc)}</p>
		<div class="tagrow" style="margin-top:8px">${it.tags.map((t) => `<span class="chip ${t}">${{ veg: "Vegetarian", vegan: "Vegan", gf: "Gluten-free" }[t]}</span>`).join("")}${it.kcal ? `<span class="chip">${it.kcal} kcal</span>` : ""}</div></div>
		${it.drink ? `<fieldset style="border:0"><legend class="eyebrow" style="margin-bottom:6px">Size</legend><div class="opt">${radios("size", D.options.sizes, 1)}</div></fieldset>
		${it.noMilk ? "" : `<fieldset style="border:0"><legend class="eyebrow" style="margin-bottom:6px">Milk</legend><div class="opt">${radios("milk", D.options.milks, 0)}</div></fieldset>`}
		<fieldset style="border:0"><legend class="eyebrow" style="margin-bottom:6px">Extras</legend><div class="opt">${D.options.extras.map((o) => `<label><input type="checkbox" name="extra" value="${esc(o.n)}"><span>${esc(o.n)} +₹${o.p}</span></label>`).join("")}</div></fieldset>` : ""}
		<label class="f">Note for the kitchen<input class="in" name="note" maxlength="80" placeholder="e.g. extra hot, no sugar"></label>
		<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div class="qty"><button type="button" data-q="-1" aria-label="Fewer">−</button><b id="mq">1</b><button type="button" data-q="1" aria-label="More">+</button></div>
		<button class="btn dark" style="flex:1" id="madd">Add to bag · <span id="mp"></span></button></div></form></div>`;
		const f = $("#item-form", m); let q = 1;
		const line = () => ({ id, qty: q, size: it.drink ? f.size.value : null, milk: it.drink && !it.noMilk ? f.milk.value : null, extras: it.drink ? [...f.querySelectorAll("[name=extra]:checked")].map((x) => x.value) : [], note: f.note.value.trim() });
		const upd = () => { $("#mq", m).textContent = q; $("#mp", m).textContent = inr(cart.unit(line()) * q); };
		f.addEventListener("input", upd);
		f.addEventListener("click", (e) => { const d = e.target.dataset.q; if (d) { q = Math.max(1, Math.min(20, q + +d)); upd(); } });
		f.addEventListener("submit", (e) => { e.preventDefault(); cart.add(line()); close(); toast(it.name + " added to your bag"); });
		upd(); m.classList.add("on");
	}
	window.BBModal = { open, close };
})();
