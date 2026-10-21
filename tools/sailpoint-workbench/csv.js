// RFC 4180 CSV parser/serializer. Handles quoted fields, escaped quotes, CRLF and a UTF-8 BOM.

/** @returns {{headers:string[], rows:Record<string,string>[]}} */
export function parseCsv(src) {
	const text = src.replace(/^﻿/, "");
	const rows = [];
	let row = [];
	let field = "";
	let inQ = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQ) {
			if (c === '"') {
				if (text[i + 1] === '"') { field += '"'; i++; }
				else inQ = false;
			} else field += c;
		} else if (c === '"' && field === "") inQ = true;
		else if (c === ",") { row.push(field); field = ""; }
		else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(field); field = "";
			rows.push(row); row = [];
		} else field += c;
	}
	if (field !== "" || row.length) { row.push(field); rows.push(row); }
	const clean = rows.filter((r) => r.some((x) => x.trim() !== ""));
	if (!clean.length) return { headers: [], rows: [] };
	const headers = clean[0].map((h) => h.trim());
	return {
		headers,
		rows: clean.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))),
	};
}

export function toCsv(headers, rows) {
	const esc = (v) => {
		const s = v == null ? "" : String(v);
		return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	return [headers.map(esc).join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n") + "\n";
}
