/* Kiln & Clay: catalogue, workshops, collections (concept build, fictional studio). */
window.KC_DATA = (function () {
	// [id, name, category, unit price, image key, short description, stock, collection tags, sets?]
	const P = [
		["classic-mug", "Classic Stoneware Mug", "Mugs & Cups", 1200, "mug1", "A 350 ml everyday mug with a generous handle and a soft satin glaze.", 24, ["ritual", "gift"], "mug"],
		["dip-mug-set", "Sunrise Dip Mugs", "Mugs & Cups", 3200, "mug2", "Three hand-dipped mugs in apricot, butter and cream. Sold as a set.", 9, ["ritual", "gift"], null],
		["cappuccino-cup", "Cappuccino Cup & Saucer", "Mugs & Cups", 1800, "mug3", "A thick-walled 180 ml cup that keeps your latte art warm.", 14, ["ritual"], "mug"],
		["desk-mug", "Desk Mug · 400 ml", "Mugs & Cups", 1100, "mug4", "The tall, stable mug that survives a laptop-side life.", 31, ["ritual"], "mug"],
		["tea-cup", "Speckled Tea Cup", "Mugs & Cups", 950, "tea", "A handle-less cup that sits in your palm. Dishwasher safe.", 40, ["ritual", "gift"], "mug"],
		["deep-bowl", "Deep Serving Bowl", "Bowls", 2600, "bowl1", "A cream, 26 cm bowl for salads, pasta and everything shared.", 11, ["dinner"], null],
		["noodle-bowl", "Speckle Noodle Bowl", "Bowls", 1500, "bowl2", "Tall sides, wide mouth, white glaze that breaks to iron speckles.", 22, ["dinner", "ritual"], "mug"],
		["nesting-bowls", "Nesting Bowl Pair", "Bowls", 1800, "bowl3", "Two bowls that stack neatly, small for dips, large for rice.", 17, ["dinner", "gift"], null],
		["terracotta-bowl", "Terracotta Fruit Bowl", "Bowls", 2200, "bowl4", "A sun-coloured bowl with a hand-painted leaf motif inside.", 8, ["gift", "dinner"], null],
		["dinner-plates", "Dinner Plate Set", "Plates", 1050, "plate1", "28 cm plates with a gentle rim. Priced each, sets save up to 10%.", 36, ["dinner"], "plate"],
		["side-plates", "Stoneware Side Plates", "Plates", 700, "plate2", "20 cm plates for toast, cake and cheese. Priced each.", 48, ["dinner", "ritual"], "plate"],
		["heritage-plates", "Heritage Plate Collection", "Plates", 5400, "plate3", "A mixed set of eight vintage-inspired plates, each slightly different.", 4, ["dinner", "gift"], null],
		["charcoal-plate", "Charcoal Rim Plate", "Plates", 1300, "plate4", "A matte charcoal plate with a pale rim. Makes food look expensive.", 19, ["dinner"], "plate"],
		["vase-trio", "Studio Vase Trio", "Vases", 3600, "vase1", "Three small vases in warm neutrals. Fill one, or all.", 12, ["gift"], null],
		["celadon-vase", "Celadon Bottle Vase", "Vases", 2400, "vase2", "Glossy jade-green bottle vase fired in a reduction kiln.", 7, ["gift"], null],
		["cobalt-vase", "Cobalt Bud Vase", "Vases", 1900, "vase3", "A slender bud vase with a deep blue glaze that pools at the base.", 15, ["gift"], null],
		["milk-vase", "Milk Vase", "Vases", 2100, "vase4", "A rounded white vase with a narrow neck. Sculptural even when empty.", 13, ["gift"], null],
		["arch-vase", "Arch Vase", "Vases", 2900, "glaze3", "Our U-shaped signature piece in burnt orange. Wheel-thrown and joined by hand.", 0, ["gift"], null],
		["classic-teapot", "Classic Teapot · 800 ml", "Serveware", 3200, "teapot1", "A white teapot with a wide-set lid and a drip-free spout.", 10, ["ritual", "gift"], null],
		["firing-teapot", "Wood-fired Teapot", "Serveware", 4800, "teapot2", "Ash-glazed and unique. No two come out of the kiln the same.", 3, ["ritual", "gift"], null],
		["milk-jugs", "Grey Milk Jug", "Serveware", 700, "jug1", "A small 200 ml jug in cool concrete grey. Priced each.", 44, ["ritual"], "mug"],
		["blush-pitcher", "Blush Pitcher", "Serveware", 2300, "jug2", "A one-litre pitcher with a soft terracotta blush. Beautiful for water or lassi.", 9, ["dinner", "gift"], null],
		["trinket-jars", "Hand-painted Jar Trio", "Serveware", 2600, "tray", "Three lidded jars, hand-painted with marigold and fern.", 6, ["gift"], null],
		["gold-platter", "Gold-rim Platter", "Serveware", 3400, "platter1", "An oval serving platter edged with a thin line of fired gold.", 5, ["dinner", "gift"], null],
		["serving-plate", "Wide Serving Plate", "Serveware", 1800, "platter2", "A 30 cm plate with a raised lip. Cheese, tarts, anything.", 16, ["dinner"], null],
		["planter-trio", "Terracotta Planter Trio", "Home", 2200, "planter1", "Three planters with saucers, sized for succulents and herbs.", 18, ["gift"], null],
		["ripple-candles", "Ripple Candle Holders", "Home", 1500, "candle1", "A set of five stacked tea-light holders in earthy glazes.", 21, ["gift", "ritual"], null],
		["pinch-dishes", "Pinch Dish Set", "Home", 2400, "candle2", "Nine tiny hand-pinched dishes for rings, salt, ghee or incense.", 14, ["gift"], null],
		["salt-pepper", "Salt & Pepper Cellars", "Home", 1200, "saltpepper", "A matched pair with oak lids. Small, pretty, useful.", 27, ["dinner", "gift"], null],
		["dinner-set-24", "Dinner Set · 24 pieces", "Sets", 14500, "dinner1", "Service for six: dinner plates, side plates, bowls and mugs.", 5, ["dinner", "gift"], null],
		["stripe-set-12", "Striped Dinner Set · 12 pieces", "Sets", 9800, "dinner2", "Service for four with a bold black-and-cream stripe.", 7, ["dinner", "gift"], null],
		["table-bundle", "Table Setting Bundle", "Sets", 7200, "set1", "A styled mix of plates, cups and a vase to dress one table.", 6, ["dinner", "gift"], null],
	];
	const sets = { mug: [["Single", 1, 0], ["Set of 2", 2, 5], ["Set of 4", 4, 10]], plate: [["Single", 1, 0], ["Set of 4", 4, 8], ["Set of 6", 6, 10]] };
	const products = P.map((p) => ({ id: p[0], name: p[1], cat: p[2], price: p[3], img: p[4], desc: p[5], stock: p[6], tags: p[7], sets: p[8] ? sets[p[8]] : null }));
	return {
		products,
		cats: ["Mugs & Cups", "Bowls", "Plates", "Vases", "Serveware", "Home", "Sets"],
		detail: ["wheel", "hands", "craft", "wheel2", "studio1"],
		collections: [
			{ id: "ritual", name: "Morning ritual", img: "mug3", blurb: "Cups, teapots and little jugs for slow breakfasts." },
			{ id: "dinner", name: "Dinner party", img: "dinner1", blurb: "Plates, bowls and platters that make a table." },
			{ id: "gift", name: "Gifts that last", img: "vase1", blurb: "Handmade pieces someone will keep for a decade." },
		],
		coupons: { WELCOME10: { label: "10% off your first order", pct: 10 }, CLAY15: { label: "15% off orders above ₹5,000", pct: 15, min: 5000 }, FREESHIP: { label: "Free standard shipping", ship: true } },
		workshops: [
			{ id: "wheel", name: "Intro to the Wheel", dur: "3 hrs", price: 2800, img: "wheel", blurb: "Centre clay, pull up walls and throw your first bowl. We fire and glaze it for you.", days: [6, 0], time: "11:00", cap: 8 },
			{ id: "hand", name: "Hand-building Basics", dur: "2.5 hrs", price: 2200, img: "hands", blurb: "Pinch, coil and slab techniques, no wheel needed. Make a planter and a set of dishes.", days: [3, 6], time: "16:00", cap: 10 },
			{ id: "glaze", name: "Glaze & Sip Evening", dur: "2 hrs", price: 1800, img: "glaze1", blurb: "Paint ready-made bisque pieces with a glass of something cold. A relaxed evening for groups.", days: [5], time: "18:30", cap: 12 },
			{ id: "pair", name: "Date-night Duet", dur: "2.5 hrs", price: 5200, img: "craft", blurb: "Two wheels, one table, a bottle of wine and a teacher to rescue you. Price is per couple.", days: [5, 6], time: "19:00", cap: 6, pair: true },
		],
		faqs: [
			["How do I care for stoneware?", "Wash by hand or on a gentle dishwasher cycle, and avoid sudden temperature jumps. Every piece is food-safe, oven-safe to 220 °C and microwave-safe."],
			["Why are no two pieces identical?", "Each piece is thrown, trimmed and glazed by hand. Small variations in colour and shape are the point, and the proof."],
			["How long does delivery take?", "In stock pieces ship in 2 working days. Metros arrive in 2–4 days, the rest of India in 4–7. Every parcel is double-boxed and insured."],
			["What if something arrives broken?", "Send us a photo within 7 days and we'll replace it at no cost, no returns needed."],
			["Can I return an item?", "Yes, within 30 days if it's unused. We refund to your original payment method."],
		],
		journal: [
			{ id: "care", title: "How to look after stoneware", img: "hands", date: "12 Sep 2026", mins: 4, body: ["Stoneware is tougher than it looks, but it hates sudden temperature changes. Don't pour boiling water into a cold mug straight from the fridge, and let hot dishes cool a moment before washing.", "Hand wash with a soft sponge whenever you can. If you use a dishwasher, choose a gentle cycle and leave space so pieces don't clink.", "Stains from tea are easy: a paste of baking soda and water, a gentle scrub, and they lift away. Never use steel wool on a glazed surface."] },
			{ id: "kiln", title: "Why we fire at 1,260 °C", img: "wheel2", date: "28 Aug 2026", mins: 5, body: ["Stoneware gets its strength from heat. At 1,260 °C the clay vitrifies, the particles melt together and the body becomes non-porous.", "That's why our mugs don't sweat and our plates survive a hundred dinner parties. It also means a longer, costlier firing than earthenware, but you'll feel the difference in your hand.", "Every kiln load is slightly different, which is why you'll sometimes see a darker rim or a pool of glaze where fire touched a shelf. We call those signatures."] },
			{ id: "table", title: "Setting a table for slow dinners", img: "set1", date: "3 Aug 2026", mins: 3, body: ["Start with a neutral plate and let one colourful piece do the talking. Mix sizes: a big platter in the middle, small dishes for pickles and salt.", "Cover the table with linen, not plastic. Use candles that are lower than eye level so people can see each other.", "And leave room. Slow dinners need space for hands, elbows and long, wandering stories."] },
		],
	};
})();
