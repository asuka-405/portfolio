// The only part of the assistant that loads with every page: a floating button.
// Pressing it loads assistant.js (the panel). The model itself is fetched later, and only after consent.
(function () {
	if (window.__aiLauncher) return;
	window.__aiLauncher = true;
	var me = document.currentScript;
	if (!me || !me.src) return;
	var base = new URL("./", me.src);

	var css = document.createElement("link");
	css.rel = "stylesheet";
	css.href = new URL("assistant.css", base).href;

	var btn = document.createElement("button");
	btn.type = "button";
	btn.className = "ai-fab";
	btn.hidden = true;
	btn.setAttribute("aria-label", "Ask the site assistant");
	btn.setAttribute("aria-haspopup", "dialog");
	btn.setAttribute("aria-expanded", "false");
	btn.setAttribute("aria-controls", "ai-panel");
	btn.innerHTML =
		'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
		'<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/></svg>' +
		'<span class="ai-fab-label">Ask AI</span>';

	var mod = null;
	function load() {
		if (!mod) mod = import(new URL("assistant.js", base).href);
		return mod;
	}

	function show() {
		btn.hidden = false;
	}
	css.addEventListener("load", show);
	css.addEventListener("error", show);
	document.head.appendChild(css);
	document.body.appendChild(btn);

	// The panel code is small (about 25 KB); warm it up on intent. This never touches the model.
	btn.addEventListener("pointerenter", load, { once: true });
	btn.addEventListener("focus", load, { once: true });
	btn.addEventListener("click", function () {
		load()
			.then(function (m) {
				m.toggle(btn);
			})
			.catch(function () {
				mod = null;
				btn.title = "The assistant could not be loaded. Try again.";
			});
	});
})();
