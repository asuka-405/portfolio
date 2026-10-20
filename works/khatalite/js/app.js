/* KhataLite: credit ledger and cashbook for small businesses (concept build). */
(function () {
	const { $, $$, esc, inr, inrc, num, iso, addDays, fdate, hash, rng, store: mk, toast, modal, confirmBox, csv, line, bars, hbars, donut, router, table, kpi, chip, field, form, vals, tabsHtml } = UI;
	const S = mk("kl-"), day = 864e5, V = {};
	const sod = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

	function seed() {
		if (S.get("seeded", false)) return;
		const R = rng(11), now = Date.now(), ents = [];
		const P = [["Sunita Aggarwal", "c"], ["Ramesh Tyagi", "c"], ["Pooja Sethi", "c"], ["Mohan Lal", "c"], ["Neelam Kaur", "c"], ["Dr. Anil Bhatia", "c"], ["Geeta Devi", "c"], ["Harish Chandra", "c"], ["Kavita Rao", "c"], ["Imran Qureshi", "c"], ["Shalini Mathur", "c"], ["Vinod Pandey", "c"], ["Rekha Sharma", "c"], ["Anuj Saxena", "c"], ["Preeti Jain", "c"], ["Balaji Caterers", "c"], ["Amul Distributor", "s"], ["Shree Packaging", "s"], ["Kumar Sugar Mill Agent", "s"], ["Gas Agency", "s"], ["Fresh Fruits Mandi", "s"], ["Ganesh Transport", "s"]];
		const parties = P.map((p, i) => ({ id: "p" + (i + 1), name: p[0], kind: p[1], phone: "98" + String(10000000 + Math.floor(R() * 89999999)), grace: p[1] === "c" ? [7, 15, 30][Math.floor(R() * 3)] : 0, note: "" }));
		parties.forEach((p) => {
			const n = 5 + Math.floor(R() * 9); let bal = 0;
			for (let k = 0; k < n; k++) {
				const ts = now - (85 - Math.floor((k / n) * 80) - Math.floor(R() * 4)) * day - Math.floor(R() * 8e7), cust = p.kind === "c", gave = cust ? (k % 3 !== 2 || bal <= 0) : bal < 0 && R() < 0.45;
				let amt = Math.round((cust ? 150 + R() * 2200 : 3000 + R() * 22000) / 10) * 10; if (cust ? !gave : gave) amt = Math.min(amt, Math.max(50, Math.abs(bal))); amt = Math.round(amt / 10) * 10;
				const type = cust ? (gave ? "gave" : "got") : gave ? "gave" : "got";
				ents.push({ id: "e" + ents.length, party: p.id, ts, type, amt, note: cust ? (gave ? ["Milk and curd", "Sweets box", "Monthly dairy", "Paneer and ghee", "Party order", "Groceries"][Math.floor(R() * 6)] : ["UPI", "Cash", "Part payment", "UPI"][Math.floor(R() * 4)]) : (gave ? "Paid by bank transfer" : ["Stock purchase", "Invoice " + (1000 + ents.length), "Monthly supply"][Math.floor(R() * 3)]) });
				bal += type === "gave" ? amt : -amt;
			}
		});
		ents.sort((a, b) => a.ts - b.ts);
		const cash = []; for (let d = 59; d >= 0; d--) { const base = now - d * day; cash.push({ id: "k" + cash.length, ts: base - 5e7, type: "in", amt: Math.round((6000 + R() * 9000) / 10) * 10, cat: "Counter sales", note: "Day sales", mode: "Cash" }); if (R() < 0.5) cash.push({ id: "k" + cash.length, ts: base - 4e7, type: "in", amt: Math.round((1500 + R() * 4000) / 10) * 10, cat: "UPI received", note: "", mode: "UPI" }); cash.push({ id: "k" + cash.length, ts: base - 3e7, type: "out", amt: Math.round((1500 + R() * 4500) / 10) * 10, cat: ["Milk purchase", "Raw material", "Packaging"][Math.floor(R() * 3)], note: "", mode: "Cash" }); if (d % 7 === 0) cash.push({ id: "k" + cash.length, ts: base - 2e7, type: "out", amt: 6500, cat: "Salary", note: "Weekly wages", mode: "Cash" }); if (d % 30 === 3) cash.push({ id: "k" + cash.length, ts: base - 2e7, type: "out", amt: 18000, cat: "Rent", note: "Shop rent", mode: "Bank" }); if (R() < 0.3) cash.push({ id: "k" + cash.length, ts: base - 1e7, type: "out", amt: Math.round((200 + R() * 900) / 10) * 10, cat: ["Electricity", "Transport", "Tea and snacks", "Repairs"][Math.floor(R() * 4)], note: "", mode: "Cash" }); }
		S.set("parties", parties); S.set("entries", ents); S.set("cash", cash); S.set("log", [{ ts: now - 2 * day, party: "p3", tone: "gentle", ch: "WhatsApp" }, { ts: now - 5 * day, party: "p8", tone: "firm", ch: "WhatsApp" }]);
		S.set("settings", { biz: "Mehta Dairy & Sweets", owner: "Rakesh Mehta", upi: "mehtadairy@upi", lang: "en", opening: 25000 }); S.set("seeded", true);
	}
	seed();
	const parties = () => S.get("parties", []), ents = () => S.get("entries", []), cash = () => S.get("cash", []), set = () => S.get("settings", {});
	const party = (id) => parties().find((p) => p.id === id);
	const pe = (id) => ents().filter((e) => e.party === id), bal = (id) => pe(id).reduce((a, e) => a + (e.type === "gave" ? e.amt : -e.amt), 0);
	// days since the balance first became unpaid (FIFO against payments)
	function age(id) { let open = []; pe(id).forEach((e) => { if (e.type === "gave") open.push({ ts: e.ts, amt: e.amt }); else { let r = e.amt; while (r > 0 && open.length) { const o = open[0]; const t = Math.min(o.amt, r); o.amt -= t; r -= t; if (o.amt <= 0) open.shift(); } } }); return open.length && bal(id) > 0 ? Math.floor((Date.now() - open[0].ts) / day) : 0; }
	const lastTs = (id) => Math.max(0, ...pe(id).map((e) => e.ts));
	const rows = () => parties().map((p) => ({ ...p, bal: bal(p.id), age: age(p.id), last: lastTs(p.id) }));
	const overdue = (p) => p.kind === "c" && p.bal > 0 && p.age > p.grace;
	const link = (id) => { const p = party(id), s = set(), d = { b: s.biz, u: s.upi, n: p.name, bal: bal(id), e: pe(id).slice(-25).map((e) => [e.ts, e.type, e.amt, e.note]) }; return location.href.replace(/app\.html.*/, "") + "statement.html#" + btoa(unescape(encodeURIComponent(JSON.stringify(d)))); };
	const TONES = { gentle: "Gentle", firm: "Firm", final: "Final notice" };
	function msg(p, tone) {
		const s = set(), a = inr(p.bal), L = link(p.id), n = p.name.split(" ")[0];
		const T = { en: { gentle: `Hello ${n}, a gentle reminder from ${s.biz}. Your pending balance is ${a}. Details and UPI payment: ${L} Thank you!`, firm: `Hello ${n}, ${a} has been pending with ${s.biz} for ${p.age} days. Please clear it today. Statement and UPI: ${L}`, final: `Dear ${n}, this is the final reminder for ${a} pending at ${s.biz} for ${p.age} days. Please pay today to avoid stopping credit. ${L}` }, hi: { gentle: `Namaste ${n} ji, ${s.biz} se yaad dilana tha ki aapka ${a} baaki hai. Statement aur UPI se payment yahan: ${L} Dhanyavaad!`, firm: `${n} ji, ${s.biz} ka ${a} ${p.age} din se baaki hai. Kripya aaj hi chuka dein. ${L}`, final: `${n} ji, ${s.biz} ka ${a} ${p.age} din se baaki hai. Aakhri request: aaj payment kar dein, warna udhaar band karna padega. ${L}` } };
		return T[s.lang || "en"][tone];
	}
	function remind(id, tone) { const p = rows().find((x) => x.id === id), l = S.get("log", []); l.push({ ts: Date.now(), party: id, tone, ch: "WhatsApp" }); S.set("log", l); window.open(UI.wa(p.phone, msg(p, tone)), "_blank"); }

	/* ---------- home ---------- */
	V.home = (c) => {
		const R = rows(), get = R.filter((p) => p.bal > 0), give = R.filter((p) => p.bal < 0), od = R.filter(overdue).sort((a, b) => b.bal - a.bal), wk = ents().filter((e) => e.type === "got" && parties().find((p) => p.id === e.party).kind === "c" && e.ts > Date.now() - 7 * day);
		const weeks = [...Array(8)].map((_, i) => { const t = sod(Date.now()) - (7 - i) * 7 * day; return { label: new Date(t).getDate() + "/" + (new Date(t).getMonth() + 1), value: ents().filter((e) => e.type === "got" && e.ts >= t && e.ts < t + 7 * day && party(e.party).kind === "c").reduce((a, e) => a + e.amt, 0) }; });
		c.innerHTML = `<div class="kpis">${kpi("You will get", inr(get.reduce((a, p) => a + p.bal, 0)), get.length + " customers owe you", "up")}${kpi("You will give", inr(-give.reduce((a, p) => a + p.bal, 0)), give.length + " suppliers to pay", "dn")}${kpi("Overdue", inr(od.reduce((a, p) => a + p.bal, 0)), od.length + " past their grace period", "dn")}${kpi("Collected this week", inr(wk.reduce((a, e) => a + e.amt, 0)), wk.length + " payments", "up")}</div>
		<div class="g21" style="margin-bottom:16px"><div class="card"><h3>Collections per week <span class="mut">last 8 weeks</span></h3>${bars(weeks, { fmt: inrc, h: 210 })}</div><div class="card"><h3>Quick entry</h3><div class="stack"><select class="in" id="qp" aria-label="Party">${R.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select><input class="in" id="qa" type="number" placeholder="Amount (₹)"><input class="in" id="qn" placeholder="Note (optional)"><div class="row2"><button class="btn" style="color:var(--bad)" id="qg">You gave</button><button class="btn pri" id="qt">You got</button></div></div></div></div>
		<div class="g2"><div class="card"><h3>Chase these first <a class="btn sm" href="#reminders">Reminders</a></h3>${od.slice(0, 6).map((p) => `<div class="row sb" style="padding:8px 0;border-bottom:1px solid var(--line)"><a href="#party/${p.id}" style="text-decoration:none"><b>${esc(p.name)}</b><div class="mut">${p.age} days pending</div></a><div class="row"><b class="dn">${inr(p.bal)}</b><button class="btn sm pri" data-rem="${p.id}|${p.age > 45 ? "firm" : "gentle"}">Remind</button></div></div>`).join("") || '<p class="empty">Nobody is overdue</p>'}</div>
		<div class="card"><h3>Recent activity</h3>${ents().slice(-7).reverse().map((e) => `<div class="row sb" style="padding:7px 0;border-bottom:1px solid var(--line)"><div><b>${esc(party(e.party).name)}</b><div class="mut">${esc(e.note || "")} · ${UI.ago(e.ts)}</div></div><b class="${e.type === "got" ? "up" : "dn"}">${e.type === "got" ? "+" : "-"}${inr(e.amt)}</b></div>`).join("")}</div></div>`;
		const add = (t) => { const a = +$("#qa").value; if (!a) return toast("Enter an amount"); addEntry($("#qp").value, t, a, $("#qn").value); V.home(c); };
		$("#qg").onclick = () => add("gave"); $("#qt").onclick = () => add("got");
	};
	function addEntry(pid, type, amt, note, ts) { const l = ents(); l.push({ id: "e" + Date.now() + Math.floor(Math.random() * 99), party: pid, ts: ts || Date.now(), type, amt: +amt, note: note || "" }); S.set("entries", l); toast((type === "got" ? "Received " : "Gave ") + inr(amt) + " " + (type === "got" ? "from " : "to ") + party(pid).name); badge(); }

	/* ---------- parties ---------- */
	let PF = { tab: "all", q: "", sort: "bal" };
	V.parties = (c) => {
		let l = rows().filter((p) => (PF.tab === "all" || (PF.tab === "c" && p.kind === "c") || (PF.tab === "s" && p.kind === "s") || (PF.tab === "od" && overdue(p))) && (!PF.q || p.name.toLowerCase().includes(PF.q.toLowerCase())));
		l.sort(PF.sort === "name" ? (a, b) => a.name.localeCompare(b.name) : PF.sort === "last" ? (a, b) => b.last - a.last : (a, b) => Math.abs(b.bal) - Math.abs(a.bal));
		c.innerHTML = `<div class="row" style="margin-bottom:14px">${tabsHtml([["all", "All"], ["c", "Customers"], ["s", "Suppliers"], ["od", "Overdue"]], PF.tab, "data-pt")}<input class="in" id="pq" placeholder="Search by name" value="${esc(PF.q)}" style="max-width:240px"><select class="in" id="ps" style="width:auto"><option value="bal">Biggest balance</option><option value="last">Latest activity</option><option value="name">Name A to Z</option></select><span style="flex:1"></span><button class="btn pri sm" id="pa">+ Add party</button></div>
		${table([{ k: "n", label: "Name", fmt: (p) => `<a href="#party/${p.id}" style="text-decoration:none"><b>${esc(p.name)}</b></a><div class="mut">${p.kind === "c" ? "Customer" : "Supplier"} · ${p.phone}</div>` }, { k: "a", label: "Pending since", fmt: (p) => (p.bal > 0 ? chip(p.age + " days", overdue(p) ? "bad" : p.age > 15 ? "warn" : "mut") : '<span class="mut">-</span>') }, { k: "l", label: "Last entry", fmt: (p) => '<span class="mut">' + UI.ago(p.last) + "</span>" }, { k: "b", label: "Balance", cls: "r", fmt: (p) => (p.bal === 0 ? '<span class="mut">Settled</span>' : `<b class="${p.bal > 0 ? "up" : "dn"}">${inr(Math.abs(p.bal))}</b><div class="mut">${p.bal > 0 ? "you will get" : "you will give"}</div>`) }, { k: "r", label: "", cls: "r", fmt: (p) => (p.bal > 0 ? `<button class="btn sm" data-rem="${p.id}|gentle">Remind</button>` : "") }], l, { empty: "No one here yet." })}`;
		$("#ps").value = PF.sort; $("#ps").onchange = (e) => { PF.sort = e.target.value; V.parties(c); };
		$("#pq").oninput = (e) => { PF.q = e.target.value; clearTimeout(V._t); V._t = setTimeout(() => { V.parties(c); $("#pq").focus(); $("#pq").setSelectionRange(99, 99); }, 250); };
		$("#pa").onclick = () => form("Add party", `<div class="row2">${field("Name", "name", "", { req: 1 })}${field("Mobile", "phone", "", { type: "tel", req: 1 })}</div><div class="row2">${field("Type", "kind", "c", { type: "select", opts: [["c", "Customer"], ["s", "Supplier"]] })}${field("Grace days before reminder", "grace", 15, { type: "number" })}</div>`, (v) => { const L = parties(); L.push({ id: "p" + Date.now(), name: v.name, phone: v.phone, kind: v.kind, grace: v.grace || 15, note: "" }); S.set("parties", L); toast("Party added"); V.parties(c); });
	};

	/* ---------- one party ---------- */
	V.party = (c, [id]) => {
		const p = party(id); if (!p) return (c.innerHTML = '<p class="empty">Party not found. <a href="#parties">Back to parties</a></p>');
		const b = bal(id), ag = age(id); let run = 0;
		const E = pe(id).map((e) => { run += e.type === "gave" ? e.amt : -e.amt; return { ...e, run }; }).reverse();
		c.innerHTML = `<a href="#parties" class="mut" style="text-decoration:none">← All parties</a><div class="row sb" style="margin:8px 0 16px"><div class="row"><span class="avatar" style="width:46px;height:46px;font-size:1rem">${UI.initials(p.name)}</span><div><h2 style="font-size:1.4rem">${esc(p.name)}</h2><div class="mut">${p.kind === "c" ? "Customer" : "Supplier"} · ${p.phone}${b > 0 && ag ? " · pending " + ag + " days" : ""}</div></div></div><div style="text-align:right"><div class="mut">${b > 0 ? "You will get" : b < 0 ? "You will give" : "Settled"}</div><div style="font-size:2rem;font-weight:800" class="${b > 0 ? "up" : b < 0 ? "dn" : ""}">${inr(Math.abs(b))}</div></div></div>
		<div class="row" style="margin-bottom:16px"><button class="btn" style="color:var(--bad)" data-ent="gave">${p.kind === "c" ? "You gave (credit)" : "You paid"}</button><button class="btn pri" data-ent="got">${p.kind === "c" ? "You got (payment)" : "You got (purchase)"}</button><span style="flex:1"></span>${b > 0 ? `<button class="btn" data-rm="1">Send reminder</button>` : ""}<button class="btn" id="stl">Share statement</button><button class="btn" id="stp">Print</button></div>
		<div class="card" style="padding:0"><div class="tbl-wrap" style="border:0"><table class="tbl"><thead><tr><th>Date</th><th>Details</th><th class="r">You gave</th><th class="r">You got</th><th class="r">Balance</th><th></th></tr></thead><tbody>${E.map((e) => `<tr><td>${fdate(e.ts, { day: "numeric", month: "short", year: "2-digit" })}</td><td>${esc(e.note || (e.type === "got" ? "Payment" : "Credit"))}</td><td class="r dn">${e.type === "gave" ? inr(e.amt) : ""}</td><td class="r up">${e.type === "got" ? inr(e.amt) : ""}</td><td class="r"><b>${inr(Math.abs(e.run))}</b> <span class="mut">${e.run >= 0 ? "Dr" : "Cr"}</span></td><td class="r"><button class="btn sm ghost" data-del="${e.id}" aria-label="Delete entry">✕</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">No entries yet</td></tr>'}</tbody></table></div></div>`;
		$("#stl").onclick = () => { const L = link(id); modal({ title: "Share statement", body: `<p class="mut" style="margin-bottom:10px">${esc(p.name)} sees their statement and a UPI QR on this page. No login needed.</p><input class="in" readonly value="${esc(L)}" onclick="this.select()"><div id="qs" style="margin:14px auto;width:160px;background:#fff;padding:8px;border-radius:10px"></div>`, actions: [{ label: "Close" }, { label: "Open page", fn: () => { window.open(L, "_blank"); return false; } }, { label: "Send on WhatsApp", cls: "pri", fn: () => { window.open(UI.wa(p.phone, "Your statement from " + set().biz + ": " + L), "_blank"); return false; } }], onOpen: () => UI.qr("#qs", L.length < 1000 ? L : L.slice(0, 900), 144) }); };
		$("#stp").onclick = () => UI.print(`<h2>${esc(set().biz)}</h2><h3>Statement: ${esc(p.name)}</h3><table><tr><th>Date</th><th>Details</th><th class="r">Gave</th><th class="r">Got</th><th class="r">Balance</th></tr>${[...E].reverse().map((e) => `<tr><td>${fdate(e.ts)}</td><td>${esc(e.note)}</td><td class="r">${e.type === "gave" ? e.amt : ""}</td><td class="r">${e.type === "got" ? e.amt : ""}</td><td class="r">${Math.abs(e.run)}</td></tr>`).join("")}</table><h3>${b >= 0 ? "Amount due" : "Amount payable"}: ${inr(Math.abs(b))}</h3>`, "Statement");
	};
	function entryForm(pid, type) {
		const p = party(pid), got = type === "got";
		form((got ? "You got from " : "You gave to ") + p.name, `${field("Amount (₹)", "amt", "", { type: "number", req: 1, attrs: 'min="1"' })}${field("Date", "date", UI.today(), { type: "date" })}${field("Note", "note", "", { ph: got ? "UPI, cash, part payment" : "What was it for?" })}`, (v) => { addEntry(pid, type, v.amt, v.note, new Date(v.date + "T12:00:00").getTime()); go(); }, { save: got ? "Save received" : "Save given" });
	}
	function remindMenu(id, tone) {
		const p = rows().find((x) => x.id === id); let t = tone || "gentle";
		modal({ title: "Remind " + p.name, body: `<div class="row sb" style="margin-bottom:10px">${tabsHtml(Object.entries(TONES), t, "data-tn")}<span class="mut">Owes ${inr(p.bal)}</span></div><textarea class="in" id="rm" rows="5">${esc(msg(p, t))}</textarea>`, onOpen: (bg) => { bg.querySelector(".tabs").onclick = (e) => { const b = e.target.closest("[data-tn]"); if (!b) return; t = b.dataset.tn; bg.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b)); $("#rm").value = msg(p, t); }; }, actions: [{ label: "Cancel" }, { label: "Open WhatsApp", cls: "pri", fn: () => { const l = S.get("log", []); l.push({ ts: Date.now(), party: id, tone: t, ch: "WhatsApp" }); S.set("log", l); window.open(UI.wa(p.phone, $("#rm").value), "_blank"); toast("Reminder logged"); } }] });
	}

	/* ---------- reminders ---------- */
	V.reminders = (c) => {
		const od = rows().filter(overdue).sort((a, b) => b.age - a.age), log = S.get("log", []).slice().reverse();
		c.innerHTML = `<div class="g21"><div class="card"><h3>Overdue customers <span class="mut">${od.length} · ${inr(od.reduce((a, p) => a + p.bal, 0))}</span></h3>${od.map((p) => `<div class="row sb" style="padding:10px 0;border-bottom:1px solid var(--line)"><div><a href="#party/${p.id}" style="text-decoration:none"><b>${esc(p.name)}</b></a><div class="mut">${p.age} days · grace ${p.grace} days${log.find((l) => l.party === p.id) ? " · last reminded " + UI.ago(log.find((l) => l.party === p.id).ts) : " · never reminded"}</div></div><div class="row"><b class="dn">${inr(p.bal)}</b>${Object.keys(TONES).map((t) => `<button class="btn sm ${t === (p.age > 60 ? "final" : p.age > 40 ? "firm" : "gentle") ? "pri" : ""}" data-rem="${p.id}|${t}">${TONES[t]}</button>`).join("")}</div></div>`).join("") || '<p class="empty">Nobody is past their grace period.</p>'}</div>
		<div class="stack"><div class="card"><h3>Reminder language</h3><div class="tabs" id="lg"><button data-lg="en" class="${set().lang !== "hi" ? "on" : ""}">English</button><button data-lg="hi" class="${set().lang === "hi" ? "on" : ""}">Hinglish</button></div><p class="mut" style="margin-top:10px">Messages open in WhatsApp with the text filled in. You press send.</p></div><div class="card"><h3>Reminder log</h3>${log.slice(0, 8).map((l) => `<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(party(l.party).name)}</span><span class="mut">${TONES[l.tone]} · ${UI.ago(l.ts)}</span></div>`).join("") || '<p class="empty">No reminders sent yet</p>'}</div></div></div>`;
		$("#lg").onclick = (e) => { const b = e.target.closest("[data-lg]"); if (!b) return; S.set("settings", { ...set(), lang: b.dataset.lg }); V.reminders(c); };
	};

	/* ---------- cashbook ---------- */
	let CD = sod(Date.now());
	V.cashbook = (c) => {
		const all = cash(), before = set().opening + all.filter((k) => k.ts < CD).reduce((a, k) => a + (k.type === "in" ? k.amt : -k.amt), 0), L = all.filter((k) => k.ts >= CD && k.ts < CD + day), ti = L.filter((k) => k.type === "in").reduce((a, k) => a + k.amt, 0), to = L.filter((k) => k.type === "out").reduce((a, k) => a + k.amt, 0);
		const mo = {}; all.forEach((k) => { const m = UI.mkey(k.ts); mo[m] = mo[m] || { i: 0, o: 0 }; mo[m][k.type === "in" ? "i" : "o"] += k.amt; });
		c.innerHTML = `<div class="row sb" style="margin-bottom:14px"><div class="row"><button class="btn sm" data-cd="-1">‹</button><b style="min-width:150px;text-align:center">${fdate(CD, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</b><button class="btn sm" data-cd="1" ${CD >= sod(Date.now()) ? "disabled" : ""}>›</button></div><div class="row"><button class="btn" style="color:var(--bad)" data-cb="out">− Cash out</button><button class="btn pri" data-cb="in">+ Cash in</button></div></div>
		<div class="kpis">${kpi("Opening balance", inr(before), "start of day")}${kpi("Cash in", inr(ti), L.filter((k) => k.type === "in").length + " entries", "up")}${kpi("Cash out", inr(to), L.filter((k) => k.type === "out").length + " entries", "dn")}${kpi("Closing balance", inr(before + ti - to), "end of day")}</div>
		<div class="g21"><div class="card"><h3>Entries</h3>${table([{ k: "t", label: "Time", fmt: (k) => new Date(k.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }, { k: "c", label: "Category", fmt: (k) => `<b>${esc(k.cat)}</b><div class="mut">${esc(k.note || "")}</div>` }, { k: "m", label: "Mode", fmt: (k) => chip(k.mode, "mut") }, { k: "a", label: "Amount", cls: "r", fmt: (k) => `<b class="${k.type === "in" ? "up" : "dn"}">${k.type === "in" ? "+" : "-"}${inr(k.amt)}</b>` }], L, { empty: "No entries on this day." })}</div><div class="card"><h3>By month</h3>${UI.table([{ k: "m", label: "Month" }, { k: "i", label: "In", cls: "r" }, { k: "o", label: "Out", cls: "r" }, { k: "n", label: "Net", cls: "r" }], []).replace(/<tbody>[\s\S]*<\/tbody>/, "<tbody>" + Object.entries(mo).sort().reverse().map(([m, v]) => `<tr><td>${UI.mname(m)}</td><td class="r up">${inrc(v.i)}</td><td class="r dn">${inrc(v.o)}</td><td class="r"><b>${inrc(v.i - v.o)}</b></td></tr>`).join("") + "</tbody>")}</div></div>`;
	};
	function cashForm(t) {
		const cats = t === "in" ? ["Counter sales", "UPI received", "Other income"] : ["Milk purchase", "Raw material", "Packaging", "Salary", "Rent", "Electricity", "Transport", "Tea and snacks", "Repairs", "Other"];
		form(t === "in" ? "Cash in" : "Cash out", `${field("Amount (₹)", "amt", "", { type: "number", req: 1 })}<div class="row2">${field("Category", "cat", cats[0], { type: "select", opts: cats })}${field("Mode", "mode", "Cash", { type: "select", opts: ["Cash", "UPI", "Bank"] })}</div>${field("Note", "note", "")}`, (v) => { const L = cash(); L.push({ id: "k" + Date.now(), ts: Math.min(Date.now(), CD + 12 * 36e5 + (CD === sod(Date.now()) ? 0 : 0)), type: t, amt: v.amt, cat: v.cat, note: v.note, mode: v.mode }); L[L.length - 1].ts = CD === sod(Date.now()) ? Date.now() : CD + 18 * 36e5; S.set("cash", L); toast("Entry saved"); go(); });
	}

	/* ---------- reports ---------- */
	V.reports = (c) => {
		const R = rows().filter((p) => p.kind === "c" && p.bal > 0), bk = [["0 to 7 days", 0, 7], ["8 to 30 days", 8, 30], ["31 to 60 days", 31, 60], ["Over 60 days", 61, 9999]].map(([label, a, b]) => ({ label, value: R.filter((p) => p.age >= a && p.age <= b).reduce((x, p) => x + p.bal, 0), n: R.filter((p) => p.age >= a && p.age <= b).length }));
		const m = {}; cash().forEach((k) => { if (k.type === "out") m[k.cat] = (m[k.cat] || 0) + (k.ts > Date.now() - 30 * day ? k.amt : 0); });
		c.innerHTML = `<div class="g2" style="margin-bottom:16px"><div class="card"><h3>Money outside, by age <span class="mut">${inr(R.reduce((a, p) => a + p.bal, 0))}</span></h3>${hbars(bk.map((b, i) => ({ ...b, color: ["#16a34a", "#f59e0b", "#ea580c", "#dc2626"][i] })), { fmt: inrc, lw: "110px" })}<p class="mut">${bk.map((b) => b.n + " in " + b.label.toLowerCase()).join(", ")}</p></div><div class="card"><h3>Spending, last 30 days</h3>${donut(Object.entries(m).map(([label, value]) => ({ label, value })).filter((x) => x.value).sort((a, b) => b.value - a.value), { center: inrc(Object.values(m).reduce((a, b) => a + b, 0)), sub: "spent" })}</div></div>
		<div class="card"><h3>Biggest balances <button class="btn sm" id="px">Export all parties</button></h3>${table([{ k: "n", label: "Party", fmt: (p) => `<a href="#party/${p.id}" style="text-decoration:none"><b>${esc(p.name)}</b></a>` }, { k: "a", label: "Pending", fmt: (p) => p.age + " days" }, { k: "b", label: "Balance", cls: "r", fmt: (p) => `<b class="dn">${inr(p.bal)}</b>` }], R.sort((a, b) => b.bal - a.bal).slice(0, 8))}</div>`;
		$("#px").onclick = () => csv([["Name", "Type", "Phone", "Balance (positive = you will get)", "Days pending"], ...rows().map((p) => [p.name, p.kind === "c" ? "Customer" : "Supplier", p.phone, p.bal, p.age])], "khata-balances.csv");
	};

	/* ---------- settings ---------- */
	V.settings = (c) => {
		const s = set();
		c.innerHTML = `<div class="g2"><div class="card"><h3>Business</h3><div class="stack">${field("Business name", "biz", s.biz)}${field("Owner", "owner", s.owner)}${field("UPI ID", "upi", s.upi)}${field("Opening cash balance (₹)", "opening", s.opening, { type: "number" })}<button class="btn pri" id="ss">Save</button></div></div><div class="stack"><div class="card"><h3>Backup</h3><p class="mut" style="margin-bottom:10px">Download everything as a file, or restore from one. Nothing is uploaded anywhere.</p><div class="row"><button class="btn" id="bk">Download backup</button><label class="btn">Restore<input type="file" id="rf" accept=".json" hidden></label></div></div><div class="card"><h3>Demo data</h3><button class="btn danger" id="rs">Reset sample data</button></div></div></div>`;
		$("#ss").onclick = () => { S.set("settings", { ...s, ...vals(c) }); $("#biz").textContent = set().biz; toast("Saved"); };
		$("#bk").onclick = () => UI.dl("khatalite-backup.json", JSON.stringify({ parties: parties(), entries: ents(), cash: cash(), settings: set() }), "application/json");
		$("#rf").onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { try { const d = JSON.parse(t); S.set("parties", d.parties); S.set("entries", d.entries); S.set("cash", d.cash); S.set("settings", d.settings); toast("Backup restored"); go(); } catch (x) { toast("That file is not a KhataLite backup"); } }); };
		$("#rs").onclick = () => confirmBox("This removes your changes and restores the sample data.", () => { S.clear(); location.reload(); }, "Reset");
	};

	/* ---------- wiring ---------- */
	const badge = () => { const n = rows().filter(overdue).length; const e = $("#n-reminders"); if (e) e.textContent = n; };
	const goR = router(V, "home", { titles: { home: "Home", parties: "Parties", party: "Party ledger", reminders: "Reminders", cashbook: "Cashbook", reports: "Reports", settings: "Settings" }, after: (n) => { if (n === "party") $$("[data-route='parties']").forEach((a) => a.classList.add("on")); } });
	const go = () => { goR(); badge(); }; $("#biz").textContent = set().biz; badge();
	document.addEventListener("click", (e) => {
		const t = e.target.closest("button"); if (!t) return;
		if (t.dataset.rem) { const [id, tn] = t.dataset.rem.split("|"); remindMenu(id, tn); }
		else if (t.dataset.rm) remindMenu(location.hash.split("/")[1], "gentle");
		else if (t.dataset.pt) { PF.tab = t.dataset.pt; V.parties($("#view")); }
		else if (t.dataset.ent) entryForm(location.hash.split("/")[1], t.dataset.ent);
		else if (t.dataset.del) confirmBox("Delete this entry? The balance will change.", () => { S.set("entries", ents().filter((x) => x.id !== t.dataset.del)); go(); }, "Delete");
		else if (t.dataset.cd) { CD += +t.dataset.cd * day; V.cashbook($("#view")); }
		else if (t.dataset.cb) cashForm(t.dataset.cb);
	});
	$("#gs").addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const v = e.target.value.trim().toLowerCase(), p = parties().find((x) => x.name.toLowerCase().includes(v)); if (p) { e.target.value = ""; location.hash = "party/" + p.id; } else toast("No party named “" + v + "”"); });
	$("#theme").onclick = () => { const d = document.body.classList.toggle("dark"); S.set("dark", d); }; if (S.get("dark", false)) document.body.classList.add("dark");
})();
