// Run with: node --test assistant/assistant.test.mjs   (after: node scripts/build-assistant-index.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createIndex, tokenize, buildMessages, renderMarkdown, chunkText, suggestionsFor, BUDGETS, extractive, excerpt, explainError, makeBoost, bestAnswer } from "./search.js";

const load = (f) => JSON.parse(fs.readFileSync(new URL(`./index/${f}.json`, import.meta.url), "utf8"));
const site = load("site");
const titleOf = new Map(site.pages.map((p) => [p.u, p.t]));
const withTitles = (chunks) => chunks.map((c) => ({ ...c, t: titleOf.get(c.u) }));
const fullIndex = () => {
	const ix = createIndex();
	ix.add(withTitles(site.chunks));
	for (const f of fs.readdirSync(new URL("./index/", import.meta.url))) if (f.startsWith("docs-")) ix.add(withTitles(load(f.replace(".json", "")).chunks));
	return ix;
};
const top = (ix, q, n = 3) => ix.search(q, { limit: 8 }).map((h) => h.chunk.u).filter((u, i, a) => a.indexOf(u) === i).slice(0, n);

test("tokenizer folds C++ and stems lightly", () => {
	assert.deepEqual(tokenize("C++ templates"), ["cpp", tokenize("template")[0]]);
	assert.deepEqual(tokenize("closing closed closes close").filter((t, i, a) => a.indexOf(t) === i).length, 1);
	assert.ok(tokenize("How do goroutines communicate?").includes(tokenize("goroutine")[0]));
	assert.deepEqual(tokenize("the and of"), []);
});

