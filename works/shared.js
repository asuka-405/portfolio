// Injects a small "concept build" pill into every work demo so visitors can get back to the works index.
(function () {
	// Skip inside iframes (embeds) and for ?nopill (used when taking thumbnails).
	if (window.self !== window.top || /[?&]nopill/.test(location.search)) return;
	var s = document.createElement("style");
	s.textContent =
		".sk-pill{position:fixed;left:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:8px;" +
		"padding:7px 12px 7px 10px;border-radius:999px;background:rgba(18,16,25,.92);color:#f4f2ff;" +
		"font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;text-decoration:none;" +
		"box-shadow:0 6px 24px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(8px)}" +
		".sk-pill:hover{background:#fa625f;color:#fff}.sk-pill i{font-style:normal;opacity:.65;font-weight:500}" +
		"@media print{.sk-pill{display:none}}";
	document.head.appendChild(s);
	var a = document.createElement("a");
	a.className = "sk-pill";
	a.href = "../index.html";
	a.innerHTML = "← All works <i>· concept build by Suryansh</i>";
	document.body.appendChild(a);
})();
