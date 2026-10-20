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

	// Colour: tags keep one supporting hue each (by name), and a card takes the hue of its first tag.
	var HUES = 7;
	var hueOf = function (t) {
		var h = 0;
		for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 997;
		return h % HUES;
	};
	[].slice.call(document.querySelectorAll(".tag, .tag-chip")).forEach(function (t) {
		if (t.classList.contains("tag-chip--all")) return;
		var name = t.textContent.trim().toLowerCase();
		if (name) t.setAttribute("data-hue", hueOf(name));
	});
	[].slice.call(document.querySelectorAll(".article-card")).forEach(function (c) {
		var t = c.querySelector(".tag[data-hue]");
		if (t) c.setAttribute("data-hue", t.getAttribute("data-hue"));
	});

	// Cards borrow the Works tiles' look: a hue-tinted slab with a large extruded icon.
	var CARD_ICONS = {"code-xml":"<path d=\"m18 16 4-4-4-4\" /> <path d=\"m6 8-4 4 4 4\" /> <path d=\"m14.5 4-5 16\" />","server":"<rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" ry=\"2\" /> <rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" ry=\"2\" /> <line x1=\"6\" x2=\"6.01\" y1=\"6\" y2=\"6\" /> <line x1=\"6\" x2=\"6.01\" y1=\"18\" y2=\"18\" />","layout-dashboard":"<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\" /> <rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\" /> <rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\" /> <rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" />","workflow":"<rect width=\"8\" height=\"8\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M7 11v4a2 2 0 0 0 2 2h4\" /> <rect width=\"8\" height=\"8\" x=\"13\" y=\"13\" rx=\"2\" />","compass":"<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\" />","layers":"<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\" /> <path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\" /> <path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\" />","clipboard-check":"<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /> <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /> <path d=\"m9 14 2 2 4-4\" />","newspaper":"<path d=\"M15 18h-5\" /> <path d=\"M18 14h-8\" /> <path d=\"M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2\" /> <rect width=\"8\" height=\"4\" x=\"10\" y=\"6\" rx=\"1\" />","git-branch":"<path d=\"M15 6a9 9 0 0 0-9 9V3\" /> <circle cx=\"18\" cy=\"6\" r=\"3\" /> <circle cx=\"6\" cy=\"18\" r=\"3\" />","fingerprint":"<path d=\"M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4\" /> <path d=\"M14 13.12c0 2.38 0 6.38-1 8.88\" /> <path d=\"M17.29 21.02c.12-.6.43-2.3.5-3.02\" /> <path d=\"M2 12a10 10 0 0 1 18-6\" /> <path d=\"M2 16h.01\" /> <path d=\"M21.8 16c.2-2 .131-5.354 0-6\" /> <path d=\"M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2\" /> <path d=\"M8.65 22c.21-.66.45-1.32.57-2\" /> <path d=\"M9 6.8a6 6 0 0 1 9 5.2v2\" />","shield-check":"<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /> <path d=\"m9 12 2 2 4-4\" />","bot":"<path d=\"M12 8V4H8\" /> <rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\" /> <path d=\"M2 14h2\" /> <path d=\"M20 14h2\" /> <path d=\"M15 13v2\" /> <path d=\"M9 13v2\" />","terminal":"<path d=\"M12 19h8\" /> <path d=\"m4 17 6-6-6-6\" />","message-square":"<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\" />","book-open":"<path d=\"M12 5v16\" /> <path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" />","sparkles":"<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /> <path d=\"M20 2v4\" /> <path d=\"M22 4h-4\" /> <circle cx=\"4\" cy=\"20\" r=\"2\" />","file-text":"<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /> <path d=\"M10 9H8\" /> <path d=\"M16 13H8\" /> <path d=\"M16 17H8\" />","cpu":"<path d=\"M12 20v2\" /> <path d=\"M12 2v2\" /> <path d=\"M17 20v2\" /> <path d=\"M17 2v2\" /> <path d=\"M2 12h2\" /> <path d=\"M2 17h2\" /> <path d=\"M2 7h2\" /> <path d=\"M20 12h2\" /> <path d=\"M20 17h2\" /> <path d=\"M20 7h2\" /> <path d=\"M7 20v2\" /> <path d=\"M7 2v2\" /> <rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" /> <rect x=\"8\" y=\"8\" width=\"8\" height=\"8\" rx=\"1\" />","blocks":"<path d=\"M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2\" /> <rect x=\"14\" y=\"2\" width=\"8\" height=\"8\" rx=\"1\" />","zap":"<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\" />"};
	var iconRules = [
		[/c\+\+/, "blocks"], [/\bc for\b|\bc language\b/, "cpu"], [/\bgo,|\bgo\b.*end to end/, "zap"],
		[/languages|core/, "code-xml"], [/systems|data/, "server"], [/frontend/, "layout-dashboard"], [/automation/, "workflow"], [/exploring/, "compass"],
		[/sutrix|enterprise os/, "layers"], [/\biam\b|identity|sailpoint|iga\b/, "fingerprint"], [/auditflow|audit/, "clipboard-check"], [/blog bits|cms/, "newspaper"], [/githost|git\b/, "git-branch"],
		[/agent|\bai\b|llm|model/, "bot"], [/arch|linux|btrfs|filesystem/, "terminal"], [/opinion|industry|software/, "message-square"]
	];
	var iconFallback = ["sparkles", "book-open", "file-text", "shield-check", "compass", "layers", "code-xml"];
	[].slice.call(document.querySelectorAll(".skill-card, .project-card, .article-card")).forEach(function (card) {
		var h = card.querySelector("h3");
		var txt = ((h ? h.textContent : "") + " " + [].slice.call(card.querySelectorAll(".tag")).map(function (t) { return t.textContent; }).join(" ")).toLowerCase();
		var name = null;
		for (var i = 0; i < iconRules.length && !name; i++) if (iconRules[i][0].test(txt)) name = iconRules[i][1];
		if (!name) name = iconFallback[hueOf(txt) % iconFallback.length];
		var span = document.createElement("span");
		span.className = "card-ico";
		span.setAttribute("aria-hidden", "true");
		span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + CARD_ICONS[name] + "</svg>";
		card.appendChild(span);
	});

	// Scrollable side lists (heading minimap, docs sidebar): fade the clipped ends,
	// and keep the item you are on in view.
	function fadeEnds(box) {
		var upd = function () {
			var max = box.scrollHeight - box.clientHeight;
			box.style.setProperty("--fade-t", max > 2 && box.scrollTop > 2 ? "34px" : "0px");
			box.style.setProperty("--fade-b", max > 2 && box.scrollTop < max - 2 ? "34px" : "0px");
		};
		box.classList.add("fade-scroll");
		box.addEventListener("scroll", upd, { passive: true });
		window.addEventListener("resize", upd, { passive: true });
		upd();
		return upd;
	}
	function keepInView(box, el, smooth) {
		if (!box || !el) return;
		var b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
		var d = r.top + r.height / 2 - (b.top + b.height / 2);
		if (Math.abs(d) < 4) return;
		box.scrollTo({ top: box.scrollTop + d, behavior: smooth && !reduce ? "smooth" : "auto" });
	}
	var docsSide = document.querySelector(".docs-sidebar");
	if (docsSide) {
		fadeEnds(docsSide);
		keepInView(docsSide, docsSide.querySelector("a.active"), false);
	}

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
			// threshold 0: a ratio threshold can never be met by a block taller than the viewport, which left long sections invisible.
			{ rootMargin: "0px 0px -8% 0px", threshold: 0 }
		);
		items.forEach(function (el) {
			io.observe(el);
		});
		// Safety net: anything still hidden shortly after load that is already on screen, or taller than the screen, is shown.
		var showStuck = function () {
			var vh = window.innerHeight || document.documentElement.clientHeight;
			items.forEach(function (el) {
				if (el.classList.contains("in")) return;
				var r = el.getBoundingClientRect();
				// on screen, or already scrolled past (a jump link can skip a block, which would otherwise stay hidden above the fold)
				if (r.top < vh * 0.92) {
					el.classList.add("in");
					io.unobserve(el);
				}
			});
		};
		window.addEventListener("scroll", showStuck, { passive: true });
		window.addEventListener("load", function () {
			// A block taller than the screen would be foreshortened by the 3D entrance and never read as one piece: show it flat.
			var vh = window.innerHeight || document.documentElement.clientHeight;
			items.forEach(function (el) {
				if (!el.classList.contains("in") && el.offsetHeight > vh * 1.2) {
					el.classList.add("in");
					io.unobserve(el);
				}
			});
			setTimeout(showStuck, 300);
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

	// 3D: cards tilt toward the pointer, the hero leans, the backdrop shifts.
	if (!reduce && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
		var tiltSel = ".project-card, .article-card, .skill-card, .setup-card, .hero-facts li";
		[].slice.call(document.querySelectorAll(tiltSel)).forEach(function (card) {
			card.setAttribute("data-tilt", "");
			var raf = 0;
			card.addEventListener("pointermove", function (e) {
				if (raf) return;
				raf = requestAnimationFrame(function () {
					raf = 0;
					var r = card.getBoundingClientRect();
					var x = (e.clientX - r.left) / (r.width || 1) - 0.5;
					var y = (e.clientY - r.top) / (r.height || 1) - 0.5;
					var k = Math.min(1, 520 / (r.width || 520));
					card.style.setProperty("--mx", (x + 0.5) * 100 + "%");
					card.style.setProperty("--my", (y + 0.5) * 100 + "%");
					card.style.transform =
						"perspective(900px) rotateX(" + (-y * 9 * k).toFixed(2) + "deg) rotateY(" + (x * 12 * k).toFixed(2) + "deg) translateZ(8px)";
				});
			});
			card.addEventListener("pointerleave", function () {
				card.style.transform = "";
			});
		});
		var hero = document.querySelector(".hero");
		window.addEventListener(
			"pointermove",
			function (e) {
				var w = window.innerWidth || 1, h = window.innerHeight || 1;
				var nx = e.clientX / w - 0.5, ny = e.clientY / h - 0.5;
				document.body.style.setProperty("--bgx", (nx * -18).toFixed(1) + "px");
				document.body.style.setProperty("--bgy", (ny * -18).toFixed(1) + "px");
				if (hero) {
					hero.style.setProperty("--hry", (nx * 3).toFixed(2) + "deg");
					hero.style.setProperty("--hrx", (-ny * 2.2).toFixed(2) + "deg");
				}
			},
			{ passive: true }
		);
	}

	// Reading progress bar + page legend (the heading minimap), on every page.
	if (document.querySelector("main")) {
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

		var pick = function (sel) {
			return [].slice
				.call(document.querySelectorAll(sel))
				.filter(function (h) {
					return !h.closest(".docs-sidebar, .minimap, .wk-drawer") && h.textContent.trim() !== "";
				});
		};
		var heads = pick("main h1, main h2, main .prose h3, main [data-legend]");
		// A paragraph that is nothing but a bold line is a sub-heading in disguise (the Go course uses these).
		[].slice.call(document.querySelectorAll("main .prose p")).forEach(function (p) {
			var st = p.firstElementChild;
			if (st && st.tagName === "STRONG" && p.children.length === 1 && p.textContent.trim() === st.textContent.trim() && st.textContent.trim().length < 90 && heads.indexOf(p) < 0) heads.push(p);
		});
		if (heads.length < 4) {
			// Index and listing pages: legend the cards as well.
			pick("main .article-card h3, main .project-card h3, main .setup-card h3").forEach(function (h) {
				if (heads.indexOf(h) < 0) heads.push(h);
			});
		}
		heads.sort(function (a, b) {
			return a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1;
		});
		// Docs pages with few sections of their own: list the course chapters after the page title.
		var ext = [];
		if (heads.length < 4 && docsSide) {
			[].slice.call(docsSide.querySelectorAll("li a")).forEach(function (a) {
				if (!a.classList.contains("active") && a.textContent.trim()) ext.push({ label: a.textContent.trim(), href: a.getAttribute("href") });
			});
		}
		if (heads.length < 2 && !ext.length) {
			// Near-empty pages still get a legend: the top of the page and the footer.
			var foot = document.querySelector(".site-footer");
			if (foot && heads.length) {
				foot.id = foot.id || "site-footer";
				foot.setAttribute("data-legend", "Footer");
				heads.push(foot);
			}
		}
		if (heads.length + ext.length > 1) {
			var nav = document.createElement("nav");
			nav.className = "minimap";
			nav.setAttribute("aria-label", "On this page");
			var ul = document.createElement("ul");
			var links = {};
			var addLi = function (cls, href, label, id) {
				var li = document.createElement("li");
				li.className = cls;
				var a = document.createElement("a");
				a.href = href;
				a.innerHTML = '<span class="lbl"></span>';
				a.querySelector(".lbl").textContent = label;
				li.appendChild(a);
				ul.appendChild(li);
				if (id) {
					a.dataset.target = id;
					links[id] = a;
				}
			};
			heads.forEach(function (h, i) {
				if (!h.id) {
					var base =
						h.textContent
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, "-")
							.replace(/^-+|-+$/g, "")
							.slice(0, 48) || "sec-" + i;
					var id = base, n = 2;
					while (document.getElementById(id)) id = base + "-" + n++;
					h.id = id;
				}
				addLi("mm-" + h.tagName.toLowerCase(), "#" + h.id, h.getAttribute("data-legend") || h.textContent.trim(), h.id);
			});
			ext.forEach(function (x) {
				addLi("mm-ext", x.href, x.label, null);
			});
			nav.appendChild(ul);
			document.body.appendChild(nav);
			fadeEnds(nav);

			if ("IntersectionObserver" in window) {
				var spy = new IntersectionObserver(
					function (entries) {
						entries.forEach(function (e) {
							if (e.isIntersecting) {
								Object.keys(links).forEach(function (k) {
									links[k].classList.remove("active");
								});
								if (links[e.target.id]) {
									links[e.target.id].classList.add("active");
									keepInView(nav, links[e.target.id], true);
								}
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
