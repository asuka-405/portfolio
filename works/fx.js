/* Works page motion: scroll reveal, 3D tilt with glare, count-up stats. Skipped for reduced motion. */
(function () {
	var rm = matchMedia("(prefers-reduced-motion: reduce)").matches, root = document.documentElement;
	var tiles = [].slice.call(document.querySelectorAll(".tile"));
	if (matchMedia("(hover: hover) and (pointer: fine)").matches) tiles.forEach(function (t) { t.addEventListener("pointerenter", function () { t.classList.add("hv"); }); t.addEventListener("pointerleave", function () { t.classList.remove("hv"); }); });
	if (rm) return;
	root.classList.add("fx");
	if ("IntersectionObserver" in window) {
		var io = new IntersectionObserver(function (es) {
			var n = 0;
			es.forEach(function (e) { if (!e.isIntersecting) return; var t = e.target; t.style.setProperty("--d", n++ * 70 + "ms"); t.classList.add("in"); io.unobserve(t); });
		}, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
		tiles.forEach(function (t) { io.observe(t); });
	} else tiles.forEach(function (t) { t.classList.add("in"); });
	if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
		tiles.forEach(function (t) {
			var raf = 0;
			t.addEventListener("pointermove", function (e) {
				if (raf) return;
				raf = requestAnimationFrame(function () {
					raf = 0; var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
					t.style.setProperty("--mx", x * 100 + "%"); t.style.setProperty("--my", y * 100 + "%");
					t.style.transform = "perspective(900px) rotateX(" + ((0.5 - y) * 10).toFixed(2) + "deg) rotateY(" + ((x - 0.5) * 13).toFixed(2) + "deg) scale(1.02)";
				});
			});
			t.addEventListener("pointerleave", function () { t.style.transform = ""; });
		});
	}
	[].slice.call(document.querySelectorAll(".hero-facts .v b")).forEach(function (el) {
		var end = parseFloat(el.textContent), t0 = performance.now(), d = 900;
		if (!isFinite(end) || end === 0) return;
		(function tick(now) { var p = Math.min(1, (now - t0) / d); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })(t0);
	});
})();
