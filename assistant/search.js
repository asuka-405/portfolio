// Retrieval and prompt assembly for the on-device site assistant. Pure functions, no DOM or network,
// so it can be unit-tested with `node --test assistant/assistant.test.mjs`.
//
// A 0.5B model with a 4k-token window cannot be handed a whole docs topic (tens of thousands of words).
// Instead the whole site is indexed (assistant/index/*.json), and for each question the best-matching
// chunks (the open page and its docs topic weighted up) are placed in the prompt.

const STOP = new Set(
	("a an and are as at be but by can could do does for from had has have how i if in into is it its me my of on or our so than that the their them then there these they this to " +
		"was we were what when where which who why will with would you your about tell show please explain give").split(" ")
);

const FOLD = [
	[/c\+\+/g, "cpp"],
	[/c#/g, "csharp"],
	[/\.net\b/g, "dotnet"],
	[/node\.js/g, "nodejs"],
];

function stem(w) {
	if (!/^[a-z]+$/.test(w) || w.length < 5) return w;
	let r = w;
	if (r.endsWith("ies")) r = r.slice(0, -3) + "y";
	else if (r.endsWith("ing") && r.length > 6) r = r.slice(0, -3);
	else if (r.endsWith("ed") && r.length > 5) r = r.slice(0, -2);
	else if (/(sses|xes|zes|ches|shes)$/.test(r)) r = r.slice(0, -2);
	else if (r.endsWith("s") && !r.endsWith("ss")) r = r.slice(0, -1);
	// close, closed, closing and closes all meet at "clos"
	if (r.length > 4 && r.endsWith("e")) r = r.slice(0, -1);
	return r;
}

export function tokenize(text, { keepStop = false } = {}) {
	let s = String(text).toLowerCase();
	for (const [re, to] of FOLD) s = s.replace(re, to);
	const out = [];
	for (const w of s.match(/[\p{L}\p{N}_]+/gu) || []) {
		if (w.length < 2 && !/\d/.test(w)) continue;
		if (!keepStop && STOP.has(w)) continue;
		out.push(stem(w));
	}
	return out;
}

/** BM25 over chunks { u, h, x, t? }. `t` (page title) and `h` (heading) count double. */
export function createIndex() {
	const K1 = 1.4;
	const B = 0.7;
	let chunks = [];
	let postings = new Map(); // term -> [[docIndex, tf], ...]
	let lens = [];
	let avg = 1;

	function rebuild() {
		postings = new Map();
		lens = [];
		let total = 0;
		chunks.forEach((c, i) => {
			const toks = [...tokenize(c.t || ""), ...tokenize(c.t || ""), ...tokenize(c.h || ""), ...tokenize(c.h || ""), ...tokenize(c.x)];
			const tf = new Map();
			for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
			for (const [t, n] of tf) {
				let p = postings.get(t);
				if (!p) postings.set(t, (p = []));
				p.push([i, n]);
			}
			lens.push(toks.length);
			total += toks.length;
		});
		avg = chunks.length ? total / chunks.length : 1;
	}

	return {
		get size() {
			return chunks.length;
		},
		add(list) {
			chunks = chunks.concat(list);
			rebuild();
		},
		/** boost(chunk) multiplies a chunk's score (e.g. the page the visitor is on). Returns [{chunk, score}]. */
		search(query, { limit = 8, boost } = {}) {
			const terms = [...new Set(tokenize(query))];
			if (!terms.length || !chunks.length) return [];
			const scores = new Map();
			for (const term of terms) {
				const p = postings.get(term);
				if (!p) continue;
				const idf = Math.log(1 + (chunks.length - p.length + 0.5) / (p.length + 0.5));
				for (const [i, tf] of p) {
					const s = (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * lens[i]) / avg));
					scores.set(i, (scores.get(i) || 0) + s);
				}
			}
			const out = [];
			for (const [i, s] of scores) out.push({ chunk: chunks[i], score: s * (boost ? boost(chunks[i]) : 1) });
			out.sort((a, b) => b.score - a.score);
			return out.slice(0, limit);
		},
	};
}

