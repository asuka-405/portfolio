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

// Fullscreen toggle for embedded live C++ examples.
(function () {
	document.querySelectorAll(".godbolt-embed-fullscreen").forEach(function (btn) {
		btn.addEventListener("click", function () {
			var wrap = btn.closest(".godbolt-embed");
			if (!wrap) return;
			if (document.fullscreenElement === wrap) {
				document.exitFullscreen();
			} else if (wrap.requestFullscreen) {
				wrap.requestFullscreen();
			}
		});
	});

	document.addEventListener("fullscreenchange", function () {
		document.querySelectorAll(".godbolt-embed").forEach(function (wrap) {
			wrap.classList.toggle("is-fullscreen", document.fullscreenElement === wrap);
		});
	});
})();
