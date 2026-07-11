// Shared behaviour for all pages: theme toggle, scroll reveals, ambient glow, year.
(function () {
	var root = document.documentElement;
	var KEY = "sk-theme";

	// Theme toggle (persisted).
	var btn = document.querySelector(".site-theme");
	if (btn) {
		btn.addEventListener("click", function () {
			var next =
				root.getAttribute("data-theme") === "light" ? "dark" : "light";
			root.setAttribute("data-theme", next);
			try {
				localStorage.setItem(KEY, next);
			} catch (e) {}
		});
	}

	var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	// Scroll-triggered reveals.
	var items = document.querySelectorAll(".reveal");
	if (reduce || !("IntersectionObserver" in window)) {
		items.forEach(function (el) {
			el.classList.add("in");
		});
	} else {
		var io = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (e) {
					if (e.isIntersecting) {
						e.target.classList.add("in");
						io.unobserve(e.target);
					}
				});
			},
			{ rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
		);
		items.forEach(function (el) {
			io.observe(el);
		});
	}

	// Pointer-tracked ambient glow: big red orbit (hero only, viewport %)
	// and a small bright grid highlight (sitewide, aligned to the grid layer's own box).
	if (!reduce && window.matchMedia("(pointer: fine)").matches) {
		var setPtr = function (clientX, clientY) {
			var w = window.innerWidth || 1;
			var h = window.innerHeight || 1;
			document.body.style.setProperty("--ptr-x", (clientX / w) * 100 + "%");
			document.body.style.setProperty("--ptr-y", (clientY / h) * 100 + "%");

			var grid = document.querySelector(".bg-grid-accent");
			if (grid) {
				var r = grid.getBoundingClientRect();
				var rw = r.width > 0 ? r.width : 1;
				var rh = r.height > 0 ? r.height : 1;
				var gx = ((clientX - r.left) / rw) * 100;
				var gy = ((clientY - r.top) / rh) * 100;
				document.body.style.setProperty(
					"--grid-ptr-x",
					Math.max(0, Math.min(100, gx)).toFixed(3) + "%"
				);
				document.body.style.setProperty(
					"--grid-ptr-y",
					Math.max(0, Math.min(100, gy)).toFixed(3) + "%"
				);
			}
		};
		window.addEventListener(
			"pointermove",
			function (e) {
				setPtr(e.clientX, e.clientY);
			},
			{ passive: true }
		);
		window.addEventListener(
			"resize",
			function () {
				setPtr(
					(window.innerWidth || 0) * 0.5,
					(window.innerHeight || 0) * 0.36
				);
			},
			{ passive: true }
		);
		setPtr((window.innerWidth || 0) * 0.5, (window.innerHeight || 0) * 0.36);
	}

	// Reading progress bar + heading minimap (long-form sub-pages only).
	if (document.querySelector(".doc-hero")) {
		var bar = document.createElement("div");
		bar.className = "read-progress";
		document.body.appendChild(bar);
		var updateBar = function () {
			var el = document.documentElement;
			var max = el.scrollHeight - el.clientHeight;
			var p = max > 0 ? el.scrollTop / max : 0;
			bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
		};
		window.addEventListener("scroll", updateBar, { passive: true });
		window.addEventListener("resize", updateBar, { passive: true });
		updateBar();

		var heads = [].slice.call(
			document.querySelectorAll("main h2, main .prose h3")
		);
		if (heads.length > 2) {
			var nav = document.createElement("nav");
			nav.className = "minimap";
			nav.setAttribute("aria-label", "On this page");
			var ul = document.createElement("ul");
			var links = {};
			heads.forEach(function (h, i) {
				if (!h.id) {
					h.id =
						h.textContent
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, "-")
							.replace(/^-+|-+$/g, "") || "sec-" + i;
				}
				var li = document.createElement("li");
				li.className = "mm-" + h.tagName.toLowerCase();
				var a = document.createElement("a");
				a.href = "#" + h.id;
				a.dataset.target = h.id;
				a.innerHTML = '<span class="lbl"></span>';
				a.querySelector(".lbl").textContent = h.textContent;
				li.appendChild(a);
				ul.appendChild(li);
				links[h.id] = a;
			});
			nav.appendChild(ul);
			document.body.appendChild(nav);

			if ("IntersectionObserver" in window) {
				var spy = new IntersectionObserver(
					function (entries) {
						entries.forEach(function (e) {
							if (e.isIntersecting) {
								Object.keys(links).forEach(function (k) {
									links[k].classList.remove("active");
								});
								if (links[e.target.id]) links[e.target.id].classList.add("active");
							}
						});
					},
					{ rootMargin: "0px 0px -75% 0px", threshold: 0 }
				);
				heads.forEach(function (h) {
					spy.observe(h);
				});
			}
		}
	}

	var y = document.getElementById("year");
	if (y) y.textContent = new Date().getFullYear();
})();
