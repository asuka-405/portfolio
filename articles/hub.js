// Search + tag filtering for the articles hub/featured pages. Runs entirely client-side
// against a build-time search-index.json — no server, no runtime API calls.
(function () {
	var list = document.getElementById("article-list");
	var input = document.getElementById("article-search-input");
	var filterBar = document.getElementById("tag-filter-bar");
	var emptyMsg = document.getElementById("search-empty");
	if (!list || !input || !filterBar) return;

	var cards = [].slice.call(list.querySelectorAll(".article-card"));
	var byHref = {};
	cards.forEach(function (card) {
		byHref[card.getAttribute("href")] = card;
	});

	var index = {};
	fetch("search-index.json")
		.then(function (r) {
			return r.ok ? r.json() : [];
		})
		.then(function (entries) {
			entries.forEach(function (e) {
				index[e.href] = e;
			});
		})
		.catch(function () {
			// No generated index available yet (e.g. local clone before first `npm run build`) —
			// search still works against title + tags via DOM attributes below.
		});

	var selectedTag = "";
	var query = "";

	function cardMatchesQuery(card) {
		if (!query) return true;
		var q = query.toLowerCase();
		var title = card.getAttribute("data-title") || "";
		if (title.indexOf(q) !== -1) return true;
		var entry = index[card.getAttribute("href")];
		if (entry) {
			var haystack = ((entry.summary || "") + " " + (entry.bodyText || "")).toLowerCase();
			if (haystack.indexOf(q) !== -1) return true;
		}
		return false;
	}

	function cardMatchesTag(card) {
		if (!selectedTag) return true;
		var tags = (card.getAttribute("data-tags") || "").split(",");
		return tags.indexOf(selectedTag) !== -1;
	}

	function applyFilters() {
		var visibleCount = 0;
		cards.forEach(function (card) {
			var visible = cardMatchesTag(card) && cardMatchesQuery(card);
			card.style.display = visible ? "" : "none";
			if (visible) visibleCount += 1;
		});
		if (emptyMsg) emptyMsg.hidden = visibleCount > 0;
	}

	input.addEventListener("input", function () {
		query = input.value.trim();
		applyFilters();
	});

	filterBar.addEventListener("click", function (e) {
		var btn = e.target.closest(".tag-chip");
		if (!btn) return;
		selectedTag = btn.getAttribute("data-tag") || "";
		[].slice.call(filterBar.querySelectorAll(".tag-chip")).forEach(function (chip) {
			chip.classList.toggle("active", chip === btn);
		});
		applyFilters();
	});
})();
