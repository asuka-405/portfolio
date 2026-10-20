/* FilePilot console (concept build): compliance calendar, filings board, document chase. */
(function () {
	const { $, $$, esc, inr, inrc, fdate, toast, modal, confirmBox, csv, bars, hbars, donut, router, table, kpi, chip, field, form, vals, wa, ago } = UI;
	const { S, TYPES, STATUS } = FP, V = {}, tn = (k) => TYPES[k].name, cl = FP.client, day = 864e5, byDue = (a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
	const st = document.createElement("style");
	st.textContent = `tr[data-f],tr[data-c]{cursor:pointer}tr[data-f]:hover,tr[data-c]:hover{background:var(--acc-soft)}
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.cal .h{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);padding:4px}
.cal .d{min-height:96px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px;cursor:pointer;display:flex;flex-direction:column;gap:3px;overflow:hidden}.cal .d:hover{border-color:var(--acc)}.cal .d.t{outline:2px solid var(--acc)}.cal .d b{font-size:.78rem}.cal .d .chip{align-self:flex-start;padding:0 7px}
.cal .e{font-size:.66rem;font-weight:700;padding:1px 5px;border-radius:5px;background:var(--acc-soft);color:var(--acc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cal .e.bad{background:rgba(220,38,38,.14);color:var(--bad)}.cal .e.ok{background:rgba(22,163,74,.14);color:var(--ok)}
.brd{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:start}.bc{background:color-mix(in srgb,var(--panel) 80%,var(--ink) 6%);border:1px solid var(--line);border-radius:14px;padding:10px;display:grid;gap:8px;min-height:120px}.bc h4{display:flex;justify-content:space-between;font-size:.86rem;padding:2px 2px 4px}
.fc{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px;cursor:pointer;display:grid;gap:4px}.fc:hover{border-color:var(--acc)}.fc b{font-size:.9rem}.fc .mut{font-size:.78rem}
@media(max-width:1100px){.brd{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.brd{grid-template-columns:1fr}.cal .d{min-height:48px;padding:4px}.cal .e{display:none}}`;
	document.head.appendChild(st);
	const stChip = (f) => (FP.overdue(f) ? chip("Overdue " + -FP.daysTo(f.due) + "d", "bad") : chip(STATUS.find((s) => s[0] === f.st)[1], { awaiting: "warn", working: "info", review: "", filed: "ok" }[f.st]));
	const rel = (d) => { const n = FP.daysTo(d); return n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? "in " + n + " days" : -n + (n === -1 ? " day" : " days") + " ago"; };
	const owner1 = (id) => esc(FP.member(id).name.split(" ")[0]);
	const FCOLS = [
		{ k: "c", label: "Client", fmt: (f) => `<b>${esc(cl(f.client).name)}</b>` },
		{ k: "t", label: "Filing", fmt: (f) => `<span style="white-space:nowrap">${tn(f.type)}</span><div class="mut" style="font-size:.76rem">${esc(f.period)}</div>` },
		{ k: "d", label: "Due", fmt: (f) => `${fdate(f.due, { day: "numeric", month: "short" })}<div class="mut" style="font-size:.76rem">${rel(f.due)}</div>` },
		{ k: "s", label: "Status", fmt: stChip },
		{ k: "o", label: "Owner", fmt: (f) => owner1(f.owner) },
	];
	const frows = (L, empty) => table(FCOLS, L, { rowAttr: (f) => `data-f="${f.id}"`, empty });
	const ackNo = (f) => ["GST", "ITD", "TRN"][f.type === "itr" || f.type === "advtax" ? 1 : f.type.startsWith("tds") ? 2 : 0] + "-" + (100000 + Math.floor(Math.random() * 899999));
	function setSt(id, s) { const f = FP.filings().find((x) => x.id === id); if (f.st === s) return; const p = { st: s }; if (s === "filed") { p.filedOn = FP.today(); p.ack = ackNo(f); } else { p.filedOn = ""; p.ack = ""; } FP.patch(id, p); FP.logEv((s === "filed" ? "Filed " : "Moved ") + tn(f.type) + " for " + cl(f.client).name + (s === "filed" ? "" : " to " + STATUS.find((x) => x[0] === s)[1]), f.client); toast(s === "filed" ? "Marked filed. Acknowledgement saved." : "Status updated"); go(); }

	V.dashboard = (c) => {
		const F = FP.filings(), O = F.filter((f) => f.st !== "filed"), ov = O.filter(FP.overdue), wk = O.filter((f) => !FP.overdue(f) && FP.daysTo(f.due) <= 7), aw = O.filter((f) => f.st === "awaiting" && FP.daysTo(f.due) <= 14), mk = FP.today().slice(0, 7), fm = F.filter((f) => f.st === "filed" && f.filedOn.slice(0, 7) === mk);
		const list = [...ov.sort(byDue), ...wk.sort(byDue)].slice(0, 12), colr = ["#f59e0b", "#0284c7", "#0d9488"], byS = STATUS.slice(0, 3).map(([k, n], i) => ({ label: n, value: O.filter((f) => f.st === k).length, color: colr[i] })), wl = FP.team().slice(1).map((t) => ({ label: t.name, value: O.filter((f) => f.owner === t.id).length }));
		const ev = [...S.get("log", []), ...F.filter((f) => f.st === "filed").map((f) => ({ ts: UI.pd(f.filedOn).getTime(), text: "Filed " + tn(f.type) + " for " + cl(f.client).name }))].sort((a, b) => b.ts - a.ts).slice(0, 6);
		c.innerHTML = `<div class="kpis">${kpi("Due in 7 days", wk.length, "filings coming up")}${kpi("Overdue", ov.length, ov.length ? "needs action today" : "all clear", ov.length ? "dn" : "up")}${kpi("Awaiting documents", aw.length, "needed in the next 14 days")}${kpi("Filed this month", fm.length, "with acknowledgement", "up")}</div>
		<div class="g2"><div class="card"><div class="row sb"><h3>Needs attention</h3><a class="btn sm" href="#filings">All filings</a></div>${frows(list, "Nothing due this week.")}</div>
		<div class="stack"><div class="card"><h3>Open filings by status</h3>${donut(byS, { center: O.length, sub: "open" })}</div><div class="card"><h3>Workload by person</h3>${hbars(wl, { lw: "120px" })}</div><div class="card"><h3>Recent activity</h3>${ev.map((e) => `<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--line);font-size:.86rem"><span>${esc(e.text)}</span><span class="mut">${ago(e.ts)}</span></div>`).join("")}</div></div></div>`;
	};

	let cal = { y: new Date().getFullYear(), m: new Date().getMonth() };
	V.calendar = (c) => {
		const { y, m } = cal, start = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), by = {}; FP.filings().forEach((f) => (by[f.due] = by[f.due] || []).push(f));
		let cells = ""; for (let i = 0; i < start; i++) cells += "<div></div>";
		for (let d = 1; d <= n; d++) { const k = UI.iso(new Date(y, m, d)), L = by[k] || [], bad = L.some(FP.overdue); cells += `<div class="d ${k === FP.today() ? "t" : ""}" data-day="${k}"><b>${d}</b>${L.length ? `<span class="chip ${bad ? "bad" : ""}">${L.length}</span>` : ""}${L.slice(0, 2).map((f) => `<span class="e ${f.st === "filed" ? "ok" : FP.overdue(f) ? "bad" : ""}">${tn(f.type)}</span>`).join("")}</div>`; }
		c.innerHTML = `<div class="card"><div class="row sb" style="margin-bottom:12px"><h3 style="margin:0">${new Date(y, m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3><div class="row"><button class="btn sm" id="cp">‹ Prev</button><button class="btn sm" id="ct">Today</button><button class="btn sm" id="cn">Next ›</button></div></div><div class="cal">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => `<div class="h">${x}</div>`).join("")}${cells}</div><div class="legend" style="margin-top:12px"><span><i style="background:var(--acc)"></i>Due</span><span><i style="background:var(--bad)"></i>Overdue</span><span><i style="background:var(--ok)"></i>Filed</span><span>Tap a day to see its filings</span></div></div>`;
		const mv = (k) => () => { cal = k ? (({ y, m }) => ({ y: m + k > 11 ? y + 1 : m + k < 0 ? y - 1 : y, m: (m + k + 12) % 12 }))(cal) : { y: new Date().getFullYear(), m: new Date().getMonth() }; go(); };
		$("#cp").onclick = mv(-1); $("#cn").onclick = mv(1); $("#ct").onclick = mv(0);
		$$("[data-day]").forEach((el) => (el.onclick = () => { const L = (by[el.dataset.day] || []).slice().sort(byDue); modal({ title: "Due on " + fdate(el.dataset.day, { weekday: "long", day: "numeric", month: "long" }), wide: true, body: L.length ? frows(L) : '<p class="mut">No filings fall on this day.</p>' }); }));
	};

	let FF = { q: "", type: "", own: "", view: "board" };
	V.filings = (c) => {
		const lim = UI.iso(new Date(Date.now() - 14 * day)), L = FP.filings().filter((f) => (!FF.q || (cl(f.client).name + tn(f.type)).toLowerCase().includes(FF.q.toLowerCase())) && (!FF.type || f.type === FF.type) && (!FF.own || f.owner === FF.own)).sort(byDue);
		const ctl = `<div class="row" style="margin-bottom:14px;flex-wrap:wrap"><input class="in" id="fq" placeholder="Search client or filing" value="${esc(FF.q)}" style="max-width:220px"><select class="in" id="ft" style="width:auto"><option value="">All filings</option>${Object.keys(TYPES).map((k) => `<option value="${k}" ${FF.type === k ? "selected" : ""}>${tn(k)}</option>`).join("")}</select><select class="in" id="fo" style="width:auto"><option value="">Everyone</option>${FP.team().map((t) => `<option value="${t.id}" ${FF.own === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select><span class="sp"></span>${UI.tabsHtml([["board", "Board"], ["list", "List"]], FF.view, "data-v")}<button class="btn sm" id="fx">Export</button></div>`;
		if (FF.view === "board") {
			const vis = L.filter((f) => f.st !== "filed" || f.filedOn >= lim);
			c.innerHTML = ctl + `<p class="mut" style="margin-bottom:10px">Drag a card to a new column to change its status. Filed shows the last 14 days.</p><div class="brd">${STATUS.map(([k, n]) => { const col = vis.filter((f) => f.st === k); return `<div class="bc" data-col="${k}"><h4>${n} <span class="chip mut">${col.length}</span></h4>${col.slice(0, 10).map((f) => `<div class="fc" draggable="true" data-f="${f.id}"><b>${esc(cl(f.client).name)}</b><span class="mut">${tn(f.type)} · ${esc(f.period)}</span><div class="row sb">${FP.overdue(f) ? chip(-FP.daysTo(f.due) + "d late", "bad") : chip(f.st === "filed" ? "Filed " + fdate(f.filedOn, { day: "numeric", month: "short" }) : "Due " + fdate(f.due, { day: "numeric", month: "short" }), f.st === "filed" ? "ok" : "mut")}<span class="mut">${owner1(f.owner)}</span></div></div>`).join("")}${col.length > 10 ? `<p class="mut c">+ ${col.length - 10} more, see the list</p>` : ""}</div>`; }).join("")}</div>`;
			$$(".fc").forEach((el) => el.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", el.dataset.f)));
			$$(".bc").forEach((col) => { col.addEventListener("dragover", (e) => { e.preventDefault(); col.style.outline = "2px dashed var(--acc)"; }); col.addEventListener("dragleave", () => (col.style.outline = "")); col.addEventListener("drop", (e) => { e.preventDefault(); col.style.outline = ""; const id = e.dataTransfer.getData("text/plain"); if (id) setSt(id, col.dataset.col); }); });
		} else c.innerHTML = ctl + `<div class="card" style="padding:0">${frows(L.slice(0, 150), "No filings match.")}</div><p class="mut" style="margin-top:8px">${L.length} filings${L.length > 150 ? ", showing the first 150" : ""}.</p>`;
		const rf = (id, k) => { $(id).oninput = $(id).onchange = (e) => { FF[k] = e.target.value; const p = e.target.selectionStart; go(); if (k === "q") { const q = $("#fq"); q.focus(); q.setSelectionRange(p, p); } }; };
		rf("#fq", "q"); rf("#ft", "type"); rf("#fo", "own");
		$$("[data-v]").forEach((b) => (b.onclick = () => { FF.view = b.dataset.v; go(); }));
		$("#fx").onclick = () => csv([["Client", "Filing", "Period", "Due", "Status", "Owner", "Acknowledgement"], ...L.map((f) => [cl(f.client).name, tn(f.type), f.period, f.due, f.st, FP.member(f.owner).name, f.ack])], "filings.csv");
	};

	function fileOpen(id) {
		const f = FP.filings().find((x) => x.id === id), c = cl(f.client), miss = FP.missing(f);
		modal({ title: `${esc(tn(f.type))} <span class="mut" style="font-size:.9rem">${esc(f.period)}</span>`, wide: true, body: `<div class="g2"><div class="stack"><div class="card"><b>${esc(c.name)}</b><div class="mut" style="margin:4px 0">${esc(c.kind)} · PAN ${c.pan}${c.gstin ? " · GSTIN " + c.gstin : ""}</div><div class="row" style="margin:8px 0">${stChip(f)}<span class="mut">Due ${fdate(f.due)}, ${rel(f.due)}</span></div><p class="mut">${esc(TYPES[f.type].full)}</p>${f.ack ? `<div class="note" style="margin-top:8px">Filed ${fdate(f.filedOn)}. Acknowledgement ${f.ack}</div>` : ""}</div><div class="card"><h3>Work</h3><div class="row2">${field("Status", "st", f.st, { type: "select", opts: STATUS })}${field("Owner", "owner", f.owner, { type: "select", opts: FP.team().map((t) => [t.id, t.name]) })}</div><div style="margin-top:10px">${field("Note", "note", f.note, { type: "textarea", rows: 2 })}</div></div></div>
		<div class="stack"><div class="card"><h3>Documents <span class="chip ${miss.length ? "warn" : "ok"}">${miss.length ? miss.length + " missing" : "all received"}</span></h3>${f.docs.map((d, i) => `<label class="row" style="gap:8px;padding:6px 0"><input type="checkbox" data-doc="${i}" ${d.got ? "checked" : ""}> ${esc(d.n)}</label>`).join("")}<div class="row" style="margin-top:10px">${miss.length ? `<a class="btn sm pri" id="fw" target="_blank" rel="noopener" href="${wa(c.phone, FP.waMsg(c, f))}">Ask on WhatsApp</a>` : ""}<a class="btn sm" href="portal.html?c=${c.id}" target="_blank" rel="noopener">Client portal</a></div></div></div></div>`,
			actions: [{ label: "Close" }, { label: "Save", cls: "pri", fn: (bg) => { const m = bg.querySelector("#modal-body"), v = vals(m), docs = f.docs.map((d, i) => ({ n: d.n, got: m.querySelector(`[data-doc="${i}"]`).checked })), p = { owner: v.owner, note: v.note, docs }; let s = v.st; if (s === "awaiting" && docs.every((d) => d.got)) s = "working"; if (s !== f.st) { p.st = s; p.filedOn = s === "filed" ? FP.today() : ""; p.ack = s === "filed" ? f.ack || ackNo(f) : ""; FP.logEv((s === "filed" ? "Filed " : "Updated ") + tn(f.type) + " for " + c.name, c.id); } FP.patch(id, p); toast("Saved"); go(); } }],
			onOpen: (bg) => { const w = bg.querySelector("#fw"); if (w) w.addEventListener("click", () => { FP.patch(id, { remind: Date.now() }); FP.logEv("Asked " + c.name + " for documents on WhatsApp", c.id); }); } });
	}

	V.chase = (c) => {
		const L = FP.filings().filter((f) => f.st === "awaiting" && FP.daysTo(f.due) <= 21).sort(byDue), urg = L.filter((f) => FP.daysTo(f.due) <= 3), rem = L.filter((f) => f.remind > Date.now() - 7 * day);
		const cols = [FCOLS[0], FCOLS[1], { k: "m", label: "Missing documents", fmt: (f) => FP.missing(f).map((d) => chip(d.n, "warn")).join(" ") }, FCOLS[2], { k: "r", label: "Last reminder", fmt: (f) => (f.remind ? ago(f.remind) : '<span class="mut">Never</span>') }, { k: "a", label: "", fmt: (f) => `<a class="btn sm pri" target="_blank" rel="noopener" data-rem="${f.id}" href="${wa(cl(f.client).phone, FP.waMsg(cl(f.client), f))}">WhatsApp</a>` }];
		c.innerHTML = `<div class="kpis">${kpi("Waiting on clients", L.length, "filings blocked by documents")}${kpi("Due within 3 days", urg.length, urg.length ? "chase these first" : "none", urg.length ? "dn" : "up")}${kpi("Reminded this week", rem.length, "on WhatsApp", "up")}</div><div class="card" style="padding:0"><div style="padding:16px 18px 0"><h3>Document chase list</h3><p class="mut">Each button opens WhatsApp with a message that lists the missing papers and a private upload link for the client.</p></div>${table(cols, L.slice(0, 40), { rowAttr: (f) => `data-f="${f.id}"`, empty: "No one is holding anything up." })}</div>`;
	};

	let CQ = "";
	V.clients = (c) => {
		const F = FP.filings(), L = FP.clients().filter((x) => !CQ || (x.name + x.contact + x.pan).toLowerCase().includes(CQ.toLowerCase()));
		const cols = [{ k: "n", label: "Client", fmt: (x) => `<b>${esc(x.name)}</b><div class="mut" style="font-size:.76rem">${esc(x.kind)}</div>` }, { k: "s", label: "Services", fmt: (x) => x.sv.map((k) => chip(FP.SVC[k] || k, "mut")).join(" ") }, { k: "o", label: "Open", cls: "r", fmt: (x) => F.filter((f) => f.client === x.id && f.st !== "filed").length }, { k: "l", label: "Overdue", cls: "r", fmt: (x) => { const n = F.filter((f) => f.client === x.id && FP.overdue(f)).length; return n ? chip(n, "bad") : "0"; } }, { k: "f", label: "Retainer", cls: "r", fmt: (x) => inr(x.fee) + "/mo" }, { k: "w", label: "Owner", fmt: (x) => owner1(x.owner) }];
		c.innerHTML = `<div class="row" style="margin-bottom:14px"><input class="in" id="cq" placeholder="Search clients" value="${esc(CQ)}" style="max-width:240px"><span class="sp"></span><span class="mut">${L.length} clients</span><button class="btn pri" id="nc">+ Add client</button></div><div class="card" style="padding:0">${table(cols, L, { rowAttr: (x) => `data-c="${x.id}"`, empty: "No client found." })}</div>`;
		$("#cq").oninput = (e) => { CQ = e.target.value; const p = e.target.selectionStart; go(); $("#cq").focus(); $("#cq").setSelectionRange(p, p); }; $("#nc").onclick = newClient;
	};
	function newClient() {
		form("Add client", `<div class="row2">${field("Name", "name", "", { req: 1 })}${field("Type", "kind", "Proprietorship", { type: "select", opts: FP.KIND })}</div><div class="row2" style="margin-top:10px">${field("Contact person", "contact", "")}${field("Mobile", "phone", "", { type: "tel" })}</div><div class="row2" style="margin-top:10px">${field("Monthly retainer (₹)", "fee", 2500, { type: "number" })}${field("Handled by", "owner", FP.team()[1].id, { type: "select", opts: FP.team().slice(1).map((t) => [t.id, t.name]) })}</div><p class="mut" style="margin:12px 0 4px">Services (due dates are created from these)</p><div class="row2">${Object.entries(FP.SVC).map(([k, n]) => field(n, "sv_" + k, ["gst", "itr"].includes(k), { type: "check" })).join("")}</div>`, (v) => { const sv = Object.keys(FP.SVC).filter((k) => v["sv_" + k]); if (!sv.length) { toast("Pick at least one service"); return false; } const c = FP.addClient({ name: v.name, kind: v.kind, contact: v.contact || v.name, phone: v.phone, fee: +v.fee || 0, owner: v.owner, sv, pan: "", gstin: "" }); toast("Added. Due dates are on the calendar."); go(); setTimeout(() => clientOpen(c.id), 40); }, { wide: true });
	}
	function clientOpen(id) {
		const c = cl(id), F = FP.filings().filter((f) => f.client === id), O = F.filter((f) => f.st !== "filed").sort(byDue), done = F.filter((f) => f.st === "filed");
		modal({ title: esc(c.name) + ` <span class="mut" style="font-size:.9rem">${esc(c.kind)}</span>`, wide: true, body: `<div class="g2"><div class="stack"><div class="card"><div class="mut">Contact</div><b>${esc(c.contact)}</b> · ${c.phone || "no number"}<div class="mut" style="margin-top:8px">PAN ${c.pan || "pending"}${c.gstin ? " · GSTIN " + c.gstin : ""}</div><div style="margin:10px 0">${c.sv.map((k) => chip(FP.SVC[k] || k)).join(" ")}</div><div class="row sb"><span>Retainer <b>${inr(c.fee)}/mo</b></span><span class="mut">Client since ${fdate(c.since, { month: "short", year: "numeric" })}</span></div><div class="row" style="margin-top:12px">${c.phone ? `<a class="btn sm" target="_blank" rel="noopener" href="${wa(c.phone, "Hi " + c.contact.split(" ")[0] + ", this is " + FP.settings().name + ".")}">WhatsApp</a>` : ""}<a class="btn sm" target="_blank" rel="noopener" href="portal.html?c=${c.id}">Client portal</a></div></div><div class="card"><h3>Track record</h3><p>${done.length} filed, ${done.filter((f) => f.filedOn <= f.due).length} on time.</p></div></div><div class="card" style="padding:0"><div style="padding:14px 16px 0"><h3>Open filings</h3></div>${frows(O.slice(0, 8), "Nothing open.")}</div></div>` });
	}

	V.reports = (c) => {
		const F = FP.filings(), done = F.filter((f) => f.st === "filed"), ontime = done.filter((f) => f.filedOn <= f.due), early = done.reduce((a, f) => a + FP.daysTo(f.due) * 0 + Math.round((UI.pd(f.due) - UI.pd(f.filedOn)) / day), 0) / (done.length || 1), ov = F.filter(FP.overdue);
		const est = (f) => { const d = -FP.daysTo(f.due); return f.type === "gstr1" || f.type === "gstr3b" ? Math.min(50 * d, 5000) : f.type === "tdsret" ? Math.min(200 * d, 10000) : f.type === "itr" ? 5000 : f.type === "roc" ? 100 * d : 0; };
		const mo = {}; F.forEach((f) => { const k = f.due.slice(0, 7); mo[k] = mo[k] || { t: 0, d: 0 }; mo[k].t++; if (f.st === "filed") mo[k].d++; });
		const months = Object.keys(mo).sort().map((k) => ({ label: UI.mname(k).split(" ")[0], value: mo[k].t })), bt = Object.keys(TYPES).map((k) => ({ label: tn(k), value: F.filter((f) => f.type === k).length })).sort((a, b) => b.value - a.value);
		const cols = [FCOLS[0], FCOLS[1], FCOLS[2], { k: "e", label: "Estimated late fee", cls: "r", fmt: (f) => (est(f) ? inr(est(f)) : '<span class="mut">interest only</span>') }];
		c.innerHTML = `<div class="kpis">${kpi("On-time filing rate", Math.round((ontime.length / (done.length || 1)) * 100) + "%", done.length + " filed in this window", "up")}${kpi("Filed before due date", early.toFixed(1) + " days", "on average")}${kpi("Monthly retainers", inrc(FP.clients().reduce((a, x) => a + x.fee, 0)), FP.clients().length + " clients")}${kpi("Late fee exposure", inr(ov.reduce((a, f) => a + est(f), 0)), ov.length + " overdue filings", ov.length ? "dn" : "up")}</div>
		<div class="g2"><div class="card"><h3>Filings by due month</h3>${bars(months, { h: 200 })}</div><div class="card"><h3>Filings by type</h3>${hbars(bt, { lw: "130px" })}</div></div>
		<div class="card" style="padding:0;margin-top:16px"><div class="row sb" style="padding:16px 18px 0"><h3>Late fee exposure</h3><button class="btn sm" id="rx">Export</button></div><p class="mut" style="padding:0 18px 8px">Rough estimate from per-day fees. Check the current rules before quoting a client.</p>${table(cols, ov.sort(byDue), { rowAttr: (f) => `data-f="${f.id}"`, empty: "No overdue filings." })}</div>`;
		$("#rx").onclick = () => csv([["Client", "Filing", "Due", "Estimated late fee"], ...ov.map((f) => [cl(f.client).name, tn(f.type), f.due, est(f)])], "late-fee-exposure.csv");
	};

	V.settings = (c) => {
		const s = FP.settings(), link = location.href.replace(/[^/]*$/, "") + "portal.html";
		c.innerHTML = `<div class="g2"><div class="card"><h3>Firm</h3><div class="stack">${field("Firm name", "name", s.name)}${field("Address", "addr", s.addr)}<div class="row2">${field("FRN", "frn", s.frn)}${field("Phone", "phone", s.phone)}</div><button class="btn pri" id="ss">Save</button></div></div><div class="stack"><div class="card"><h3>Client portal</h3><p class="mut" style="margin-bottom:10px">Send each client their private link. They tick off and upload the documents you asked for, and your chase list updates.</p><div class="row" style="gap:16px;align-items:center"><div id="qr"></div><a class="btn" href="portal.html" target="_blank" rel="noopener">Open the client portal</a></div></div><div class="card"><h3>Demo data</h3><button class="btn danger" id="rs">Reset sample data</button></div></div></div>`;
		UI.qr("#qr", link, 112); $("#ss").onclick = () => { S.set("settings", { ...s, ...vals(c) }); $("#biz").textContent = FP.settings().name; toast("Saved"); };
		$("#rs").onclick = () => confirmBox("This removes your changes and restores the sample firm.", () => { S.clear(); location.reload(); }, "Reset");
	};

	const goR = router(V, "dashboard", { titles: { dashboard: "Dashboard", calendar: "Compliance calendar", filings: "Filings", chase: "Document chase", clients: "Clients", reports: "Reports", settings: "Settings" } }), go = () => { goR(); badge(); };
	const badge = () => { const n = $("#n-chase"); if (n) n.textContent = FP.filings().filter((f) => f.st === "awaiting" && FP.daysTo(f.due) <= 7).length; }; $("#biz").textContent = FP.settings().name; badge();
	document.addEventListener("click", (e) => {
		const r = e.target.closest("[data-rem]"); if (r) { const f = FP.filings().find((x) => x.id === r.dataset.rem); FP.patch(f.id, { remind: Date.now() }); FP.logEv("Asked " + cl(f.client).name + " for documents on WhatsApp", f.client); setTimeout(go, 200); return; }
		if (e.target.closest("a,button,select,input,label")) return;
		const f = e.target.closest("[data-f]"); if (f) return fileOpen(f.dataset.f);
		const k = e.target.closest("[data-c]"); if (k) clientOpen(k.dataset.c);
	});
	$("#gs").addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const v = e.target.value.trim().toLowerCase(), c = FP.clients().find((x) => (x.name + x.contact + x.pan).toLowerCase().includes(v)); if (c) { e.target.value = ""; clientOpen(c.id); } else toast("No client found for “" + v + "”"); });
	$("#theme").onclick = () => { const d = document.body.classList.toggle("dark"); S.set("dark", d); }; if (S.get("dark", false)) document.body.classList.add("dark");
})();