test("site index has pages, a compact sitemap and chunks", () => {
	assert.ok(site.pages.length > 100);
	assert.ok(site.sitemap.length < 2400, "sitemap must stay small enough for a 4k-token window");
	assert.match(site.sitemap, /docs\/go\//);
	assert.ok(site.chunks.every((c) => c.u && typeof c.x === "string"));
});

test("questions land on the right pages across the whole site", () => {
	const ix = fullIndex();
	assert.equal(top(ix, "how do channels work in go")[0], "docs/go/channels.html");
	assert.ok(top(ix, "difference between SailPoint ISC and IdentityIQ").includes("articles/sailpoint-isc-vs-iiq.html"));
	assert.ok(top(ix, "tool to explain a cron expression").includes("tools/cron-explainer/index.html"));
	assert.ok(top(ix, "c++ virtual functions and polymorphism", 4).some((u) => u.startsWith("docs/cpp/")));
	assert.ok(top(ix, "btrfs snapshots rollback").includes("articles/btrfs-snapshots.html"));
});

test("boost favours the page the visitor is on", () => {
	const ix = fullIndex();
	const q = "what is the main idea";
	const plain = ix.search(q, { limit: 1 })[0].chunk.u;
	const boosted = ix.search(q, { limit: 1, boost: (c) => (c.u === "docs/go/interfaces.html" ? 50 : 1) })[0].chunk.u;
	assert.equal(boosted, "docs/go/interfaces.html");
	assert.notEqual(plain, undefined);
});

test("prompt stays inside the context budget and keeps retrieval in the last user turn", () => {
	const ix = fullIndex();
	const hits = ix.search("explain slices and maps in go", { limit: 12 });
	const history = [
		{ role: "user", content: "hi" },
		{ role: "assistant", content: "x".repeat(2000) },
		{ role: "user", content: "what about arrays" },
		{ role: "assistant", content: "arrays are values" },
	];
	const { messages, sources } = buildMessages({ sitemap: site.sitemap, page: { title: "Home", path: "index.html" }, question: "explain slices", history, hits });
	const chars = messages.reduce((n, m) => n + m.content.length, 0);
	assert.ok(chars < 11500, `prompt too long: ${chars}`);
	assert.equal(messages[0].role, "system");
	assert.equal(messages.at(-1).role, "user");
	assert.match(messages.at(-1).content, /^CONTEXT:\n\[1\]/);
	assert.ok(messages.slice(1, -1).every((m) => !m.content.includes("CONTEXT:")));
	assert.equal(messages[1].role, "user", "history must start with a user turn");
	assert.ok(sources.length >= 1 && sources.every((s) => s.path && s.title));
});

test("no hits still produces a prompt that says so", () => {
	const { messages } = buildMessages({ sitemap: "m", page: { title: "t", path: "p" }, question: "q", hits: [] });
	assert.match(messages.at(-1).content, /nothing relevant/);
});

test("markdown renderer escapes HTML and rejects unsafe links", () => {
	const html = renderMarkdown('<script>alert(1)</script> **bold** `x<y` [ok](https://a.dev/x) [bad](javascript:alert(1))\n\n- one\n- two\n\n```go\nfmt.Println("<hi>")\n```');
	assert.ok(!html.includes("<script>"));
	assert.match(html, /&lt;script&gt;/);
	assert.match(html, /<strong>bold<\/strong>/);
	assert.match(html, /<code>x&lt;y<\/code>/);
	assert.match(html, /<a href="https:\/\/a\.dev\/x" target="_blank" rel="noopener noreferrer">ok<\/a>/);
	assert.ok(!/href="javascript/i.test(html));
	assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
	assert.match(html, /<pre><code data-lang="go">fmt\.Println\(&quot;&lt;hi&gt;&quot;\)<\/code><\/pre>/);
});

test("an unfinished code fence while streaming renders as code, not as markup", () => {
	assert.match(renderMarkdown("Here:\n```js\nconst a = <b>1"), /<pre><code data-lang="js">const a = &lt;b&gt;1<\/code><\/pre>/);
});

test("fallback chunker and suggestions", () => {
	assert.ok(chunkText("One.\n\nTwo.\n\nThree.", { u: "x", t: "X", size: 6 }).length >= 2);
	assert.ok(suggestionsFor("docs/go/channels.html").includes("Summarize this page"));
	assert.ok(suggestionsFor("index.html").length >= 3);
});

test("CPU budget keeps the prompt small", () => {
	const ix = fullIndex();
	const hits = ix.search("explain slices and maps in go", { limit: 12 });
	const { messages } = buildMessages({ sitemap: site.sitemapShort, page: { title: "Home", path: "index.html" }, question: "explain slices", history: [], hits, budget: BUDGETS.cpu });
	const chars = messages.reduce((n, m) => n + m.content.length, 0);
	assert.ok(chars < 3200, `cpu prompt too long: ${chars}`);
	assert.ok(site.sitemapShort.length < 700);
});

test("extractive answers give one passage per page without code", () => {
	const ix = fullIndex();
	const list = extractive(ix.search("go channels buffered", { limit: 12 }));
	assert.equal(new Set(list.map((r) => r.path)).size, list.length);
	assert.equal(list[0].path, "docs/go/channels.html");
	assert.ok(list.every((r) => !r.text.includes("```") && r.text.length <= 400));
	assert.ok(excerpt("A. ".repeat(300), 100).length <= 101);
});

test("errors get a plain explanation and a CPU hint", () => {
	assert.equal(explainError("Unable to find a compatible GPU").cpu, true);
	assert.match(explainError("Device was lost").text, /memory/);
	assert.equal(explainError("TypeError: Failed to fetch").cpu, false);
	assert.equal(explainError("weird").cpu, true);
});

test("definition questions favour a page's opening chunk", () => {
	const ix = fullIndex();
	const byPage = new Map();
	for (const f of ["docs-go"]) for (const c of withTitles(load(f).chunks)) { if (!byPage.has(c.u)) byPage.set(c.u, []); byPage.get(c.u).push(c); }
	const isLead = (c) => byPage.get(c.u)?.[0]?.x === c.x;
	const boost = makeBoost({ path: "docs/go/channels.html", topic: "go", question: "what is a channel?", isLead });
	const hit = ix.search("what is a channel?", { limit: 3, boost })[0].chunk;
	assert.equal(hit.u, "docs/go/channels.html");
	assert.match(hit.x, /typed pipe/);
});

test("instant answers quote the sentence that answers the question", () => {
	const ix = fullIndex();
	const ask = (q, path = "docs/go/channels.html") => {
		const firstOf = new Map();
		for (const c of withTitles(load("docs-go").chunks)) if (!firstOf.has(c.u)) firstOf.set(c.u, c.x);
		const hits = ix.search(q, { limit: 12, boost: makeBoost({ path, topic: "go", question: q, isLead: (c) => firstOf.get(c.u) === c.x }) });
		return bestAnswer(q, hits);
	};
	const a = ask("what is a channel?");
	assert.equal(a.path, "docs/go/channels.html");
	assert.match(a.text, /typed pipe/);
	const b = ask("How do I close a channel safely?");
	assert.match(b.text, /close/i);
	assert.equal(b.path, "docs/go/channels.html");
	const c = ask("show an example of closing a channel");
	assert.ok(c.code, "asks for an example, so a code block comes back");
	assert.equal(ask("zzzz qqqq"), null);
	// naming the docs topic ("in go") must not drag in generic sentences that merely mention it
	assert.equal(ask("what is a channel in go?", "index.html").path, "docs/go/channels.html");
	assert.ok(a.text.length <= 400);
});
