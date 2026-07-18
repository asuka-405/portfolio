// Mobile sidebar drawer toggle for docs pages. Self-contained, no build-time dependency,
// mirrors articles/hub.js's pattern.
(function () {
	var toggle = document.getElementById("docs-sidebar-toggle");
	var sidebar = document.getElementById("docs-sidebar");
	if (!toggle || !sidebar) return;

	function setOpen(open) {
		sidebar.classList.toggle("open", open);
		toggle.setAttribute("aria-expanded", open ? "true" : "false");
	}

	toggle.addEventListener("click", function () {
		setOpen(!sidebar.classList.contains("open"));
	});

	sidebar.addEventListener("click", function (e) {
		if (e.target.closest("a")) setOpen(false);
	});

	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape") setOpen(false);
	});
})();

// Fullscreen toggle for embedded live code examples (C++ via Compiler Explorer, Go via
// OneCompiler). Both wrappers + their fullscreen buttons follow the same naming pattern.
(function () {
	var WRAP_SELECTOR = ".godbolt-embed, .onecompiler-embed";
	var BTN_SELECTOR = ".godbolt-embed-fullscreen, .onecompiler-embed-fullscreen";

	document.querySelectorAll(BTN_SELECTOR).forEach(function (btn) {
		btn.addEventListener("click", function () {
			var wrap = btn.closest(WRAP_SELECTOR);
			if (!wrap) return;
			if (document.fullscreenElement === wrap) {
				document.exitFullscreen();
			} else if (wrap.requestFullscreen) {
				wrap.requestFullscreen();
			}
		});
	});

	document.addEventListener("fullscreenchange", function () {
		document.querySelectorAll(WRAP_SELECTOR).forEach(function (wrap) {
			wrap.classList.toggle("is-fullscreen", document.fullscreenElement === wrap);
		});
	});
})();

// Live, editable, runnable Go examples (OneCompiler embed). Source is delivered via
// postMessage after the iframe loads (retried a few times since there's no documented
// "ready" event) rather than baked into the URL, and the theme query param is kept in
// sync with the site's own light/dark toggle by reloading the iframe src on change.
(function () {
	var wraps = document.querySelectorAll(".onecompiler-embed");
	if (!wraps.length) return;

	function currentTheme() {
		return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
	}

	function withTheme(url, theme) {
		var u = new URL(url, window.location.href);
		u.searchParams.set("theme", theme);
		return u.toString();
	}

	wraps.forEach(function (wrap) {
		var frame = wrap.querySelector(".onecompiler-embed-frame");
		var source = wrap.getAttribute("data-oc-source");
		if (!frame || source === null) return;

		// The rendered src always defaults to theme=dark; correct it up front to whatever
		// data-theme is already set to (the inline flash script sets it before paint), so a
		// visitor whose stored/OS preference is light doesn't need to toggle the site theme
		// once just to get the embed to match.
		var initialTheme = currentTheme();
		if (initialTheme !== "dark") frame.src = withTheme(frame.src, initialTheme);

		function sendSource() {
			if (!frame.contentWindow) return;
			frame.contentWindow.postMessage(
				{ eventType: "populateCode", language: "go", files: [{ name: "main.go", content: source }] },
				"*"
			);
		}

		frame.addEventListener("load", function () {
			// The iframe's own app needs a moment after load to attach its message listener;
			// there's no documented "ready" signal, so resend a few times over ~1.5s.
			[200, 500, 900, 1400].forEach(function (delay) {
				setTimeout(sendSource, delay);
			});
		});
	});

	// data-theme is set on <html> before paint (see the inline theme-flash script) and
	// again whenever the site's own theme toggle button is clicked.
	var observer = new MutationObserver(function () {
		var theme = currentTheme();
		wraps.forEach(function (wrap) {
			var frame = wrap.querySelector(".onecompiler-embed-frame");
			if (frame) frame.src = withTheme(frame.src, theme);
		});
	});
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
