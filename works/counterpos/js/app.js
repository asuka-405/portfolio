/* CounterPOS: retail billing app (concept build). All data lives in localStorage. */
(function () {
	const { $, $$, esc, inr, inrc, num, iso, addDays, fdate, hash, rng, store: mk, toast, modal, confirmBox, csv, line, bars, hbars, donut, router, table, kpi, chip, field, form, vals, tabsHtml } = Object.assign({}, UI);
	const S = mk("cp-"), day = 864e5, V = {};
	const CATS = ["Grocery", "Dairy", "Snacks", "Beverages", "Medicines", "Personal care", "Stationery", "Household"];
	const MODES = { cash: "Cash", upi: "UPI", card: "Card", credit: "Khata" };
	const MC = { cash: "#16a34a", upi: "#ea580c", card: "#6366f1", credit: "#f59e0b" };

	function calc(lines, disc) {
		const sub = lines.reduce((a, l) => a + l.qty * l.price, 0), d = Math.min(+disc || 0, sub), net = sub - d, f = sub ? net / sub : 1, by = {}; let tax = 0;
		lines.forEach((l) => { const g = l.qty * l.price * f, t = g / (1 + l.gst / 100); by[l.gst] = by[l.gst] || { tx: 0, gst: 0 }; by[l.gst].tx += t; by[l.gst].gst += g - t; tax += g - t; });
		const total = Math.round(net); return { sub, disc: d, net, round: total - net, total, tax, by };
	}

	function seed() {
		if (S.get("seeded", false)) return;
		const P = [["Basmati Rice (loose)", "Grocery", 98, 0, "kg", 140, 1], ["Sona Masoori Rice (loose)", "Grocery", 62, 0, "kg", 220, 1], ["Toor Dal (loose)", "Grocery", 150, 0, "kg", 60, 1], ["Moong Dal (loose)", "Grocery", 130, 0, "kg", 44, 1], ["Chana Dal (loose)", "Grocery", 98, 0, "kg", 52, 1], ["Sugar (loose)", "Grocery", 46, 0, "kg", 90, 1], ["Atta 5kg", "Grocery", 245, 0, "pc", 38], ["Sunflower Oil 1L", "Grocery", 148, 5, "pc", 41], ["Mustard Oil 1L", "Grocery", 172, 5, "pc", 22], ["Iodised Salt 1kg", "Grocery", 25, 0, "pc", 60], ["Turmeric Powder 100g", "Grocery", 38, 5, "pc", 30], ["Red Chilli Powder 100g", "Grocery", 52, 5, "pc", 26], ["Tea Leaves 250g", "Grocery", 135, 5, "pc", 24], ["Poha 500g", "Grocery", 48, 5, "pc", 33],
			["Milk 500ml", "Dairy", 33, 0, "pc", 70], ["Curd 400g", "Dairy", 40, 0, "pc", 28], ["Paneer 200g", "Dairy", 90, 5, "pc", 12], ["Butter 100g", "Dairy", 58, 5, "pc", 16], ["Cheese Slices 200g", "Dairy", 140, 5, "pc", 9], ["Eggs (6)", "Dairy", 54, 0, "pc", 20],
			["Potato Chips 52g", "Snacks", 20, 18, "pc", 80], ["Bhujia 200g", "Snacks", 60, 5, "pc", 34], ["Glucose Biscuits 100g", "Snacks", 10, 18, "pc", 120], ["Cream Biscuits 120g", "Snacks", 30, 18, "pc", 64], ["Instant Noodles 70g", "Snacks", 14, 18, "pc", 150], ["Chocolate Bar 40g", "Snacks", 45, 18, "pc", 44], ["Salted Peanuts 200g", "Snacks", 55, 5, "pc", 21],
			["Cola 750ml", "Beverages", 40, 40, "pc", 48], ["Packaged Water 1L", "Beverages", 20, 18, "pc", 96], ["Mango Juice 1L", "Beverages", 99, 5, "pc", 18], ["Tea Bags (25)", "Beverages", 120, 5, "pc", 14], ["Instant Coffee 50g", "Beverages", 160, 18, "pc", 11],
			["Paracetamol 500mg (strip)", "Medicines", 22, 5, "pc", 60], ["Cough Syrup 100ml", "Medicines", 95, 5, "pc", 14], ["ORS Sachet", "Medicines", 21, 5, "pc", 45], ["Antacid (strip)", "Medicines", 38, 5, "pc", 30], ["Antiseptic Liquid 100ml", "Medicines", 98, 18, "pc", 12], ["Vitamin C Tablets", "Medicines", 62, 5, "pc", 18], ["Digital Thermometer", "Medicines", 180, 18, "pc", 6],
			["Bath Soap 100g", "Personal care", 38, 18, "pc", 70], ["Shampoo 180ml", "Personal care", 125, 18, "pc", 20], ["Toothpaste 100g", "Personal care", 65, 18, "pc", 42], ["Toothbrush", "Personal care", 30, 18, "pc", 38], ["Hair Oil 100ml", "Personal care", 85, 18, "pc", 24], ["Face Wash 50g", "Personal care", 110, 18, "pc", 15],
			["Notebook 172 pages", "Stationery", 52, 0, "pc", 60], ["Ball Pen", "Stationery", 10, 18, "pc", 200], ["Gel Pen Pack (5)", "Stationery", 60, 18, "pc", 35], ["Glue Stick", "Stationery", 30, 18, "pc", 28], ["A4 Paper (50 sheets)", "Stationery", 85, 18, "pc", 17],
			["Detergent Powder 1kg", "Household", 110, 18, "pc", 32], ["Dishwash Bar", "Household", 10, 18, "pc", 90], ["Floor Cleaner 500ml", "Household", 85, 18, "pc", 20], ["Agarbatti", "Household", 25, 5, "pc", 55], ["Matchbox (10)", "Household", 20, 5, "pc", 40], ["Garbage Bags (30)", "Household", 90, 18, "pc", 16]];
		const items = P.map((r, i) => ({ id: "i" + (i + 1), name: r[0], cat: r[1], price: r[2], gst: r[3], unit: r[4], stock: r[5], loose: !!r[6], reorder: r[6] ? 25 : 10, cost: Math.round(r[2] * (0.74 + (hash(r[0]) % 12) / 100)), barcode: "890" + String(1e9 + (hash(r[0]) % 9e9)) }));
		const C = [["Sunita Aggarwal", "9810123401", 5000], ["Ramesh Tyagi", "9810123402", 3000], ["Pooja Sethi", "9810123403", 2000], ["Mohan Lal", "9810123404", 4000], ["Neelam Kaur", "9810123405", 2500], ["Dr. Anil Bhatia", "9810123406", 6000], ["Geeta Devi", "9810123407", 1500], ["Harish Chandra", "9810123408", 3000], ["Kavita Rao", "9810123409", 2000], ["Imran Qureshi", "9810123410", 2500], ["Shalini Mathur", "9810123411", 2000], ["Vinod Pandey", "9810123412", 3500]].map((c, i) => ({ id: "c" + (i + 1), name: c[0], phone: c[1], limit: c[2], ledger: [] }));
		const R = rng(7), bills = [], now = new Date();
		for (let d = 13; d >= 0; d--) {
			const n = d === 0 ? 8 : 15 + Math.floor(R() * 12);
			for (let k = 0; k < n; k++) {
				const start = new Date(now); start.setHours(0, 0, 0, 0); const hrs = d === 0 ? Math.max(1, Math.min(12, now.getHours() - 8)) : 13, ts = start.getTime() - d * day + (8 + Math.floor(R() * hrs)) * 36e5 + Math.floor(R() * 36e5);
				const lines = []; for (let j = 0, m = 1 + Math.floor(R() * 5); j < m; j++) { const it = items[Math.floor(R() * R() * items.length * 0.5 + R() * items.length * 0.5)]; if (lines.find((l) => l.id === it.id)) continue; lines.push({ id: it.id, name: it.name, qty: it.loose ? [0.5, 1, 1.5, 2][Math.floor(R() * 4)] : 1 + Math.floor(R() * R() * 3), price: it.price, gst: it.gst, unit: it.unit }); }
				const c = calc(lines, 0), r = R(), mode = r < 0.4 ? "cash" : r < 0.87 ? "upi" : r < 0.93 ? "card" : "credit", cu = mode === "credit" || R() < 0.15 ? C[Math.floor(R() * C.length)] : null;
				bills.push({ ts, cust: cu ? cu.id : null, lines, disc: 0, total: c.total, tax: c.tax, by: c.by, pays: [{ mode: mode === "credit" && !cu ? "cash" : mode, amt: c.total }], type: "sale" });
			}
		}
		bills.sort((a, b) => a.ts - b.ts).forEach((b, i) => { b.no = "B" + (1001 + i); if (b.pays[0].mode === "credit") C.find((c) => c.id === b.cust).ledger.push({ ts: b.ts, type: "sale", amt: b.total, ref: b.no }); });
		C.forEach((c) => { const bal = c.ledger.reduce((a, e) => a + e.amt, 0); if (bal > 300 && R() < 0.65) c.ledger.push({ ts: now.getTime() - Math.floor(R() * 6) * day - 36e5, type: "pay", amt: Math.round(bal * (0.3 + R() * 0.4) / 10) * 10, ref: "UPI" }); c.ledger.sort((a, b) => a.ts - b.ts); });
		S.set("items", items); S.set("customers", C); S.set("bills", bills); S.set("held", []); S.set("closes", [{ date: iso(addDays(now, -1)), opening: 2000, expected: 7840, counted: 7830, by: "Owner" }]);
		S.set("settings", { biz: "Gupta Provision & Medical Store", addr: "Shop 14, Sector 62 Market, Noida", gstin: "09ABCDE1234F1Z5", upi: "guptastore@upi", footer: "Thank you. Visit again!", width: 80 }); S.set("seeded", true);
	}
	seed();
	const items = () => S.get("items", []), custs = () => S.get("customers", []), bills = () => S.get("bills", []), set = () => S.get("settings", {});
	const cust = (id) => custs().find((c) => c.id === id), bal = (c) => c.ledger.reduce((a, e) => a + (e.type === "sale" ? e.amt : -e.amt), 0);
	const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
	const inRange = (b, days) => b.ts >= sod(Date.now()) - (days - 1) * day;
	const qtyFmt = (l) => (l.unit === "kg" ? l.qty + " kg" : l.qty);

	/* ---------- receipt ---------- */
	function receipt(b) {
		const s = set(), c = b.cust && cust(b.cust), w = +s.width === 58 ? "250px" : "330px", ret = b.type === "return";
		return `<div style="width:${w};max-width:100%;margin:auto;font:12.5px/1.5 ui-monospace,Menlo,monospace;color:#111;background:#fff;padding:14px;border:1px dashed #bbb"><div style="text-align:center"><b style="font-size:1.08em">${esc(s.biz)}</b><br>${esc(s.addr)}<br>GSTIN ${esc(s.gstin)}<br><b>${ret ? "CREDIT NOTE" : "TAX INVOICE"}</b></div><hr style="border:0;border-top:1px dashed #999;margin:8px 0">${b.no} <span style="float:right">${new Date(b.ts).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>${c ? `<br>Customer: ${esc(c.name)}` : ""}<hr style="border:0;border-top:1px dashed #999;margin:8px 0"><table style="width:100%;font:inherit;border-collapse:collapse">${b.lines.map((l) => `<tr><td colspan="2" style="border:0;padding:0">${esc(l.name)}</td></tr><tr><td style="border:0;padding:0 0 3px">${qtyFmt(l)} x ${l.price}</td><td style="border:0;padding:0 0 3px;text-align:right">${(l.qty * l.price).toFixed(2)}</td></tr>`).join("")}</table><hr style="border:0;border-top:1px dashed #999;margin:8px 0">${b.disc ? `Discount <span style="float:right">-${b.disc.toFixed(2)}</span><br>` : ""}<b>TOTAL <span style="float:right">${inr(Math.abs(b.total))}</span></b><br><span style="font-size:.9em">Incl. GST ${b.tax.toFixed(2)} (${Object.keys(b.by).map((k) => k + "%").join(", ")})</span><br>${b.pays.map((p) => `${MODES[p.mode]} <span style="float:right">${p.amt.toFixed(2)}</span>`).join("<br>")}<hr style="border:0;border-top:1px dashed #999;margin:8px 0"><div style="text-align:center;font-size:.9em">${UI.words(Math.abs(b.total))}<br>${esc(s.footer)}</div></div>`;
	}
	function showReceipt(b, extra) {
		const c = b.cust && cust(b.cust);
		modal({ title: "Bill " + b.no, body: receipt(b), actions: [{ label: "Close" }, ...(c ? [{ label: "WhatsApp", fn: () => { window.open(UI.wa(c.phone, `Hi ${c.name.split(" ")[0]}, thanks for shopping at ${set().biz}. Your bill ${b.no} is ${inr(Math.abs(b.total))}.`), "_blank"); return false; } }] : []), { label: "Print", fn: () => { UI.print(receipt(b), b.no); return false; } }, ...(extra ? [{ label: extra.label, cls: "pri", fn: extra.fn }] : [])] });
	}

	/* ---------- billing ---------- */
	let POS = { lines: [], cust: "", disc: 0, pct: false, q: "", cat: "" };
	const discAmt = () => (POS.pct ? (POS.lines.reduce((a, l) => a + l.qty * l.price, 0) * (+POS.disc || 0)) / 100 : +POS.disc || 0);
	function addLine(it, q) {
		const step = it.loose ? 0.5 : 1, l = POS.lines.find((x) => x.id === it.id);
		if (l) l.qty = Math.round((l.qty + (q || step)) * 100) / 100; else POS.lines.push({ id: it.id, name: it.name, qty: q || step, price: it.price, gst: it.gst, unit: it.unit });
		cart();
	}
	function grid() {
		const q = POS.q.toLowerCase(), l = items().filter((i) => (!POS.cat || i.cat === POS.cat) && (!q || (i.name + i.barcode).toLowerCase().includes(q)));
		$("#pg").innerHTML = l.slice(0, 40).map((i) => `<button class="pcard" data-add="${i.id}" ${i.stock <= 0 ? 'style="opacity:.5"' : ""}><b>${esc(i.name)}</b><span>${inr(i.price)}${i.loose ? "/kg" : ""}</span><small class="${i.stock <= i.reorder ? "dn" : "mut"}">${i.stock <= 0 ? "Out of stock" : i.stock + " " + i.unit}</small></button>`).join("") || '<p class="empty">No item found. Check the spelling or scan again.</p>';
	}
	function cart() {
		const c = calc(POS.lines, discAmt()), cu = POS.cust && cust(POS.cust);
		$("#cartb").innerHTML = (POS.lines.length ? POS.lines.map((l, i) => `<div class="cl"><div><b>${esc(l.name)}</b><div class="mut">${inr(l.price)}${l.unit === "kg" ? " / kg" : ""} · GST ${l.gst}%</div></div><div class="q"><button data-q="${i}|-1">−</button><input type="number" step="${l.unit === "kg" ? 0.25 : 1}" min="0" value="${l.qty}" data-qi="${i}" aria-label="Quantity"><button data-q="${i}|1">+</button></div><b class="amt">${inr(l.qty * l.price)}</b><button class="x" data-rm="${i}" aria-label="Remove">✕</button></div>`).join("") : '<p class="empty">Scan a barcode or tap an item to start the bill.</p>')
			+ `<div class="tot"><div class="row sb"><span>Subtotal</span><span>${inr(c.sub)}</span></div><div class="row sb"><span class="row">Discount <input class="in" id="dv" type="number" min="0" value="${POS.disc || ""}" placeholder="0" style="width:74px;padding:4px 8px"><button class="btn sm" id="dt">${POS.pct ? "%" : "₹"}</button></span><span>${c.disc ? "-" + inr(c.disc) : "-"}</span></div><div class="row sb mut"><span>Incl. GST</span><span>${inr(c.tax)}</span></div>${Math.abs(c.round) > 0.004 ? `<div class="row sb mut"><span>Round off</span><span>${c.round > 0 ? "+" : ""}${c.round.toFixed(2)}</span></div>` : ""}<div class="row sb" style="font-size:1.5rem;font-weight:800;margin-top:6px"><span>Total</span><span>${inr(c.total)}</span></div></div>`;
		$("#cust").value = POS.cust; $("#custinfo").innerHTML = cu ? `Khata balance <b class="${bal(cu) > 0 ? "dn" : ""}">${inr(bal(cu))}</b> of ${inr(cu.limit)} limit` : "Walk-in customer";
		$("#payb").textContent = "Pay " + inr(c.total) + "  (F9)"; $("#payb").disabled = !POS.lines.length;
		$("#heldn").textContent = S.get("held", []).length || "";
	}
	V.sell = (c) => {
		c.innerHTML = `<style>.pos{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(330px,1fr);gap:16px;align-items:start}.pg{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:12px}.pcard{display:grid;gap:3px;text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:11px 12px;min-height:84px;align-content:space-between}.pcard:hover{border-color:var(--acc);transform:translateY(-1px)}.pcard b{font-size:.86rem;line-height:1.25}.pcard span{font-weight:800;color:var(--acc)}.cl{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)}.q{display:flex;align-items:center;border:1px solid var(--line);border-radius:9px;overflow:hidden}.q button{border:0;background:none;width:28px;height:30px}.q input{width:54px;border:0;text-align:center;background:none;color:var(--ink);font:inherit;font-weight:700;padding:0}.amt{min-width:64px;text-align:right}.x{border:0;background:none;color:var(--mut)}.tot{margin-top:12px;display:grid;gap:5px}@media(max-width:980px){.pos{grid-template-columns:minmax(0,1fr)}}</style>
		<div class="pos"><div><div class="row"><input class="in" id="q" placeholder="Scan barcode or type item name, press Enter  (F2)" style="flex:1;min-width:200px" autocomplete="off"><div class="tabs" id="cats"><button data-cat="" class="on">All</button>${CATS.map((k) => `<button data-cat="${k}">${k}</button>`).join("")}</div></div><div class="pg" id="pg"></div></div>
		<div class="card" style="position:sticky;top:78px"><h3>Current bill <span class="row"><button class="btn sm" id="hold">Hold <span id="heldn" class="chip warn" style="padding:0 7px"></span></button><button class="btn sm danger" id="clr">Clear</button></span></h3><div class="row" style="margin-bottom:8px"><select class="in" id="cust" style="flex:1" aria-label="Customer"><option value="">Walk-in customer</option>${custs().map((k) => `<option value="${k.id}">${esc(k.name)}${bal(k) > 0 ? " (owes " + inr(bal(k)) + ")" : ""}</option>`).join("")}</select></div><div class="mut" id="custinfo" style="margin-bottom:6px;font-size:.82rem"></div><div id="cartb"></div><button class="btn pri" id="payb" style="width:100%;margin-top:12px;padding:13px;font-size:1rem">Pay</button></div></div>`;
		$("#q").value = POS.q; $$("#cats button").forEach((b) => b.classList.toggle("on", b.dataset.cat === POS.cat)); grid(); cart();
		$("#q").oninput = (e) => { POS.q = e.target.value; grid(); };
		$("#q").onkeydown = (e) => { if (e.key !== "Enter") return; const v = e.target.value.trim(); if (!v) return; const all = items(), it = all.find((i) => i.barcode === v) || (all.filter((i) => i.name.toLowerCase().includes(v.toLowerCase())).length === 1 ? all.find((i) => i.name.toLowerCase().includes(v.toLowerCase())) : null) || all.find((i) => i.name.toLowerCase().includes(v.toLowerCase())); if (!it) return toast("No item matches “" + v + "”"); addLine(it); POS.q = ""; e.target.value = ""; grid(); };
		$("#cust").onchange = (e) => { POS.cust = e.target.value; cart(); };
		$("#clr").onclick = () => { POS = { lines: [], cust: "", disc: 0, pct: false, q: "", cat: POS.cat }; V.sell($("#view")); };
		$("#hold").onclick = () => { if (POS.lines.length) { const h = S.get("held", []); h.push({ ...POS, at: Date.now() }); S.set("held", h); POS = { lines: [], cust: "", disc: 0, pct: false, q: "", cat: POS.cat }; toast("Bill held"); V.sell($("#view")); } else heldList(); };
		$("#payb").onclick = pay;
	};
	function heldList() {
		const h = S.get("held", []); if (!h.length) return toast("No held bills");
		modal({ title: "Held bills", body: h.map((b, i) => `<div class="row sb" style="padding:8px 0;border-bottom:1px solid var(--line)"><div><b>${b.lines.length} items · ${inr(calc(b.lines, b.disc).total)}</b><div class="mut">${UI.ago(b.at)}${b.cust ? " · " + esc(cust(b.cust).name) : ""}</div></div><button class="btn sm pri" data-resume="${i}">Resume</button></div>`).join("") });
		$("#modal-bg").addEventListener("click", (e) => { const b = e.target.closest("[data-resume]"); if (!b) return; const hh = S.get("held", []), [x] = hh.splice(+b.dataset.resume, 1); S.set("held", hh); POS = x; UI.close(); V.sell($("#view")); }, { once: true });
	}
	function pay() {
		const c = calc(POS.lines, discAmt()); if (!POS.lines.length) return toast("Add items first"); const cu = POS.cust && cust(POS.cust), s = set(); let mode = "cash", tender = c.total, splitCash = Math.round(c.total / 2);
		const draw = () => {
			const b = $("#pb"); $$("#pm button").forEach((x) => x.classList.toggle("on", x.dataset.m === mode));
			if (mode === "cash") b.innerHTML = `<label class="f">Cash received<input class="in" id="tn" type="number" value="${tender}" style="font-size:1.4rem;font-weight:800"></label><div class="row" style="margin:10px 0">${[c.total, 100, 200, 500, 2000].map((v, i) => `<button class="btn sm" data-tq="${v}">${i ? "+" + v : "Exact"}</button>`).join("")}</div><div class="note" id="chg"></div>`;
			else if (mode === "upi") b.innerHTML = `<div class="row" style="gap:20px;align-items:flex-start"><div id="qrb" style="background:#fff;padding:10px;border-radius:10px"></div><div><b style="font-size:1.4rem">${inr(c.total)}</b><p class="mut" style="margin:6px 0 10px">Ask the customer to scan with any UPI app. Tap Complete when the payment shows on your phone.</p><div class="mut">Pay to <b>${esc(s.upi)}</b></div></div></div>`;
			else if (mode === "card") b.innerHTML = `<label class="f">Card slip / reference (optional)<input class="in" id="cref" placeholder="Last 4 digits or approval code"></label>`;
			else if (mode === "credit") b.innerHTML = cu ? `<div class="note">Add <b>${inr(c.total)}</b> to <b>${esc(cu.name)}</b>'s khata. New balance <b>${inr(bal(cu) + c.total)}</b> of ${inr(cu.limit)} limit.${bal(cu) + c.total > cu.limit ? ' <b class="dn">Over limit.</b>' : ""}</div>` : '<div class="note">Select a customer on the bill first to sell on credit.</div>';
			else b.innerHTML = `<div class="row2"><label class="f">Cash<input class="in" id="sc" type="number" value="${splitCash}"></label><label class="f">UPI (rest)<input class="in" id="su" disabled value="${c.total - splitCash}"></label></div>`;
			if (mode === "upi") UI.qr("#qrb", UI.upi(s.upi, s.biz, c.total, "Bill"), 150);
			const t = $("#tn"); if (t) { const u = () => { tender = +t.value || 0; $("#chg").innerHTML = tender >= c.total ? `Return change <b style="font-size:1.2rem">${inr(tender - c.total)}</b>` : `<span class="dn">Short by ${inr(c.total - tender)}</span>`; }; t.oninput = u; u(); }
			const sc = $("#sc"); if (sc) sc.oninput = () => { splitCash = Math.min(c.total, +sc.value || 0); $("#su").value = c.total - splitCash; };
		};
		modal({ title: "Take payment · " + inr(c.total), body: `<div class="tabs" id="pm">${Object.entries(MODES).map(([k, v]) => `<button data-m="${k}">${v}</button>`).join("")}<button data-m="split">Split</button></div><div id="pb" style="margin-top:14px"></div>`, onOpen: () => { $("#pm").onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) { mode = b.dataset.m; draw(); } }; $("#pb").onclick = (e) => { const b = e.target.closest("[data-tq]"); if (b) { tender = +b.dataset.tq === c.total ? c.total : (+$("#tn").value || c.total) + +b.dataset.tq; $("#tn").value = tender; $("#tn").dispatchEvent(new Event("input")); } }; draw(); },
			actions: [{ label: "Cancel" }, { label: "Complete sale", cls: "pri", fn: () => {
				let pays; if (mode === "cash") { if (tender < c.total) { toast("Cash received is less than the bill"); return false; } pays = [{ mode, amt: c.total }]; }
				else if (mode === "credit") { if (!cu) { toast("Pick a customer first"); return false; } pays = [{ mode, amt: c.total }]; }
				else if (mode === "split") pays = [{ mode: "cash", amt: splitCash }, { mode: "upi", amt: c.total - splitCash }].filter((p) => p.amt > 0); else pays = [{ mode, amt: c.total }];
				const L = bills(), no = "B" + (1001 + L.length), b = { no, ts: Date.now(), cust: POS.cust || null, lines: POS.lines.map((l) => ({ ...l })), disc: c.disc, total: c.total, tax: c.tax, by: c.by, pays, type: "sale" };
				L.push(b); S.set("bills", L); const it = items(); b.lines.forEach((l) => { const x = it.find((i) => i.id === l.id); if (x) x.stock = Math.max(0, Math.round((x.stock - l.qty) * 100) / 100); }); S.set("items", it);
				if (mode === "credit") { const cc = custs(); cc.find((k) => k.id === cu.id).ledger.push({ ts: b.ts, type: "sale", amt: c.total, ref: no }); S.set("customers", cc); }
				POS = { lines: [], cust: "", disc: 0, pct: false, q: "", cat: POS.cat }; setTimeout(() => { go(); showReceipt(b); toast("Sale complete " + no); }, 30);
			} }] });
	}

	/* ---------- dashboard ---------- */
	V.today = (c) => {
		const L = bills().filter((b) => inRange(b, 1)), Y = bills().filter((b) => b.ts >= sod(Date.now()) - day && b.ts < sod(Date.now())), t = L.reduce((a, b) => a + b.total, 0), y = Y.reduce((a, b) => a + b.total, 0), low = items().filter((i) => i.stock <= i.reorder), dues = custs().map((k) => ({ k, b: bal(k) })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b);
		const hours = [...Array(14)].map((_, h) => ({ label: h + 8 + "h", value: L.filter((b) => new Date(b.ts).getHours() === h + 8).reduce((a, b) => a + b.total, 0) }));
		c.innerHTML = `<div class="kpis">${kpi("Sales today", inr(t), (y ? (t >= y ? "+" : "") + Math.round((t / y - 1) * 100) + "% vs same day yesterday" : "-"), t >= y ? "up" : "dn")}${kpi("Bills", L.length, "avg " + inr(L.length ? t / L.length : 0))}${kpi("Khata outstanding", inr(dues.reduce((a, x) => a + x.b, 0)), dues.length + " customers owe you", "dn")}${kpi("Low stock", low.length, "items to reorder", "mut")}</div>
		<div class="g21" style="margin-bottom:16px"><div class="card"><h3>Sales by hour</h3>${bars(hours, { fmt: inrc, h: 210 })}</div><div class="card"><h3>Payment modes <span class="mut">today</span></h3>${UI.donut(Object.keys(MODES).map((m) => ({ label: MODES[m], value: L.reduce((a, b) => a + b.pays.filter((p) => p.mode === m).reduce((x, p) => x + p.amt, 0), 0), color: MC[m] })).filter((x) => x.value), { center: inrc(t), sub: "today" })}</div></div>
		<div class="g3"><div class="card"><h3>Recent bills <a href="#bills" class="btn sm">All</a></h3>${L.slice(-6).reverse().map((b) => `<div class="row sb" style="padding:7px 0;border-bottom:1px solid var(--line)"><div><b>${b.no}</b><div class="mut">${new Date(b.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · ${b.pays.map((p) => MODES[p.mode]).join("+")}</div></div><b>${inr(b.total)}</b></div>`).join("") || '<p class="empty">No bills yet today</p>'}</div>
		<div class="card"><h3>Running low <a href="#items" class="btn sm">Stock</a></h3>${low.slice(0, 7).map((i) => `<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(i.name)}</span>${chip(i.stock + " " + i.unit, i.stock < i.reorder / 2 ? "bad" : "warn")}</div>`).join("") || '<p class="empty">Stock levels look fine</p>'}</div>
		<div class="card"><h3>Who owes you <a href="#customers" class="btn sm">Khata</a></h3>${dues.slice(0, 6).map((x) => `<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(x.k.name)}</span><b class="dn">${inr(x.b)}</b></div>`).join("") || '<p class="empty">Nobody owes you</p>'}</div></div>`;
	};

	/* ---------- bills ---------- */
	let BF = { q: "", range: "7", mode: "" };
	V.bills = (c) => {
		const l = bills().filter((b) => (BF.range === "all" || inRange(b, +BF.range)) && (!BF.mode || b.pays.some((p) => p.mode === BF.mode)) && (!BF.q || (b.no + ((b.cust && cust(b.cust).name) || "")).toLowerCase().includes(BF.q.toLowerCase()))).reverse();
		c.innerHTML = `<div class="row" style="margin-bottom:14px"><input class="in" id="bq" placeholder="Bill number or customer" value="${esc(BF.q)}" style="max-width:260px"><select class="in" id="br" style="width:auto"><option value="1">Today</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="all">All</option></select><select class="in" id="bm" style="width:auto"><option value="">All payments</option>${Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><span class="sp" style="flex:1"></span><span class="mut">${l.length} bills · ${inr(l.reduce((a, b) => a + b.total, 0))}</span><button class="btn sm" id="bx">Export CSV</button></div>
		${table([{ k: "no", label: "Bill", fmt: (b) => `<b>${b.no}</b>${b.type === "return" ? " " + chip("Return", "warn") : ""}` }, { k: "ts", label: "Time", fmt: (b) => new Date(b.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }, { k: "c", label: "Customer", fmt: (b) => (b.cust ? esc(cust(b.cust).name) : '<span class="mut">Walk-in</span>') }, { k: "n", label: "Items", cls: "r", fmt: (b) => b.lines.length }, { k: "p", label: "Paid by", fmt: (b) => b.pays.map((p) => chip(MODES[p.mode], p.mode === "credit" ? "warn" : "")).join(" ") }, { k: "t", label: "Total", cls: "r", fmt: (b) => `<b class="${b.total < 0 ? "dn" : ""}">${inr(b.total)}</b>` }], l.slice(0, 60), { rowAttr: (b) => `data-bill="${b.no}" style="cursor:pointer"`, empty: "No bills match." })}`;
		$("#br").value = BF.range; $("#bm").value = BF.mode;
		$("#bq").oninput = (e) => { BF.q = e.target.value; clearTimeout(V._t); V._t = setTimeout(() => { V.bills($("#view")); $("#bq").focus(); $("#bq").setSelectionRange(99, 99); }, 250); }; $("#br").onchange = (e) => { BF.range = e.target.value; V.bills(c); }; $("#bm").onchange = (e) => { BF.mode = e.target.value; V.bills(c); };
		$("#bx").onclick = () => csv([["Bill", "Time", "Customer", "Payment", "Total", "GST"], ...l.map((b) => [b.no, new Date(b.ts).toISOString(), b.cust ? cust(b.cust).name : "", b.pays.map((p) => p.mode).join("+"), b.total, b.tax.toFixed(2)])], "bills.csv");
	};
	function billOpen(no) {
		const b = bills().find((x) => x.no === no); if (!b) return;
		showReceipt(b, b.type === "sale" ? { label: "Return items", fn: () => { setTimeout(() => returnForm(b), 30); } } : null);
	}
	function returnForm(b) {
		form("Return items from " + b.no, `<p class="mut" style="margin-bottom:10px">Set the quantity coming back. Stock is added back and a credit note is created.</p>` + b.lines.map((l, i) => field(esc(l.name) + " (sold " + l.qty + ")", "r" + i, 0, { type: "number", attrs: `min="0" max="${l.qty}" step="${l.unit === "kg" ? 0.25 : 1}"` })).join(""), (v) => {
			const rl = b.lines.map((l, i) => ({ ...l, qty: Math.min(+v["r" + i] || 0, l.qty) })).filter((l) => l.qty > 0); if (!rl.length) { toast("Enter a quantity to return"); return false; }
			const c = calc(rl, 0), L = bills(), r = { no: "R" + (1001 + L.filter((x) => x.type === "return").length), ts: Date.now(), cust: b.cust, lines: rl, disc: 0, total: -c.total, tax: -c.tax, by: c.by, pays: [{ mode: b.pays[0].mode, amt: -c.total }], type: "return", ref: b.no };
			L.push(r); S.set("bills", L); const it = items(); rl.forEach((l) => { const x = it.find((i) => i.id === l.id); if (x) x.stock += l.qty; }); S.set("items", it);
			if (b.pays[0].mode === "credit") { const cc = custs(); cc.find((k) => k.id === b.cust).ledger.push({ ts: r.ts, type: "pay", amt: c.total, ref: "Return " + r.no }); S.set("customers", cc); }
			toast("Credit note " + r.no + " for " + inr(c.total)); go(); setTimeout(() => showReceipt(r), 30);
		}, { save: "Create credit note" });
	}

	/* ---------- items ---------- */
	let IF = { q: "", cat: "", low: false };
	V.items = (c) => {
		const l = items().filter((i) => (!IF.q || (i.name + i.barcode).toLowerCase().includes(IF.q.toLowerCase())) && (!IF.cat || i.cat === IF.cat) && (!IF.low || i.stock <= i.reorder));
		c.innerHTML = `<div class="row" style="margin-bottom:14px"><input class="in" id="iq" placeholder="Search name or barcode" value="${esc(IF.q)}" style="max-width:260px"><select class="in" id="ic" style="width:auto"><option value="">All categories</option>${CATS.map((k) => `<option>${k}</option>`).join("")}</select><label class="row" style="gap:6px"><input type="checkbox" id="il" ${IF.low ? "checked" : ""}> Low stock only</label><span style="flex:1"></span><button class="btn sm" id="ix">Export CSV</button><button class="btn pri sm" id="ia">+ Add item</button></div>
		${table([{ k: "name", label: "Item", fmt: (i) => `<b>${esc(i.name)}</b><div class="mut">${i.barcode} · ${i.cat}</div>` }, { k: "price", label: "Price (incl. GST)", cls: "r", fmt: (i) => inr(i.price) + (i.loose ? "/kg" : "") }, { k: "gst", label: "GST", cls: "r", fmt: (i) => i.gst + "%" }, { k: "m", label: "Margin", cls: "r", fmt: (i) => Math.round((1 - i.cost / i.price) * 100) + "%" }, { k: "stock", label: "Stock", cls: "r", fmt: (i) => chip(i.stock + " " + i.unit, i.stock <= 0 ? "bad" : i.stock <= i.reorder ? "warn" : "ok") }, { k: "e", label: "", cls: "r", fmt: (i) => `<button class="btn sm" data-edit="${i.id}">Edit</button>` }], l, { empty: "No items match." })}`;
		$("#ic").value = IF.cat; $("#iq").oninput = (e) => { IF.q = e.target.value; clearTimeout(V._t); V._t = setTimeout(() => { V.items(c); $("#iq").focus(); $("#iq").setSelectionRange(99, 99); }, 250); }; $("#ic").onchange = (e) => { IF.cat = e.target.value; V.items(c); }; $("#il").onchange = (e) => { IF.low = e.target.checked; V.items(c); }; $("#ia").onclick = () => itemForm(); $("#ix").onclick = () => csv([["Name", "Category", "Barcode", "Price", "GST", "Cost", "Stock", "Unit"], ...items().map((i) => [i.name, i.cat, i.barcode, i.price, i.gst, i.cost, i.stock, i.unit])], "items.csv");
	};
	function itemForm(id) {
		const it = id ? items().find((i) => i.id === id) : { name: "", cat: "Grocery", price: "", gst: 5, unit: "pc", stock: 0, cost: "", reorder: 10, barcode: "", loose: false };
		form(id ? "Edit item" : "New item", `<div class="row2">${field("Name", "name", it.name, { req: 1 })}${field("Category", "cat", it.cat, { type: "select", opts: CATS })}</div><div class="row3">${field("Selling price (incl. GST)", "price", it.price, { type: "number", req: 1 })}${field("Cost price", "cost", it.cost, { type: "number" })}${field("GST %", "gst", it.gst, { type: "select", opts: [0, 5, 18, 40] })}</div><div class="row3">${field("Stock", "stock", it.stock, { type: "number" })}${field("Reorder at", "reorder", it.reorder, { type: "number" })}${field("Unit", "unit", it.unit, { type: "select", opts: ["pc", "kg"] })}</div>${field("Barcode (blank to auto-generate)", "barcode", it.barcode)}`, (v) => {
			const L = items(); const o = { ...it, ...v, gst: +v.gst, loose: v.unit === "kg", cost: v.cost || Math.round(v.price * 0.8), barcode: v.barcode || "890" + String(1e9 + Math.floor(Math.random() * 9e9)) };
			if (id) L[L.findIndex((i) => i.id === id)] = o; else L.push({ ...o, id: "i" + Date.now() }); S.set("items", L); toast("Item saved"); go();
		});
	}

	/* ---------- customers / khata ---------- */
	V.customers = (c) => {
		const l = custs().map((k) => ({ ...k, b: bal(k) })).sort((a, b) => b.b - a.b), tot = l.reduce((a, k) => a + Math.max(0, k.b), 0);
		c.innerHTML = `<div class="kpis">${kpi("Total khata outstanding", inr(tot), l.filter((k) => k.b > 0).length + " customers", "dn")}${kpi("Customers", l.length, "on file")}${kpi("Collected this week", inr(l.reduce((a, k) => a + k.ledger.filter((e) => e.type === "pay" && e.ts > Date.now() - 7 * day).reduce((x, e) => x + e.amt, 0), 0)), "payments received", "up")}</div><div class="row sb" style="margin-bottom:12px"><h3>Customers</h3><button class="btn pri sm" id="ca">+ Add customer</button></div>
		${table([{ k: "n", label: "Name", fmt: (k) => `<b>${esc(k.name)}</b><div class="mut">${k.phone}</div>` }, { k: "l", label: "Limit", cls: "r", fmt: (k) => inr(k.limit) }, { k: "u", label: "Used", fmt: (k) => `<div class="bar" style="width:90px"><i style="width:${Math.min(100, Math.max(0, (k.b / k.limit) * 100))}%;${k.b > k.limit ? "background:var(--bad)" : ""}"></i></div>` }, { k: "b", label: "Balance", cls: "r", fmt: (k) => `<b class="${k.b > 0 ? "dn" : ""}">${inr(k.b)}</b>` }, { k: "a", label: "", cls: "r", fmt: (k) => `<button class="btn sm" data-stm="${k.id}">Statement</button>` }], l)}`;
		$("#ca").onclick = () => form("New customer", field("Name", "name", "", { req: 1 }) + field("Mobile", "phone", "", { type: "tel", req: 1 }) + field("Credit limit (₹)", "limit", 2000, { type: "number" }), (v) => { const L = custs(); L.push({ id: "c" + Date.now(), name: v.name, phone: v.phone, limit: v.limit || 2000, ledger: [] }); S.set("customers", L); go(); });
	};
	function statement(id) {
		const k = cust(id), b = bal(k); let run = 0;
		const rows = k.ledger.map((e) => { run += e.type === "sale" ? e.amt : -e.amt; return `<tr><td>${fdate(e.ts, { day: "numeric", month: "short" })}</td><td>${e.type === "sale" ? "Bill " + e.ref : "Payment " + esc(e.ref)}</td><td class="r">${e.type === "sale" ? inr(e.amt) : ""}</td><td class="r">${e.type === "pay" ? inr(e.amt) : ""}</td><td class="r">${inr(run)}</td></tr>`; }).reverse().join("");
		const msg = `Hi ${k.name.split(" ")[0]}, your balance at ${set().biz} is ${inr(b)}. You can pay by UPI to ${set().upi}: ${UI.upi(set().upi, set().biz, b)} Thank you.`;
		modal({ title: esc(k.name) + " · khata", wide: true, body: `<div class="row sb" style="margin-bottom:12px"><div><span class="mut">Balance due</span><div style="font-size:1.8rem;font-weight:800" class="${b > 0 ? "dn" : ""}">${inr(b)}</div></div><div class="row"><a class="btn sm" target="_blank" href="${UI.wa(k.phone, msg)}">Send reminder on WhatsApp</a></div></div>${table([{ k: "d", label: "Date" }, { k: "e", label: "Entry" }, { k: "g", label: "Gave", cls: "r" }, { k: "r", label: "Received", cls: "r" }, { k: "b", label: "Balance", cls: "r" }].map((c) => ({ ...c, fmt: undefined })), []).replace(/<tbody>[\s\S]*<\/tbody>/, "<tbody>" + (rows || '<tr><td colspan="5" class="empty">No entries</td></tr>') + "</tbody>")}`,
			actions: [{ label: "Close" }, { label: "Print", fn: () => { UI.print(`<h2>${esc(set().biz)}</h2><h3>Statement: ${esc(k.name)}</h3><table>${rows}</table><h3>Balance due ${inr(b)}</h3>`); return false; } }, { label: "Receive payment", cls: "pri", fn: () => { setTimeout(() => form("Receive payment from " + k.name, field("Amount (₹)", "amt", b > 0 ? b : "", { type: "number", req: 1 }) + field("Mode", "mode", "UPI", { type: "select", opts: ["UPI", "Cash", "Card"] }), (v) => { const L = custs(), x = L.find((q) => q.id === id); x.ledger.push({ ts: Date.now(), type: "pay", amt: +v.amt, ref: v.mode }); S.set("customers", L); toast(inr(v.amt) + " received from " + k.name); go(); }, { save: "Record payment" }), 30); } }] });
	}

	/* ---------- reports ---------- */
	let RD = 7;
	V.reports = (c) => {
		const L = bills().filter((b) => inRange(b, RD)), sales = L.filter((b) => b.type === "sale"), tot = L.reduce((a, b) => a + b.total, 0), tax = L.reduce((a, b) => a + b.tax, 0), it = items(), cost = sales.reduce((a, b) => a + b.lines.reduce((x, l) => x + l.qty * ((it.find((i) => i.id === l.id) || {}).cost || 0), 0), 0);
		const days = [...Array(RD)].map((_, i) => { const t = sod(Date.now()) - (RD - 1 - i) * day; return { x: i, label: new Date(t).getDate() + "/" + (new Date(t).getMonth() + 1), y: L.filter((b) => b.ts >= t && b.ts < t + day).reduce((a, b) => a + b.total, 0) }; });
		const prod = {}; sales.forEach((b) => b.lines.forEach((l) => { prod[l.name] = (prod[l.name] || 0) + l.qty * l.price; })); const top = Object.entries(prod).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
		const cat = {}; sales.forEach((b) => b.lines.forEach((l) => { const k = (it.find((i) => i.id === l.id) || {}).cat || "Other"; cat[k] = (cat[k] || 0) + l.qty * l.price; }));
		const gst = {}; L.forEach((b) => Object.entries(b.by).forEach(([r, v]) => { const s = b.type === "return" ? -1 : 1; gst[r] = gst[r] || { tx: 0, g: 0 }; gst[r].tx += s * Math.abs(v.tx); gst[r].g += s * Math.abs(v.gst); }));
		c.innerHTML = `<div class="row sb" style="margin-bottom:14px">${tabsHtml([[1, "Today"], [7, "7 days"], [30, "30 days"]].map(([k, l]) => [k, l]), RD, "data-rd")}<button class="btn sm" id="rx">Export GST summary</button></div>
		<div class="kpis">${kpi("Net sales", inr(tot), L.length + " bills")}${kpi("Gross profit (est.)", inr(tot - tax - cost), Math.round(((tot - tax - cost) / (tot || 1)) * 100) + "% of sales", "up")}${kpi("GST collected", inr(tax), "included in prices")}${kpi("Credit given", inr(L.filter((b) => b.pays[0].mode === "credit").reduce((a, b) => a + b.total, 0)), "on khata", "mut")}</div>
		<div class="g21" style="margin-bottom:16px"><div class="card"><h3>Daily sales</h3>${line([{ name: "Sales", data: days }], { area: true, h: 230, fmt: inrc })}</div><div class="card"><h3>By category</h3>${donut(Object.entries(cat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), { center: inrc(tot) })}</div></div>
		<div class="g2"><div class="card"><h3>Top items by sales</h3>${hbars(top, { fmt: inrc, lw: "150px" })}</div><div class="card"><h3>GST summary</h3>${table([{ k: "r", label: "Rate" }, { k: "t", label: "Taxable value", cls: "r" }, { k: "g", label: "GST", cls: "r" }].map((x) => x), []).replace(/<tbody>[\s\S]*<\/tbody>/, "<tbody>" + Object.entries(gst).sort((a, b) => a[0] - b[0]).map(([r, v]) => `<tr><td>${r}%</td><td class="r">${inr(v.tx)}</td><td class="r">${inr(v.g)}</td></tr>`).join("") + "</tbody>")}<p class="mut" style="margin-top:10px">Prices include GST. Taxable value and tax are split out per slab for your GSTR-1 and 3B figures.</p></div></div>`;
		$("#rx").onclick = () => csv([["Rate %", "Taxable value", "GST"], ...Object.entries(gst).map(([r, v]) => [r, v.tx.toFixed(2), v.g.toFixed(2)])], "gst-summary.csv");
	};

	/* ---------- day close ---------- */
	V.close = (c) => {
		const cl = S.get("closes", []), open = S.get("opening", 2000), today = bills().filter((b) => inRange(b, 1)), cash = today.reduce((a, b) => a + b.pays.filter((p) => p.mode === "cash").reduce((x, p) => x + p.amt, 0), 0), recv = custs().reduce((a, k) => a + k.ledger.filter((e) => e.type === "pay" && e.ref === "Cash" && e.ts >= sod(Date.now())).reduce((x, e) => x + e.amt, 0), 0), exp = open + cash + recv;
		const by = (m) => today.reduce((a, b) => a + b.pays.filter((p) => p.mode === m).reduce((x, p) => x + p.amt, 0), 0);
		c.innerHTML = `<div class="g2"><div class="card"><h3>Close today's till</h3><div class="stack"><label class="f">Opening float<input class="in" id="op" type="number" value="${open}"></label>${[["Cash sales", cash], ["Khata cash received", recv]].map(([a, b]) => `<div class="row sb"><span>${a}</span><b>${inr(b)}</b></div>`).join("")}<div class="row sb" style="font-size:1.1rem"><span>Expected cash in drawer</span><b>${inr(exp)}</b></div><label class="f">Cash counted<input class="in" id="cc" type="number" placeholder="Count the notes and coins"></label><div class="note" id="vr">Enter the counted cash to see the difference.</div><button class="btn pri" id="cd">Close the day</button></div></div>
		<div class="stack"><div class="card"><h3>Today by payment mode</h3>${Object.keys(MODES).map((m) => `<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="row"><i style="width:10px;height:10px;border-radius:3px;background:${MC[m]}"></i>${MODES[m]}</span><b>${inr(by(m))}</b></div>`).join("")}<div class="row sb" style="padding-top:8px"><b>Total</b><b>${inr(today.reduce((a, b) => a + b.total, 0))}</b></div></div><div class="card"><h3>Past closes</h3>${table([{ k: "date", label: "Date", fmt: (x) => fdate(x.date) }, { k: "expected", label: "Expected", cls: "r", fmt: (x) => inr(x.expected) }, { k: "counted", label: "Counted", cls: "r", fmt: (x) => inr(x.counted) }, { k: "v", label: "Difference", cls: "r", fmt: (x) => chip(inr(x.counted - x.expected), x.counted === x.expected ? "ok" : "warn") }], [...cl].reverse().slice(0, 6))}</div></div></div>`;
		$("#cc").oninput = (e) => { const d = +e.target.value - exp; $("#vr").innerHTML = e.target.value === "" ? "Enter the counted cash to see the difference." : d === 0 ? "<b class=\"up\">Till matches.</b>" : `Difference <b class="${d < 0 ? "dn" : "up"}">${d < 0 ? "short" : "excess"} ${inr(Math.abs(d))}</b>. Check the bills before closing.`; };
		$("#op").onchange = (e) => { S.set("opening", +e.target.value || 0); V.close(c); };
		$("#cd").onclick = () => { const v = $("#cc").value; if (v === "") return toast("Enter the counted cash first"); cl.push({ date: iso(new Date()), opening: open, expected: exp, counted: +v, by: "Owner" }); S.set("closes", cl); toast("Day closed. Sales summary saved."); V.close(c); };
	};

	/* ---------- settings ---------- */
	V.settings = (c) => {
		const s = set();
		c.innerHTML = `<div class="g2"><div class="card"><h3>Store details</h3><div class="stack">${field("Store name", "biz", s.biz)}${field("Address", "addr", s.addr)}<div class="row2">${field("GSTIN", "gstin", s.gstin)}${field("UPI ID for QR", "upi", s.upi)}</div>${field("Receipt footer", "footer", s.footer)}${field("Receipt width", "width", s.width, { type: "select", opts: [[80, "80 mm (standard)"], [58, "58 mm (small)"]] })}<button class="btn pri" id="ss">Save settings</button></div></div><div class="stack"><div class="card"><h3>Receipt preview</h3><div id="rp"></div></div><div class="card"><h3>Demo data</h3><p class="mut" style="margin-bottom:10px">Everything is stored in this browser only. Reset to get the original sample store back.</p><button class="btn danger" id="rs">Reset sample data</button></div></div></div>`;
		const pv = () => { $("#rp").innerHTML = receipt({ no: "B1000", ts: Date.now(), lines: [{ name: "Atta 5kg", qty: 1, price: 245, gst: 0, unit: "pc" }, { name: "Toor Dal (loose)", qty: 1.5, price: 150, gst: 0, unit: "kg" }], disc: 0, total: 470, tax: 0, by: { 0: { tx: 470, gst: 0 } }, pays: [{ mode: "upi", amt: 470 }], type: "sale" }); }; pv();
		$("#ss").onclick = () => { S.set("settings", { ...s, ...vals(c) }); toast("Saved"); pv(); $("#biz").textContent = set().biz; };
		$("#rs").onclick = () => confirmBox("This removes your changes and restores the sample data.", () => { S.clear(); location.reload(); }, "Reset");
	};

	/* ---------- wiring ---------- */
	const go = () => goR();
	const goR = router(V, "sell", { titles: { sell: "Billing", today: "Today", bills: "Bills", items: "Items & stock", customers: "Customers & khata", reports: "Reports", close: "Day close", settings: "Settings" } }); window.go = goR;
	document.getElementById("biz").textContent = set().biz;
	function render() { goR(); }
	document.addEventListener("click", (e) => {
		const t = e.target.closest("button,tr[data-bill]"); if (!t) return;
		if (t.dataset.add) { addLine(items().find((i) => i.id === t.dataset.add)); if (items().find((i) => i.id === t.dataset.add).stock <= 0) toast("Warning: stock shows 0"); }
		else if (t.dataset.q) { const [i, d] = t.dataset.q.split("|"), l = POS.lines[+i], step = l.unit === "kg" ? 0.25 : 1; l.qty = Math.round((l.qty + step * +d) * 100) / 100; if (l.qty <= 0) POS.lines.splice(+i, 1); cart(); }
		else if (t.dataset.rm) { POS.lines.splice(+t.dataset.rm, 1); cart(); }
		else if (t.dataset.cat !== undefined && t.closest("#cats")) { POS.cat = t.dataset.cat; $$("#cats button").forEach((b) => b.classList.toggle("on", b === t)); grid(); }
		else if (t.id === "dt") { POS.pct = !POS.pct; cart(); }
		else if (t.dataset.rd) { RD = +t.dataset.rd; V.reports($("#view")); }
		else if (t.dataset.edit) itemForm(t.dataset.edit); else if (t.dataset.stm) statement(t.dataset.stm);
		else if (t.dataset.bill) billOpen(t.dataset.bill);
	});
	document.addEventListener("change", (e) => { if (e.target.dataset.qi !== undefined) { const l = POS.lines[+e.target.dataset.qi]; l.qty = Math.max(0, +e.target.value || 0); if (!l.qty) POS.lines.splice(+e.target.dataset.qi, 1); cart(); } if (e.target.id === "dv") { POS.disc = +e.target.value || 0; cart(); } });
	document.addEventListener("keydown", (e) => { if (e.key === "F2") { e.preventDefault(); if (location.hash && location.hash !== "#sell") location.hash = "#sell"; setTimeout(() => $("#q") && $("#q").focus(), 30); } if (e.key === "F9" && $("#payb")) { e.preventDefault(); pay(); } });
	$("#theme").onclick = () => { const d = document.body.classList.toggle("dark"); S.set("dark", d); }; if (S.get("dark", false)) document.body.classList.add("dark");
})();
