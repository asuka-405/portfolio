/* Landing page motion: scroll reveal, hero 3D tilt, card tilt, count-up. Skipped for reduced motion. */
(function () {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	var root = document.documentElement, fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
	root.classList.add("fx");
	var items = [].slice.call(document.querySelectorAll(".feat,.step,.plan,.split,.sec-h,.stats>div,.faq details,.cta .wrap"));
	items.forEach(function (el) { el.classList.add("reveal"); });
	if ("IntersectionObserver" in window) {
		var io = new IntersectionObserver(function (es) { var n = 0; es.forEach(function (e) { if (!e.isIntersecting) return; e.target.style.setProperty("--d", n++ * 80 + "ms"); e.target.classList.add("in"); io.unobserve(e.target); }); }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
		items.forEach(function (el) { io.observe(el); });
	} else items.forEach(function (el) { el.classList.add("in"); });
	if (!fine) return;
	var fr = document.querySelector(".hero .frame"), hero = document.querySelector(".hero");
	if (fr && hero) {
		hero.addEventListener("pointermove", function (e) { var r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; fr.classList.add("tilting"); fr.style.animation = "none"; fr.style.transform = "perspective(1200px) rotateX(" + (4 - y * 10).toFixed(2) + "deg) rotateY(" + (-5 + x * 14).toFixed(2) + "deg)"; });
		hero.addEventListener("pointerleave", function () { fr.style.transform = "perspective(1200px) rotateX(4deg) rotateY(-5deg)"; });
	}
	[].slice.call(document.querySelectorAll(".feat,.plan,.step")).forEach(function (c) {
		c.addEventListener("pointermove", function (e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; c.style.transitionDelay = "0ms"; c.style.transform = "perspective(700px) rotateX(" + (-y * 7).toFixed(2) + "deg) rotateY(" + (x * 9).toFixed(2) + "deg) translateY(-4px)"; });
		c.addEventListener("pointerleave", function () { c.style.transform = ""; });
	});
})();
