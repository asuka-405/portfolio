/* Shared helpers for the Works tools: storage, formatting, charts, modals, routing. */
(function () {
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => [...r.querySelectorAll(s)];
	const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
	const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
	const inrc = (n) => (n >= 1e7 ? "₹" + (n / 1e7).toFixed(2) + " Cr" : n >= 1e5 ? "₹" + (n / 1e5).toFixed(2) + " L" : n >= 1e3 ? "₹" + (n / 1e3).toFixed(1) + "k" : "₹" + Math.round(n));
	const num = (n) => Math.round(n).toLocaleString("en-IN");
	const pct = (n, d = 1) => (n * 100).toFixed(d) + "%";
	const iso = (d) => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
	const pd = (s) => (typeof s === "string" && s.length === 10 ? new Date(s + "T00:00:00") : new Date(s));
	const addDays = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return x; };
	const fdate = (d, o) => pd(d).toLocaleDateString("en-IN", o || { day: "numeric", month: "short", year: "numeric" });
	const hash = (s) => { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };
	const rng = (seed) => { let s = (typeof seed === "number" ? seed : hash(seed)) % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
	const initials = (n) => String(n).split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
	const uid = (p = "id") => p + Math.random().toString(36).slice(2, 8);

	function store(prefix) { return { get(k, d) { try { const v = localStorage.getItem(prefix + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(prefix + k, JSON.stringify(v)); } catch (e) {} }, clear() { Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k)); } }; }

	function toast(msg) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2400); }

	function modal(opts) { // {title, body(html), actions:[{label, cls, fn}], wide, onOpen}
		let bg = $("#modal-bg"); if (!bg) { bg = document.createElement("div"); bg.id = "modal-bg"; bg.className = "modal-bg"; bg.addEventListener("mousedown", (e) => { if (e.target === bg) close(); }); document.body.appendChild(bg); document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); }); }
		bg.innerHTML = `<div class="modal ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true"><h2>${opts.title || ""}</h2><div id="modal-body">${opts.body || ""}</div><div class="foot">${(opts.actions || [{ label: "Close" }]).map((a, i) => `<button class="btn ${a.cls || ""}" data-ma="${i}">${a.label}</button>`).join("")}</div></div>`;
		bg.onclick = (e) => { const b = e.target.closest("[data-ma]"); if (!b) return; const a = (opts.actions || [{}])[+b.dataset.ma]; const r = a.fn ? a.fn(bg) : undefined; if (r !== false) close(); };
		bg.classList.add("on"); if (opts.onOpen) opts.onOpen(bg); const f = bg.querySelector("input,select,textarea"); if (f) f.focus(); return bg;
	}
	function close() { const bg = $("#modal-bg"); if (bg) bg.classList.remove("on"); }
	function confirmBox(msg, fn, label = "Confirm") { modal({ title: "Are you sure?", body: `<p>${msg}</p>`, actions: [{ label: "Cancel" }, { label, cls: "pri", fn: () => { fn(); } }] }); }

	function csv(rows, name) { const b = new Blob([rows.map((r) => r.map((c) => '"' + String(c ?? "").replace(/"/g, '""') + '"').join(",")).join("\n")], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name || "export.csv"; a.click(); }
	function parseCSV(text) { const rows = []; let cur = [], f = "", q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; cur.push(f); rows.push(cur); cur = []; f = ""; } else f += c; } if (f || cur.length) { cur.push(f); rows.push(cur); } return rows.filter((r) => r.some((x) => x.trim())); }

	/* ---------- charts (inline SVG) ---------- */
	const PAL = ["var(--acc)", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
	function line(series, o = {}) { // series: [{name, color, data:[{x,y,label}]}]
		const W = o.w || 640, H = o.h || 240, P = { l: 52, r: 14, t: 14, b: 28 }, all = series.flatMap((s) => s.data.map((d) => d.y)), mx = (o.max != null ? o.max : Math.max(...all, 1)) * 1.08, mn = o.min != null ? o.min : 0, n = series[0].data.length, f = o.fmt || ((v) => num(v));
		const x = (i) => P.l + (n === 1 ? 0 : i / (n - 1)) * (W - P.l - P.r), y = (v) => P.t + (1 - (v - mn) / (mx - mn || 1)) * (H - P.t - P.b);
		let g = ""; for (let t = 0; t <= 4; t++) { const v = mn + (mx - mn) * t / 4; g += `<line class="gl" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${f(v)}</text>`; }
		const step = Math.ceil(n / 7); series[0].data.forEach((d, i) => { if (i % step === 0) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(d.label ?? d.x)}</text>`; });
		const body = series.map((s, si) => { const c = s.color || PAL[si % PAL.length], pts = s.data.map((d, i) => x(i).toFixed(1) + "," + y(d.y).toFixed(1)); return (o.area && si === 0 ? `<polygon points="${P.l},${H - P.b} ${pts.join(" ")} ${x(n - 1)},${H - P.b}" fill="${c}" opacity=".12"/>` : "") + `<polyline points="${pts.join(" ")}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`; }).join("");
		const id = uid("ch"); const svg = `<svg id="${id}" class="chart" viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${g}${body}<line id="${id}l" y1="${P.t}" y2="${H - P.b}" stroke="var(--mut)" stroke-dasharray="3" opacity="0"/><rect data-hit x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}" fill="transparent"/></svg>`;
		setTimeout(() => { const el = document.getElementById(id); if (!el) return; const hit = el.querySelector("[data-hit]"), l = document.getElementById(id + "l"); let tip = document.getElementById("chart-tip"); if (!tip) { tip = document.createElement("div"); tip.id = "chart-tip"; tip.style.cssText = "position:fixed;pointer-events:none;background:var(--ink);color:var(--bg);padding:6px 10px;border-radius:8px;font-size:12px;z-index:200;opacity:0;white-space:nowrap"; document.body.appendChild(tip); }
			hit.onmousemove = (e) => { const b = el.getBoundingClientRect(), px = (e.clientX - b.left) / b.width * W, i = Math.max(0, Math.min(n - 1, Math.round((px - P.l) / (W - P.l - P.r) * (n - 1)))); l.setAttribute("x1", x(i)); l.setAttribute("x2", x(i)); l.setAttribute("opacity", 1); tip.style.opacity = 1; tip.style.left = e.clientX + 14 + "px"; tip.style.top = e.clientY - 10 + "px"; tip.innerHTML = `<b>${esc(series[0].data[i].label ?? series[0].data[i].x)}</b><br>` + series.map((s) => `${s.name ? esc(s.name) + ": " : ""}${f(s.data[i].y)}`).join("<br>"); };
			hit.onmouseleave = () => { tip.style.opacity = 0; l.setAttribute("opacity", 0); }; }, 0);
		return svg;
	}
	function bars(data, o = {}) { // data: [{label, value, color}]
		const W = o.w || 640, H = o.h || 220, P = { l: 8, r: 8, t: 18, b: 28 }, mx = Math.max(...data.map((d) => d.value), 1) * 1.1, bw = (W - P.l - P.r) / data.length, f = o.fmt || ((v) => num(v));
		return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${data.map((d, i) => { const h = d.value / mx * (H - P.t - P.b), x = P.l + i * bw + bw * 0.15; return `<rect x="${x}" y="${H - P.b - h}" width="${bw * 0.7}" height="${h}" rx="5" fill="${d.color || "var(--acc)"}"><title>${esc(d.label)}: ${f(d.value)}</title></rect><text x="${x + bw * 0.35}" y="${H - P.b - h - 5}" text-anchor="middle">${f(d.value)}</text><text x="${x + bw * 0.35}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`; }).join("")}</svg>`;
	}
	function hbars(data, o = {}) { const mx = Math.max(...data.map((d) => d.value), 1), f = o.fmt || ((v) => num(v)); return data.map((d) => `<div style="display:grid;grid-template-columns:${o.lw || "130px"} 1fr 70px;gap:10px;align-items:center;margin:8px 0;font-size:.86rem"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.label)}">${esc(d.label)}</span><div class="bar"><i style="width:${d.value / mx * 100}%;${d.color ? "background:" + d.color : ""}"></i></div><b style="text-align:right">${f(d.value)}</b></div>`).join(""); }
	function donut(data, o = {}) { const tot = data.reduce((s, d) => s + d.value, 0) || 1; let a = -Math.PI / 2, s = ""; data.forEach((d, i) => { const f = d.value / tot, b = a + f * Math.PI * 2, R = 46, x1 = 60 + R * Math.cos(a), y1 = 60 + R * Math.sin(a), x2 = 60 + R * Math.cos(b), y2 = 60 + R * Math.sin(b); s += f >= 0.999 ? `<circle cx="60" cy="60" r="46" fill="none" stroke="${d.color || PAL[i % PAL.length]}" stroke-width="16"/>` : `<path d="M${x1} ${y1} A46 46 0 ${f > 0.5 ? 1 : 0} 1 ${x2} ${y2}" fill="none" stroke="${d.color || PAL[i % PAL.length]}" stroke-width="16"><title>${esc(d.label)}: ${Math.round(f * 100)}%</title></path>`; a = b; });
		return `<div style="display:grid;grid-template-columns:${o.size || 130}px 1fr;gap:16px;align-items:center"><svg viewBox="0 0 120 120" class="chart" style="width:100%"><g>${s}</g><text x="60" y="58" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:800">${esc(o.center || "")}</text><text x="60" y="72" text-anchor="middle" style="font-size:8px">${esc(o.sub || "")}</text></svg><div class="legend" style="flex-direction:column;gap:6px">${data.map((d, i) => `<span><i style="background:${d.color || PAL[i % PAL.length]}"></i>${esc(d.label)} · ${Math.round(d.value / tot * 100)}%</span>`).join("")}</div></div>`; }
	function spark(vals, o = {}) { const W = o.w || 90, H = o.h || 26, mx = Math.max(...vals), mn = Math.min(...vals), c = o.color || "var(--acc)"; const p = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - 2 - (v - mn) / (mx - mn || 1) * (H - 4)}`).join(" "); return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${p}" fill="none" stroke="${c}" stroke-width="1.8"/></svg>`; }

	/* ---------- router: <nav links data-route> + views {name: fn(container, params)} ---------- */
	function router(views, def, opts = {}) {
		const c = $(opts.container || "#view"), title = $("#title");
		function go() { const h = location.hash.slice(1) || def, [name, ...rest] = h.split("/"), v = views[name] || views[def]; $$("[data-route]").forEach((a) => a.classList.toggle("on", a.dataset.route === name)); if (title) title.textContent = (opts.titles && opts.titles[name]) || name.charAt(0).toUpperCase() + name.slice(1); $(".side")?.classList.remove("open"); window.scrollTo(0, 0); v(c, rest); if (opts.after) opts.after(name); }
		window.addEventListener("hashchange", go); go(); return go;
	}
	function table(cols, rows, o = {}) { // cols: [{k,label,fmt,cls,sort}]
		return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th class="${c.cls || ""} ${c.sort ? "s" : ""}" ${c.sort ? `data-sort="${c.k}"` : ""}>${c.label}${o.sortKey === c.k ? (o.sortDir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr ${o.rowAttr ? o.rowAttr(r) : ""}>${cols.map((c) => `<td class="${c.cls || ""}">${c.fmt ? c.fmt(r) : esc(r[c.k])}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}" class="empty">${o.empty || "Nothing to show."}</td></tr>`}</tbody></table></div>`;
	}
	window.UI = { $, $$, esc, inr, inrc, num, pct, iso, pd, addDays, fdate, hash, rng, initials, uid, store, toast, modal, close, confirmBox, csv, parseCSV, line, bars, hbars, donut, spark, router, table, PAL };
})();
