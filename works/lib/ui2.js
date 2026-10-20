/* More helpers for the Works tools: forms, WhatsApp/UPI links, QR, print, words, downloads. */
(function () {
	const U = window.UI, { esc } = U;
	const digits = (p) => String(p || "").replace(/\D/g, "");
	U.wa = (phone, msg) => { const d = digits(phone); return "https://wa.me/" + (d.length === 10 ? "91" + d : d) + "?text=" + encodeURIComponent(msg || ""); };
	U.upi = (vpa, name, amt, note) => "upi://pay?pa=" + encodeURIComponent(vpa) + "&pn=" + encodeURIComponent(name) + (amt ? "&am=" + Number(amt).toFixed(2) : "") + "&cu=INR" + (note ? "&tn=" + encodeURIComponent(note) : "");
	U.qr = (el, text, size = 140) => { if (typeof el === "string") el = document.querySelector(el); if (!el) return; el.innerHTML = ""; try { new QRCode(el, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { el.textContent = "Too long for a QR"; } };
	U.today = () => U.iso(new Date());
	U.mkey = (d) => U.iso(d).slice(0, 7);
	U.mname = (k) => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
	U.ago = (ts) => { const s = (Date.now() - ts) / 1000; return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + " min ago" : s < 86400 ? Math.floor(s / 3600) + " h ago" : Math.floor(s / 86400) + " d ago"; };
	U.chip = (t, c = "") => `<span class="chip ${c}">${esc(t)}</span>`;
	U.kpi = (l, v, sub, cls = "") => `<div class="kpi"><span>${l}</span><b>${v}</b>${sub ? `<small class="${cls || "mut"}">${sub}</small>` : ""}</div>`;
	U.tabsHtml = (items, cur, attr = "data-tab") => `<div class="tabs">${items.map((t) => { const [k, l] = Array.isArray(t) ? t : [t, t]; return `<button ${attr}="${esc(k)}" class="${k === cur ? "on" : ""}">${l}</button>`; }).join("")}</div>`;
	U.field = (label, name, val = "", o = {}) => {
		const t = o.type || "text", a = `name="${name}" ${o.req ? "required" : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} ${o.attrs || ""}`;
		let inner;
		if (t === "select") inner = `<select class="in" ${a}>${(o.opts || []).map((x) => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select>`;
		else if (t === "textarea") inner = `<textarea class="in" rows="${o.rows || 3}" ${a}>${esc(val)}</textarea>`;
		else if (t === "check") return `<label class="row" style="gap:8px;font-size:.9rem"><input type="checkbox" name="${name}" ${val ? "checked" : ""}> ${label}</label>`;
		else inner = `<input class="in" type="${t}" value="${esc(val)}" ${a}>`;
		return `<label class="f" style="${o.style || ""}">${label}${inner}</label>`;
	};
	U.vals = (root) => { const o = {}; root.querySelectorAll("[name]").forEach((el) => { o[el.name] = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? "" : +el.value) : el.value.trim(); }); return o; };
	/* modal form: onSave(values) -> false keeps it open */
	U.form = (title, body, onSave, o = {}) => U.modal({ title, body, wide: o.wide, actions: [{ label: "Cancel" }, { label: o.save || "Save", cls: "pri", fn: (bg) => { const m = bg.querySelector("#modal-body"); const bad = [...m.querySelectorAll("[required]")].find((e) => !e.value); if (bad) { bad.focus(); U.toast("Please fill in " + (bad.closest("label")?.firstChild?.textContent || "the required field")); return false; } return onSave(U.vals(m), m); } }], onOpen: o.onOpen });
	U.print = (html, title = "Print") => {
		let f = document.getElementById("print-frame"); if (f) f.remove(); f = document.createElement("iframe"); f.id = "print-frame"; f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f);
		const d = f.contentWindow.document; d.open(); d.write(`<!doctype html><title>${esc(title)}</title><style>body{font:13px/1.45 system-ui,sans-serif;color:#111;margin:18px}table{width:100%;border-collapse:collapse}th,td{padding:5px 6px;text-align:left;border-bottom:1px solid #ddd}.r{text-align:right}h1,h2,h3{margin:0 0 6px}.c{text-align:center}.mut{color:#666}@page{margin:10mm}</style>${html}`); d.close();
		setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} }, 250);
	};
	U.dl = (name, text, type = "text/plain") => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
	U.words = (n) => {
		n = Math.round(n); if (!n) return "Zero rupees only";
		const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"], b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
		const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : ""));
		const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x));
		const parts = []; [[1e7, "Crore"], [1e5, "Lakh"], [1e3, "Thousand"]].forEach(([v, nm]) => { if (n >= v) { parts.push(two(Math.floor(n / v)) + " " + nm); n %= v; } }); if (n) parts.push(three(n));
		return parts.join(" ") + " rupees only";
	};
	U.pick = (arr, r) => arr[Math.floor(r() * arr.length)];
	U.names = { first: ["Aarav", "Vivaan", "Aditya", "Arjun", "Rohan", "Kabir", "Ishaan", "Rahul", "Karan", "Siddharth", "Ananya", "Diya", "Isha", "Kavya", "Meera", "Neha", "Priya", "Riya", "Saanvi", "Tanvi", "Pooja", "Sneha", "Nikhil", "Manish", "Deepak", "Sunita", "Rekha", "Anil", "Vikram", "Ritu"], last: ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Mehta", "Jain", "Agarwal", "Yadav", "Patel", "Khanna", "Bansal", "Malhotra", "Chopra", "Saxena", "Tiwari", "Mishra", "Kapoor", "Joshi", "Nair"] };
	U.person = (r) => U.pick(U.names.first, r) + " " + U.pick(U.names.last, r);
	U.phone = (r) => "9" + String(Math.floor(r() * 9e8) + 1e8);
	document.addEventListener("click", (e) => { const b = e.target.closest("#burger"); if (b) document.querySelector(".side")?.classList.toggle("open"); });
})();
