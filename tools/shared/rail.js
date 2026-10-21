// Collapsible site menu for the tool pages. It starts collapsed on every load and closes on an outside click or Escape.
(function () {
	var rail = document.getElementById("site-rail");
	if (!rail) return;
	var toggle = rail.querySelector(".rail-toggle");

	function set(open) {
		rail.classList.toggle("is-open", open);
		toggle.setAttribute("aria-expanded", open ? "true" : "false");
		toggle.setAttribute("aria-label", open ? "Close site menu" : "Open site menu");
	}

	toggle.addEventListener("click", function () {
		set(!rail.classList.contains("is-open"));
	});
	document.addEventListener("click", function (e) {
		if (rail.classList.contains("is-open") && !rail.contains(e.target)) set(false);
	});
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && rail.classList.contains("is-open")) {
			set(false);
			toggle.focus();
		}
	});
})();