/** Chunk raw page text (fallback for pages that are not in the index). */
export function chunkText(text, { u, t, size = 900 } = {}) {
	const paras = String(text).split(/\n{2,}|\n(?=[A-Z0-9#])/).map((p) => p.trim()).filter(Boolean);
	const out = [];
	let buf = "";
	for (const p of paras) {
		if (buf && buf.length + p.length > size) {
			out.push({ u, t, h: "", x: buf });
			buf = "";
		}
		buf += (buf ? "\n" : "") + p;
	}
	if (buf) out.push({ u, t, h: "", x: buf });
	return out;
}

export const SYSTEM_RULES =
	"You are the assistant on Suryansh Kapil's portfolio website (archdev.in). " +
	"Answer the visitor's question using ONLY the CONTEXT given with their message. " +
	"Be concise and direct, a short paragraph or a few bullets. Write code in fenced blocks, copied from the context when possible. " +
	"If the context does not answer the question, say you could not find it on the site and point to the most relevant page from the SITE MAP. " +
	"Never invent facts, links or code. Reply in the visitor's language.";

/**
 * Build the chat messages. Retrieval context goes into the LAST user message so each turn gets fresh
 * context and earlier turns only carry question and answer.
 * Budgets are in characters (about 3.3 per token for mixed prose and code); the model window is 4096 tokens.
 */
export function buildMessages({ sitemap, page, question, history = [], hits = [], budget = {} }) {
	const ctxChars = budget.context ?? 5000;
	const histChars = budget.history ?? 1800;
	const perPage = budget.perPage ?? 3;

	const system = `${SYSTEM_RULES}\n\nSITE MAP (paths are relative to the site root):\n${sitemap}\n\nThe visitor is currently on: ${page.title} (${page.path})`;

	const used = new Map();
	const parts = [];
	const sources = [];
	let left = ctxChars;
	// Weak matches only add noise for a 0.5B model: keep chunks scoring at least 40% of the best real match.
	const best = hits.reduce((m, h) => (h.score < 90 ? Math.max(m, h.score) : m), 0);
	for (const { chunk, score } of hits) {
		const n = used.get(chunk.u) || 0;
		if (n >= perPage || left < 200 || (score < 90 && score < best * 0.4)) continue;
		let body = chunk.x;
		const head = `[${parts.length + 1}] ${chunk.t || chunk.u}${chunk.h && chunk.h !== chunk.t ? " › " + chunk.h : ""} (${chunk.u})\n`;
		if (head.length + body.length > left) body = body.slice(0, Math.max(0, left - head.length)).replace(/\s+\S*$/, "") + "…";
		parts.push(head + body);
		left -= head.length + body.length;
		used.set(chunk.u, n + 1);
		if (!sources.some((s) => s.path === chunk.u)) sources.push({ path: chunk.u, title: chunk.t || chunk.u });
	}

	const context = parts.length ? parts.join("\n\n") : "(nothing relevant was found on the site for this question)";
	const messages = [{ role: "system", content: system }];

	// Keep the most recent turns that fit; long answers are shortened.
	const turns = [];
	let h = histChars;
	for (let i = history.length - 1; i >= 0 && h > 0; i--) {
		const m = history[i];
		const c = m.content.length > 450 ? m.content.slice(0, 450) + "…" : m.content;
		if (c.length > h) break;
		turns.unshift({ role: m.role, content: c });
		h -= c.length;
	}
	while (turns.length && turns[0].role !== "user") turns.shift();
	messages.push(...turns);
	messages.push({ role: "user", content: `CONTEXT:\n${context}\n\nQUESTION: ${question}` });
	return { messages, sources };
}

export function suggestionsFor(path) {
	if (/^docs\/[^/]+\/(?!index\.html)/.test(path)) return ["Summarize this page", "Explain the key idea simply", "Show a short example from this page", "What should I read next?"];
	if (path.startsWith("docs/")) return ["What topics are in the docs?", "Where do I start with Go?", "Which doc covers SailPoint ISC?"];
	if (path.startsWith("articles/")) return ["Summarize this article", "What are the main takeaways?", "What else has Suryansh written?"];
	if (path.startsWith("tools/")) return ["What does this tool do?", "How do I use it?", "What other tools are there?"];
	if (path.startsWith("works/")) return ["What kinds of demos are here?", "Which demo suits a restaurant?", "How can I get something like this built?"];
	if (path.startsWith("projects/")) return ["What is this project?", "What problem does it solve?", "What else has Suryansh built?"];
	return ["What does Suryansh work on?", "Which tools can I try here?", "Where are the Go docs?", "How can I get in touch?"];
}

/** Escape-first markdown subset for model output: fenced and inline code, bold, links, lists, headings. */
export function renderMarkdown(src) {
	const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	const safeHref = (u) => (/^(https?:\/\/|\/|\.\.?\/|#|[a-z0-9][a-z0-9/_.-]*\.html)/i.test(u) && !/^\s*(javascript|data|vbscript):/i.test(u) ? u : null);

	const inline = (t) =>
		esc(t)
			.replace(/`([^`\n]+)`/g, "<code>$1</code>")
			.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
			.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
				const href = safeHref(url.replace(/&amp;/g, "&"));
				if (!href) return label;
				const ext = /^https?:\/\//i.test(href);
				return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
			});

	const lines = String(src).replace(/\r/g, "").split("\n");
	const out = [];
	let list = null; // "ul" | "ol"
	let para = [];
	const endPara = () => {
		if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
		para = [];
	};
	const endList = () => {
		if (list) out.push(`</${list}>`);
		list = null;
	};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
		if (fence) {
			endPara();
			endList();
			const code = [];
			i++;
			while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
			out.push(`<pre><code${fence[1] ? ` data-lang="${esc(fence[1])}"` : ""}>${esc(code.join("\n"))}</code></pre>`);
			continue;
		}
		const li = line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/);
		if (li) {
			endPara();
			const kind = li[1] ? "ul" : "ol";
			if (list !== kind) {
				endList();
				out.push(`<${kind}>`);
				list = kind;
			}
			out.push(`<li>${inline(li[3])}</li>`);
			continue;
		}
		if (!line.trim()) {
			endPara();
			endList();
			continue;
		}
		endList();
		const hd = line.match(/^#{1,4}\s+(.*)$/);
		if (hd) {
			endPara();
			out.push(`<p><strong>${inline(hd[1])}</strong></p>`);
			continue;
		}
		para.push(line);
	}
	endPara();
	endList();
	return out.join("");
}

/** Prompt budgets (characters) per model tier. The CPU model processes prompts slowly, so it gets much less. */
export const BUDGETS = {
	gpu: { context: 5000, history: 1800, perPage: 3 },
	cpu: { context: 1700, history: 500, perPage: 2 },
};

/** A readable snippet: code fences dropped, whitespace collapsed, cut at a sentence end where possible. */
export function excerpt(text, max = 360) {
	const t = String(text).replace(/```[\s\S]*?```/g, " ").replace(/`/g, "").replace(/\s+/g, " ").trim();
	if (t.length <= max) return t;
	const cut = t.slice(0, max);
	const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
	return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
}

/** No-model answer: the best passages, one per page, straight from the site. */
export function extractive(hits, { limit = 4 } = {}) {
	const seen = new Set();
	const out = [];
	const floor = hits.length ? hits[0].score * 0.3 : 0; // drop weak matches next to a strong one
	for (const { chunk, score } of hits) {
		if (score < floor || seen.has(chunk.u)) continue;
		seen.add(chunk.u);
		const text = excerpt(chunk.x, out.length ? 150 : 380);
		if (!text) continue;
		out.push({ path: chunk.u, title: chunk.t || chunk.u, heading: chunk.h && chunk.h !== chunk.t ? chunk.h : "", text });
		if (out.length === limit) break;
	}
	return out;
}

/** Plain-language reason for a model start-up failure, plus whether the CPU model is worth offering. */
export function explainError(message) {
	const m = String(message || "");
	if (/adapter|webgpu.*(not|unavailable|support)|compatible gpu|no gpu/i.test(m)) return { text: "Your browser or graphics card cannot run WebGPU.", cpu: true };
	if (/device.*lost|out of memory|\boom\b|allocat|createbuffer|memory/i.test(m)) return { text: "Your graphics card ran out of memory.", cpu: true };
	if (/limit|maxstoragebuffer|maxbuffersize|exceeds|too large/i.test(m)) return { text: "Your graphics card is too limited for this model.", cpu: true };
	if (/quota|not enough free browser storage/i.test(m)) return { text: "The browser has no room to store the model.", cpu: false };
	if (/failed to fetch|networkerror|network|load failed|timeout|err_/i.test(m)) return { text: "The download was interrupted. Check your connection and try again; it picks up where it stopped.", cpu: false };
	return { text: "The model could not be started.", cpu: true };
}

/** Score multiplier: the open page and its docs topic count more; for "what is..." questions a page's opening chunk does too. */
export function makeBoost({ path, topic, question, isLead }) {
	const definitional = /^\s*(what|who|why|explain|describe|define|tell me about|summari[sz]e)\b/i.test(question);
	return (c) => {
		let b = c.u === path ? 1.7 : topic && c.u.startsWith(`docs/${topic}/`) ? 1.2 : 1;
		if (definitional && isLead(c)) b *= 1.4;
		return b;
	};
}

const splitSentences = (t) =>
	String(t)
		.split(/\n+/)
		.flatMap((line) => line.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z`(\["'])/))
		.map((s) => s.trim())
		.filter(Boolean);

/**
 * Instant answer without a model: the sentence (plus a neighbour if it is short) that best covers the
 * question's words, taken from the top few chunks. Adds the first code block when the question asks for an example.
 * Everything returned is the author's own text, so it cannot be invented.
 */
export function bestAnswer(question, hits, { maxChars = 380, codeMax = 520 } = {}) {
	const terms = new Set(tokenize(question));
	if (!terms.size || !hits.length) return null;
	const definitional = /^\s*(what|who|why|explain|describe|define|tell me about|summari[sz]e)\b/i.test(question);
	const top = hits[0].score || 1;
	// A word found in nearly every hit ("go" on a Go docs site) says little about which sentence answers; rarer words count more.
	const pool = hits.slice(0, 12).map((h) => new Set(tokenize(h.chunk.x)));
	// The docs topic named in the question ("channel in go") is context, not what the visitor is asking about.
	const topicName = new Set(tokenize(hits[0].chunk.u.match(/^docs\/([^/]+)\//)?.[1] || ""));
	const weight = new Map([...terms].map((t) => [t, Math.log(1 + pool.length / (1 + pool.filter((p) => p.has(t)).length)) * (topicName.has(t) ? 0.25 : 1)]));
	const weightSum = [...weight.values()].reduce((a, b) => a + b, 0) || 1;
	let best = null;
	hits.slice(0, 4).forEach(({ chunk, score }, rank) => {
		const sents = splitSentences(chunk.x.replace(/```[\s\S]*?```/g, " ").replace(/`/g, ""));
		const headToks = new Set(tokenize(`${chunk.h || ""} ${chunk.t || ""}`));
		let headHit = 0;
		for (const t of terms) if (headToks.has(t)) headHit += weight.get(t);
		const firstReal = sents.findIndex((s) => s.length >= 25 && s !== chunk.t); // lead chunks start with the page title as its own line
		sents.forEach((s, i) => {
			const toks = new Set(tokenize(s));
			let matched = 0;
			for (const t of terms) if (toks.has(t)) matched += weight.get(t);
			if (!matched) return;
			let sc = (matched / weightSum) * 2 + Math.min(1, score / top) * 1.4 - rank * 0.05;
			if (definitional && i === firstReal && (!chunk.h || chunk.h === chunk.t)) sc += 0.6; // the opening sentence of a page usually defines it
			sc += (headHit / weightSum) * 1.2; // a passage under a heading that names the topic is likelier to explain it
			if (s.length < 25) sc -= 0.5;
			if (!best || sc > best.sc) best = { sc, chunk, sents, i };
		});
	});
	if (!best) return null;
	let text = best.sents[best.i];
	for (let j = best.i + 1; j < best.sents.length && text.length < 170; j++) text += " " + best.sents[j];
	if (text.length > maxChars) text = text.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
	let code = null;
	if (/\b(example|code|snippet|show|write|implement|syntax|how (do|to|can))\b/i.test(question)) {
		const m = best.chunk.x.match(/```\n?([\s\S]*?)```/);
		if (m) code = m[1].trim().slice(0, codeMax).replace(/\n[^\n]*$/, (r) => (m[1].trim().length > codeMax ? "\n…" : r));
	}
	return { text, code, path: best.chunk.u, title: best.chunk.t || best.chunk.u, heading: best.chunk.h && best.chunk.h !== best.chunk.t ? best.chunk.h : "" };
}
