// On-device site assistant: panel UI, consent and download flow, retrieval, and streaming chat.
// Loaded lazily by launcher.js the first time the floating button is pressed. Nothing is downloaded until the
// visitor agrees. Three models and an instant mode, switchable at any time, even mid-conversation:
//   qwen-gpu   Qwen2.5 0.5B Instruct, 4-bit, WebLLM on WebGPU (about 295 MB). Best answers, needs a working GPU
//   qwen-cpu   the same model as GGUF Q4_0, llama.cpp compiled to WebAssembly via wllama, no GPU needed (about 429 MB)
//   smol-cpu   SmolLM2 360M Instruct, GGUF Q4_0 via wllama, the lightest option (about 230 MB)
//   search     no model at all: passages quoted straight from the site (nothing to download)
// The panel recommends one of these from what the device can do (see recommend()).
import { createIndex, chunkText, buildMessages, renderMarkdown, suggestionsFor, BUDGETS, extractive, explainError, makeBoost, bestAnswer } from "./search.js";

const BASE = new URL("../", import.meta.url); // site root
const here = (p) => new URL(p, import.meta.url).href;
const WEBLLM_URL = here("./vendor/web-llm.min.js");
const WLLAMA_URL = here("./vendor/wllama/wllama.min.js");
const WLLAMA_WASM = here("./vendor/wllama/wllama.wasm");
const WORKER_URL = here("./worker.js");

const MODEL_F16 = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const MODEL_F32 = "Qwen2.5-0.5B-Instruct-q4f32_1-MLC"; // same download size, for GPUs without shader-f16
const MODELS = {
	"qwen-gpu": {
		name: "Qwen2.5 0.5B",
		engine: "gpu",
		where: "GPU",
		mb: 295,
		tag: "Best answers",
		memory: "about 1 GB of GPU memory",
		credit: "Qwen2.5-0.5B-Instruct by Alibaba Cloud (Apache-2.0), run with WebLLM.",
	},
	"qwen-cpu": {
		name: "Qwen2.5 0.5B",
		engine: "cpu",
		where: "CPU",
		mb: 429,
		tag: "Same model, no GPU needed",
		memory: "about 700 MB of memory",
		gguf: { repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF", file: "qwen2.5-0.5b-instruct-q4_0.gguf" },
		credit: "Qwen2.5-0.5B-Instruct by Alibaba Cloud (Apache-2.0), run with wllama.",
	},
	"smol-cpu": {
		name: "SmolLM2 360M",
		engine: "cpu",
		where: "CPU",
		mb: 230,
		tag: "Lightest, for modest computers",
		memory: "about 500 MB of memory",
		gguf: { repo: "bartowski/SmolLM2-360M-Instruct-GGUF", file: "SmolLM2-360M-Instruct-Q4_0.gguf" },
		credit: "SmolLM2-360M-Instruct by Hugging Face (Apache-2.0), run with wllama.",
	},
};
for (const [key, m] of Object.entries(MODELS)) m.key = key;
const CPU_CTX = 2048;
const FAST_CPU = 1.2; // cpuScore() threshold. A 2019 Ryzen 5 3500U laptop scores about 0.5 in Chrome and takes over a minute per answer, so "fast" is a clear step above it
const FLAG_KEY = "archdev-ai";

const THIS_PAGE = /\b(this|current)\s+(page|article|post|doc|docs?|document|section|tool|project|site|chapter)\b|\b(summari[sz]e|tl;?dr|above)\b/i;

let loadWebLLM = () => import(WEBLLM_URL); // swappable in tests
let loadWllama = () => import(WLLAMA_URL);
export const testing = { setWebLLM: (f) => (loadWebLLM = f), setWllama: (f) => (loadWllama = f) };

const state = {
	view: "init", // pick | consent | loading | ready | error
	mode: "model", // "model" (answer with the loaded engine) or "search" (instant answers)
	model: null, // key of the model being offered, loaded or loading
	engineKey: null, // key of the model whose engine is in memory
	gpu: { ok: false, reason: "", modelId: MODEL_F32, diag: "" },
	lowEnd: false,
	cpuScore: 0,
	rec: { key: "search", why: "" },
	engine: null,
	consent: new Set(),
	busy: false,
	history: [],
	lastQuestion: "",
	removeArmed: false,
	runId: 0,
	everReady: false,
	lastError: "",
};

const idx = { site: null, search: createIndex(), catalog: createIndex(), titleOf: new Map(), byPage: new Map(), loading: new Map(), loaded: new Set() };

let panel;
let closeModels = () => {};
let opener = null;
let started = false;
const $ = (s) => panel.querySelector(s);

/* ───────────────────────── storage flags ───────────────────────── */

// What this browser has downloaded and which option the visitor last chose. The files themselves live in
// Cache Storage; this only remembers that they should be there, so a missing file falls back to the consent view.
const readStore = () => {
	try {
		const v = JSON.parse(localStorage.getItem(FLAG_KEY)) || {};
		if (v.tier) {
			const key = v.tier === "gpu" ? "qwen-gpu" : "qwen-cpu"; // flag written by the first version
			return { have: [key], pref: key };
		}
		return { have: (Array.isArray(v.have) ? v.have : []).filter((k) => MODELS[k]), pref: v.pref === "search" || MODELS[v.pref] ? v.pref : null };
	} catch {
		return { have: [], pref: null };
	}
};
const saveStore = (patch) => {
	try {
		localStorage.setItem(FLAG_KEY, JSON.stringify({ ...readStore(), ...patch }));
	} catch {}
};

/* ───────────────────────── index and retrieval ───────────────────────── */

async function getJSON(name) {
	const r = await fetch(new URL(`assistant/index/${name}.json`, BASE));
	if (!r.ok) throw new Error(`index ${name}: ${r.status}`);
	return r.json();
}

function addChunks(chunks) {
	const list = chunks.map((c) => ({ ...c, t: idx.titleOf.get(c.u) }));
	for (const c of list) {
		if (!idx.byPage.has(c.u)) idx.byPage.set(c.u, []);
		idx.byPage.get(c.u).push(c);
	}
	idx.search.add(list);
}

function ensureSite() {
	if (!idx.loading.has("site")) {
		idx.loading.set(
			"site",
			getJSON("site").then((d) => {
				idx.site = d;
				for (const p of d.pages) idx.titleOf.set(p.u, p.t);
				addChunks(d.chunks);
				idx.catalog.add(d.pages.map((p) => ({ u: p.u, t: p.t, h: "", x: p.d || p.t })));
				idx.loaded.add("site");
			})
		);
	}
	return idx.loading.get("site");
}

function ensureTopic(topic) {
	const key = `docs-${topic}`;
	if (!idx.loading.has(key)) {
		idx.loading.set(
			key,
			getJSON(key)
				.then((d) => {
					addChunks(d.chunks);
					idx.loaded.add(key);
				})
				.catch(() => idx.loading.delete(key))
		);
	}
	return idx.loading.get(key);
}

function pageInfo() {
	let rel = decodeURIComponent(location.pathname.slice(BASE.pathname.length));
	if (!rel || rel.endsWith("/")) rel += "index.html";
	if (!idx.titleOf.has(rel)) {
		if (idx.titleOf.has(rel + ".html")) rel += ".html";
		else if (idx.titleOf.has(rel + "/index.html")) rel += "/index.html";
	}
	const title = idx.titleOf.get(rel) || document.title.replace(/\s*[·|—-]\s*Suryansh Kapil\s*$/i, "") || rel;
	return { path: rel, title, topic: rel.match(/^docs\/([^/]+)\//)?.[1] || null };
}

function ownChunks(pg) {
	const list = idx.byPage.get(pg.path);
	if (list && list.length) return list;
	// Not in the index (new page, or a tool with live content): read it from the page itself.
	const main = document.querySelector("main") || document.body;
	return chunkText(main.innerText || "", { u: pg.path, t: pg.title });
}

async function retrieve(question) {
	await ensureSite();
	const pg = pageInfo();
	if (pg.topic) await ensureTopic(pg.topic);

	// Short follow-ups ("and for maps?") borrow the previous question's words.
	const query = question.split(/\s+/).length < 5 && state.lastQuestion ? `${state.lastQuestion} ${question}` : question;

	// Pull in other docs topics the question points at (at most two new ones per question).
	let added = 0;
	for (const { chunk } of idx.catalog.search(query, { limit: 4 })) {
		const t = chunk.u.match(/^docs\/([^/]+)\//)?.[1];
		if (t && !idx.loaded.has(`docs-${t}`) && added < 2) {
			await ensureTopic(t);
			added++;
		}
	}

	const boost = makeBoost({ path: pg.path, topic: pg.topic, question, isLead: (c) => idx.byPage.get(c.u)?.[0] === c });
	let hits = idx.search.search(query, { limit: 16, boost });
	if (THIS_PAGE.test(question) || !hits.length) {
		const own = ownChunks(pg).slice(0, 3).map((chunk) => ({ chunk, score: 99 }));
		hits = [...own, ...hits.filter((h) => h.chunk.u !== pg.path)];
	}
	return { hits, pg };
}

/* ───────────────────────── device checks ───────────────────────── */

async function detectGpu() {
	const lines = [`userAgent: ${navigator.userAgent}`, `hardwareConcurrency: ${navigator.hardwareConcurrency ?? "?"}, deviceMemory: ${navigator.deviceMemory ?? "?"} GB`, `crossOriginIsolated: ${self.crossOriginIsolated}`];
	const fail = (reason) => ({ ok: false, reason, modelId: MODEL_F32, diag: lines.concat(`webgpu: ${reason}`).join("\n") });
	if (!navigator.gpu) return fail("This browser does not support WebGPU.");
	try {
		const ad = await navigator.gpu.requestAdapter();
		if (!ad) return fail("No compatible graphics adapter was found for WebGPU.");
		const f16 = ad.features.has("shader-f16");
		const info = ad.info || {};
		lines.push(`adapter: ${[info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(" / ") || "unknown"}`);
		lines.push(`shader-f16: ${f16}, maxBufferSize: ${ad.limits.maxBufferSize}, maxStorageBufferBindingSize: ${ad.limits.maxStorageBufferBindingSize}, fallback: ${ad.isFallbackAdapter ?? info.isFallbackAdapter ?? "?"}`);
		// A software renderer "works" but is slower than the CPU models, so it does not count as a GPU.
		if (ad.isFallbackAdapter || info.isFallbackAdapter) return fail("Only software graphics are available, not a real GPU.");
		// Open and close a device now, so a broken driver shows up here and not 300 MB into a download.
		try {
			const dev = await ad.requestDevice(f16 ? { requiredFeatures: ["shader-f16"] } : {});
			dev.destroy();
		} catch (e) {
			return { ok: false, reason: "The GPU could not be opened: " + String(e.message || e).slice(0, 120), modelId: MODEL_F32, diag: lines.concat(`requestDevice: ${e.message}`).join("\n") };
		}
		return { ok: true, reason: "", modelId: f16 ? MODEL_F16 : MODEL_F32, diag: lines.join("\n") };
	} catch (e) {
		return fail("WebGPU is not available right now (" + String(e.message || e).slice(0, 80) + ").");
	}
}

// Rough single-thread speed in billions of multiply-adds per second. The CPU models run as single-threaded
// WebAssembly, so this predicts them better than the core count does. Takes about 120 ms.
function cpuScore() {
	const n = 1 << 14;
	const a = new Float32Array(n);
	const b = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		a[i] = i % 7;
		b[i] = i % 5;
	}
	let s0 = 0, s1 = 0, s2 = 0, s3 = 0, reps = 0;
	const t0 = performance.now();
	while (performance.now() - t0 < 120) {
		for (let i = 0; i < n; i += 4) {
			s0 += a[i] * b[i];
			s1 += a[i + 1] * b[i + 1];
			s2 += a[i + 2] * b[i + 2];
			s3 += a[i + 3] * b[i + 3];
		}
		reps++;
	}
	return s0 + s1 + s2 + s3 >= 0 ? (reps * n) / (performance.now() - t0) / 1e6 : 0;
}

let deviceCheck = null;
function ensureDevice() {
	if (!deviceCheck) {
		deviceCheck = (async () => {
			state.lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || false;
			state.gpu = await detectGpu();
			state.cpuScore = cpuScore();
			state.rec = recommend();
		})();
	}
	return deviceCheck;
}

const sentence = (t) => t.replace(/\.?\s*$/, ".");

// The best choice for this device, with the reason shown to the visitor.
function recommend() {
	if (state.lowEnd) return { key: "search", why: "This device looks short on memory or processing power, so instant answers are the safe choice." };
	if (state.gpu.ok) return { key: "qwen-gpu", why: "Your graphics card can run the best model quickly." };
	if (state.cpuScore >= FAST_CPU) return { key: "smol-cpu", why: `${sentence(state.gpu.reason)} Your processor is fast enough for the lightest model, though expect a few seconds before each answer starts.` };
	return { key: "search", why: `${sentence(state.gpu.reason)} Without a GPU the AI models need a minute or more per answer on this processor, so instant answers are recommended.` };
}

async function ensureStorage(needMB) {
	try {
		if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); // keep the model from being evicted
		const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
		if (est && est.quota && (est.quota - (est.usage || 0)) / 1e6 < needMB + 150) {
			throw new Error(`Not enough free browser storage. The model needs about ${needMB + 150} MB free.`);
		}
	} catch (e) {
		if (/free browser storage/.test(e.message)) throw e;
	}
}

/* ───────────────────────── engines ───────────────────────── */
// An engine is { kind, stream(messages) -> async iterator of { delta, finish }, interrupt(), dispose() }.
// Only one engine is kept in memory; switching models disposes the old one first.

function progressLabel(r, mb) {
	const t = r.text || "";
	let m = t.match(/Fetching param cache\[(\d+)\/(\d+)\]: (\d+)MB fetched/);
	if (m) return { phase: "Downloading the model", detail: `${m[3]} MB of about ${mb - 5} MB` };
	m = t.match(/Loading model from cache\[(\d+)\/(\d+)\]/);
	if (m) return { phase: "Loading the model from your browser storage", detail: `part ${m[1]} of ${m[2]}` };
	m = t.match(/Loading GPU shader modules\[(\d+)\/(\d+)\]/);
	if (m) return { phase: "Preparing your GPU", detail: `${m[1]} of ${m[2]}` };
	return { phase: t.split(/[.:\[]/)[0] || "Starting", detail: "" };
}

async function startGpuEngine(m, run) {
	const lib = await loadWebLLM();
	const modelId = state.gpu.modelId;
	const cached = await lib.hasModelInCache(modelId);
	if (!cached && !state.consent.has(m.key)) return null;
	if (!cached) await ensureStorage(m.mb);
	const worker = new Worker(WORKER_URL, { type: "module" });
	let engine;
	try {
		engine = await lib.CreateWebWorkerMLCEngine(worker, modelId, {
			initProgressCallback: (r) => {
				if (run !== state.runId) return;
				const l = progressLabel(r, m.mb);
				setProgress(r.progress || 0, l.phase, l.detail);
			},
		});
	} catch (e) {
		worker.terminate();
		throw e;
	}
	return {
		kind: "gpu",
		async *stream(messages) {
			const s = await engine.chat.completions.create({ messages, stream: true, temperature: 0.3, top_p: 0.9, repetition_penalty: 1.08, max_tokens: 512 });
			for await (const part of s) yield { delta: part.choices[0]?.delta?.content || "", finish: part.choices[0]?.finish_reason || null };
		},
		interrupt: () => engine.interruptGenerate(),
		dispose: () => worker.terminate(),
	};
}

async function cpuCachedEntry(lib, file) {
	try {
		const list = await new lib.CacheManager().list();
		return list.some((e) => (e.metadata?.originalURL || e.name).includes(file) && e.size >= (e.metadata?.originalSize || 1));
	} catch {
		return false;
	}
}

async function startCpuEngine(m, run) {
	const lib = await loadWllama();
	const cached = await cpuCachedEntry(lib, m.gguf.file);
	if (!cached && !state.consent.has(m.key)) return null;
	if (!cached) await ensureStorage(m.mb);
	const w = new lib.Wllama({ default: WLLAMA_WASM }, { suppressNativeLog: true, logger: lib.LoggerWithoutDebug });
	setProgress(0, cached ? "Loading the model from your browser storage" : "Downloading the model", "");
	await w.loadModelFromHF(m.gguf, {
		n_ctx: CPU_CTX,
		useCache: true,
		progressCallback: ({ loaded, total }) => {
			if (run !== state.runId) return;
			const done = total ? loaded / total : 0;
			if (done >= 1) setProgress(1, "Loading the model into memory", "this can take a moment");
			else setProgress(done, "Downloading the model", `${Math.round(loaded / 1e6)} MB of ${Math.round(total / 1e6)} MB`);
		},
	});
	let ac = null;
	return {
		kind: "cpu",
		async *stream(messages) {
			ac = new AbortController();
			try {
				const it = await w.createChatCompletion({ messages, stream: true, max_tokens: 320, temperature: 0.3, top_p: 0.9, top_k: 40, abortSignal: ac.signal });
				for await (const ch of it) yield { delta: ch.choices?.[0]?.delta?.content || "", finish: ch.choices?.[0]?.finish_reason || null };
			} catch (e) {
				if (/abort/i.test(String(e && (e.name + e.message)))) return; // the visitor pressed stop
				throw e;
			}
		},
		interrupt: () => ac && ac.abort(),
		dispose: () => w.exit().catch(() => {}),
	};
}

async function startModel(key) {
	const m = MODELS[key];
	const run = ++state.runId;
	state.model = key;
	disposeEngine();
	setView("loading");
	setProgress(0, "Starting…", "");
	try {
		const engine = await (m.engine === "gpu" ? startGpuEngine(m, run) : startCpuEngine(m, run));
		if (run !== state.runId) return engine && engine.dispose(); // cancelled, or another model was picked meanwhile
		if (!engine) {
			// the store said it was downloaded, but it is not: ask again instead of downloading silently
			renderConsent(key);
			return setView("consent");
		}
		state.engine = engine;
		state.engineKey = key;
		state.mode = "model";
		state.everReady = true;
		saveStore({ have: [...new Set([...readStore().have, key])], pref: key });
		announce(`Now answering with ${m.name} on your ${m.where}.`);
		setView("ready");
	} catch (e) {
		if (run !== state.runId) return;
		disposeEngine();
		showError(e);
	}
}

function disposeEngine() {
	try {
		state.engine && state.engine.dispose();
	} catch {}
	state.engine = null;
	state.engineKey = null;
}

// Back to something that works: the chat in instant mode if there is a chat, else the model picker.
function fallback(note) {
	if (!state.everReady) return showPick();
	useSearch(false);
	announce(note);
}

function cancelLoad() {
	state.runId++;
	disposeEngine();
	fallback("Loading was cancelled. Using instant answers.");
}

function useSearch(remember) {
	state.mode = "search";
	if (remember) saveStore({ pref: "search" });
	state.everReady = true;
	removeEmptyState();
	setView("ready");
}

// Switch to any option from the picker. Models downloaded before load straight from browser storage; the
// others go through the consent view first.
function choose(key) {
	closeModels();
	if (state.busy) return;
	if (key === "search") {
		if (state.mode !== "search") announce("Switched to instant answers.");
		return useSearch(true);
	}
	const m = MODELS[key];
	if (state.engine && state.engineKey === key) {
		if (state.mode !== "model") announce(`Now answering with ${m.name} on your ${m.where}.`);
		state.mode = "model";
		saveStore({ pref: key });
		removeEmptyState();
		return setView("ready");
	}
	if (!availability(key).ok) return;
	if (readStore().have.includes(key)) return startModel(key);
	renderConsent(key);
	setView("consent");
}

function availability(key) {
	if (key === "qwen-gpu" && !state.gpu.ok) return { ok: false, why: state.gpu.reason };
	return { ok: true, why: "" };
}

async function removeModels() {
	state.runId++;
	disposeEngine();
	try {
		for (const c of ["webllm/model", "webllm/config", "webllm/wasm"]) await caches.delete(c);
	} catch {}
	try {
		const lib = await loadWllama();
		const files = Object.values(MODELS).flatMap((m) => (m.gguf ? [m.gguf.file] : []));
		await new lib.CacheManager().deleteMany((e) => files.some((f) => (e.metadata?.originalURL || e.name).includes(f)));
	} catch {}
	saveStore({ have: [], pref: state.mode === "search" ? "search" : null });
	state.consent.clear();
	state.mode = "search";
	state.everReady = true;
	removeEmptyState();
	setView("ready");
	announce("The downloaded models were removed from this browser. Using instant answers.");
}

function showError(e) {
	const raw = String((e && e.message) || e || "Unknown error");
	state.lastError = raw;
	const ex = explainError(raw);
	const m = MODELS[state.model];
	console.error("[assistant]", e);
	$("#ai-error-text").textContent = ex.text;
	$("#ai-diag").textContent = [`error: ${raw.slice(0, 400)}`, `model: ${m ? m.key + " (" + (m.engine === "gpu" ? state.gpu.modelId : m.gguf.file) + ")" : "?"}`, state.gpu.diag].join("\n");
	setView("error");
}

/* ───────────────────────── chat ───────────────────────── */

function addMessage(role, html) {
	const log = $("#ai-log");
	const el = document.createElement("div");
	el.className = `ai-msg ai-${role}`;
	const body = document.createElement("div");
	body.className = "ai-bubble";
	if (html != null) body.innerHTML = html;
	el.appendChild(body);
	log.appendChild(el);
	stickScroll(true);
	return { el, body };
}

// A small centred line in the conversation, e.g. when the visitor switches model.
function announce(text) {
	const log = $("#ai-log");
	if (!log || !log.querySelector(".ai-msg")) return;
	const el = document.createElement("div");
	el.className = "ai-switchnote";
	el.textContent = text;
	log.appendChild(el);
	stickScroll(true);
}

let stick = true;
function stickScroll(force) {
	const log = $("#ai-log");
	if (force || stick) log.scrollTop = log.scrollHeight;
}

const pageUrl = (path) => new URL(path, BASE).href;

function sourceLinks(sources, pg) {
	const wrap = document.createElement("div");
	wrap.className = "ai-sources";
	const label = document.createElement("span");
	label.textContent = "From:";
	wrap.appendChild(label);
	for (const s of sources.slice(0, 3)) {
		const a = document.createElement("a");
		a.href = pageUrl(s.path);
		a.textContent = s.path === pg.path ? `${s.title} (this page)` : s.title;
		wrap.appendChild(a);
	}
	return wrap;
}

async function ask(raw) {
	const question = raw.trim().slice(0, 600);
	if (!question || state.busy) return;
	removeEmptyState();
	addMessage("user", null).body.textContent = question;
	state.busy = true;
	setSending(true);
	$("#ai-log").setAttribute("aria-busy", "true");
	const slow = state.mode === "model" && state.engine && state.engine.kind === "cpu" && state.cpuScore < FAST_CPU;
	const reply = addMessage("assistant", `<span class="ai-typing" aria-label="Thinking"><i></i><i></i><i></i></span>${slow ? '<span class="ai-wait">Running on your CPU: it can take 10 to 30 seconds before the first word.</span>' : ""}`);
	try {
		const { hits, pg } = await retrieve(question);
		if (state.mode === "search" || !state.engine) renderSearchOnly(reply, hits, pg, question);
		else await generate(reply, question, hits, pg);
		state.lastQuestion = question;
	} catch (e) {
		console.error("[assistant]", e);
		reply.body.textContent = "Sorry, something went wrong: " + explainError(String((e && e.message) || e)).text;
	} finally {
		state.busy = false;
		setSending(false);
		$("#ai-log").removeAttribute("aria-busy");
		stickScroll();
		$("#ai-input").focus({ preventScroll: true });
	}
}

function renderSearchOnly(reply, hits, pg, question) {
	const ans = bestAnswer(question, hits);
	const results = extractive(
		hits.filter((h) => !ans || h.chunk.u !== ans.path),
		{ limit: ans ? 3 : 4 }
	);
	reply.body.textContent = "";
	if (!ans && !results.length) {
		reply.body.textContent = "I could not find anything about that on the site. Try different words, or browse the docs, articles and tools from the menu.";
		return;
	}
	const rest = results;
	let lead = ans;
	if (!lead) lead = { ...rest.shift(), code: null };
	const quote = document.createElement("blockquote");
	quote.className = "ai-quote";
	quote.textContent = lead.text;
	reply.body.appendChild(quote);
	if (lead.code) {
		const pre = document.createElement("pre");
		const code = document.createElement("code");
		code.textContent = lead.code;
		pre.appendChild(code);
		reply.body.appendChild(pre);
	}
	const from = document.createElement("a");
	from.href = pageUrl(lead.path);
	from.textContent = lead.title + (lead.heading ? " › " + lead.heading : "") + (lead.path === pg.path ? " (this page)" : "");
	reply.body.appendChild(from);
	if (rest.length) {
		const more = document.createElement("p");
		more.className = "ai-more";
		more.textContent = "Also relevant:";
		const ul = document.createElement("ul");
		ul.className = "ai-results";
		for (const r of rest) {
			const li = document.createElement("li");
			const a = document.createElement("a");
			a.href = pageUrl(r.path);
			a.textContent = r.title + (r.heading ? " › " + r.heading : "");
			const sp = document.createElement("span");
			sp.textContent = r.text;
			li.append(a, sp);
			ul.appendChild(li);
		}
		reply.body.append(more, ul);
	}
}

async function generate(reply, question, hits, pg) {
	await ensureSite();
	const cpu = state.engine.kind === "cpu";
	const run = async (budget) => {
		const { messages, sources } = buildMessages({
			sitemap: cpu ? idx.site.sitemapShort || idx.site.sitemap : idx.site.sitemap,
			page: pg,
			question,
			history: budget.history === 0 ? [] : state.history,
			hits,
			budget,
		});
		let text = "";
		let queued = false;
		const paint = () => {
			queued = false;
			reply.body.innerHTML = renderMarkdown(text);
			stickScroll();
		};
		let finish = null;
		for await (const part of state.engine.stream(messages)) {
			if (part.delta) {
				text += part.delta;
				if (!queued) {
					queued = true;
					requestAnimationFrame(paint);
				}
			}
			finish = part.finish || finish;
		}
		paint();
		return { text, sources, finish };
	};

	const base = cpu ? BUDGETS.cpu : BUDGETS.gpu;
	let out;
	try {
		out = await run(base);
	} catch (e) {
		if (!/context|exceed|too long|n_ctx/i.test(String(e && (e.name + e.message)))) throw e;
		out = await run({ ...base, context: Math.floor(base.context / 2), history: 0 });
	}
	if (!out.text.trim()) reply.body.textContent = "I could not come up with an answer. Try rephrasing the question.";
	else if (out.finish === "length") reply.body.insertAdjacentHTML("beforeend", '<p class="ai-note">Answer cut short. Ask me to continue.</p>');
	if (out.sources.length) reply.el.appendChild(sourceLinks(out.sources, pg));
	if (out.text.trim()) {
		state.history.push({ role: "user", content: question }, { role: "assistant", content: out.text });
		state.history = state.history.slice(-8);
	}
}

function stopGenerating() {
	try {
		state.engine && state.engine.interrupt();
	} catch {}
}

function clearChat() {
	state.history = [];
	state.lastQuestion = "";
	$("#ai-log").innerHTML = "";
	showEmptyState();
}

const SEARCH_IDEAS = ["goroutines and channels", "SailPoint ISC versus IdentityIQ", "cron expression explainer", "Arch Linux setup"];

function showEmptyState() {
	const pg = pageInfo();
	const box = document.createElement("div");
	box.className = "ai-empty";
	const lead = document.createElement("p");
	lead.textContent =
		state.mode === "search"
			? "Ask a question. You get an instant answer quoted from the site, with a link to the page."
			: pg.topic
				? `Ask about ${pg.title}, or anything else in these docs and on the site.`
				: "Ask about this page or anything else on the site: docs, articles, tools and projects.";
	box.appendChild(lead);
	const row = document.createElement("div");
	row.className = "ai-chips";
	for (const s of state.mode === "search" ? SEARCH_IDEAS : suggestionsFor(pg.path)) {
		const b = document.createElement("button");
		b.type = "button";
		b.textContent = s;
		b.addEventListener("click", () => ask(s));
		row.appendChild(b);
	}
	box.appendChild(row);
	$("#ai-log").appendChild(box);
}

function removeEmptyState() {
	const e = $("#ai-log .ai-empty");
	if (e) e.remove();
}

/* ───────────────────────── views ───────────────────────── */

function renderPick() {
	const rec = MODELS[state.rec.key];
	$("#ai-pick-why").textContent = `Recommended for this device: ${state.rec.key === "search" ? "instant answers" : rec.name + " on your " + rec.where}. ${state.rec.why}`;
	optionRows($("#ai-pick-list"), false);
}

function showPick() {
	renderPick();
	setView("pick");
}

// The four options (three models and instant answers) as rows, used by the first-run picker and the header menu.
function optionRows(root, menu) {
	const store = readStore();
	root.textContent = "";
	for (const key of [...Object.keys(MODELS), "search"]) {
		const m = MODELS[key];
		const av = availability(key);
		const active = key === "search" ? state.mode === "search" && state.everReady : state.mode === "model" && state.engineKey === key;
		const b = document.createElement("button");
		b.type = "button";
		b.className = "ai-opt" + (active ? " is-active" : "");
		b.disabled = !av.ok;
		if (menu) {
			b.setAttribute("role", "menuitemradio");
			b.setAttribute("aria-checked", String(active));
		}
		const top = document.createElement("span");
		top.className = "ai-opt-top";
		const name = document.createElement("strong");
		name.textContent = key === "search" ? "Instant answers" : `${m.name} · ${m.where}`;
		top.appendChild(name);
		if (state.rec.key === key) {
			const badge = document.createElement("em");
			badge.className = "ai-badge";
			badge.textContent = "Recommended";
			top.appendChild(badge);
		}
		const meta = document.createElement("span");
		meta.className = "ai-opt-meta";
		meta.textContent = key === "search" ? "No download · replies at once · quotes the site" : `${m.tag} · ${m.mb} MB`;
		const st = document.createElement("span");
		st.className = "ai-opt-state";
		st.textContent = !av.ok ? `Not available: ${av.why}` : active ? "In use" : key === "search" ? "" : store.have.includes(key) ? "Downloaded, loads from your browser" : "Not downloaded yet";
		b.append(top, meta);
		if (st.textContent) b.appendChild(st);
		b.addEventListener("click", () => choose(key));
		root.appendChild(b);
	}
}

function renderConsent(key) {
	const m = MODELS[key];
	state.model = key;
	const cpu = m.engine === "cpu";
	const slow = cpu && state.cpuScore < FAST_CPU;
	const advice = slow
		? `<p class="ai-warn">This device is not very quick, so this model would be slow here: expect a wait of a minute or more before the first word. <strong>Instant answers</strong> need no download and reply at once.</p>`
		: "";
	$("#ai-consent-body").innerHTML = `
		${advice}
		<p>To answer questions, this page needs to download a small language model, <strong>${m.name}</strong> (4-bit), into your browser.</p>
		<ul class="ai-facts">
			<li><strong>${m.mb} MB</strong> download, one time. Use Wi-Fi if you are on a data plan.</li>
			<li>It is <strong>saved in your browser</strong> and stays until you clear this site's data or remove it from the ⋯ menu. Next time it loads from storage, with no download.</li>
			<li>${cpu ? "It runs <strong>on your CPU</strong> (WebAssembly), no GPU needed, and uses " : "It runs <strong>locally on your GPU</strong> (WebGPU) and uses "}${m.memory}.</li>
			<li>Your questions never leave your device. The files come from Hugging Face${cpu ? "" : " and GitHub"}. Nothing else is sent anywhere.</li>
		</ul>`;
	$("#ai-accept").textContent = `Download ${m.mb} MB and start`;
	$("#ai-accept").className = "ai-btn" + (slow ? "" : " ai-btn--primary");
	$("#ai-search-only").className = slow ? "ai-btn ai-btn--primary" : "ai-link";
	$("#ai-search-only").textContent = slow ? "Use instant answers (no download)" : "Use instant answers instead";
	$("#ai-switch").textContent = "See all options";
	$("#ai-decline").textContent = state.everReady ? "Back to chat" : "Not now";
	$("#ai-credit").textContent = `Model: ${m.credit}`;
	$("#ai-consent-note").textContent = "";
}

function modelLabel() {
	if (state.mode === "search") return "Instant answers";
	const m = MODELS[state.engineKey];
	return m ? `${m.name} · ${m.where}` : "Choose a model";
}

function setView(v) {
	state.view = v;
	const show = v === "ready" ? "chat" : v;
	for (const name of ["pick", "consent", "loading", "chat", "error"]) $(`#ai-v-${name}`).hidden = name !== show;
	const ready = v === "ready";
	$("#ai-form").hidden = !ready;
	$("#ai-sub").textContent = modelLabel();
	$("#ai-model-btn").hidden = !ready;
	$("#ai-foot").textContent = state.mode === "search" ? "Answers are quoted from the site. No AI model is running." : "A very small model. It can be wrong, so check the linked pages.";
	$("#ai-foot").hidden = !ready;
	$("#ai-clear").hidden = !ready;
	$("#ai-remove").hidden = !readStore().have.length;
	if (ready) {
		if (!$("#ai-log").children.length) showEmptyState();
		setTimeout(() => $("#ai-input").focus(), 30);
	}
	if (v === "pick") setTimeout(() => $("#ai-pick-list button:not(:disabled)")?.focus(), 30);
	if (v === "consent") setTimeout(() => $("#ai-accept").focus(), 30);
	if (v === "error") setTimeout(() => $("#ai-retry").focus(), 30);
}

function setProgress(p, phase, detail) {
	const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
	$("#ai-bar-fill").style.width = pct + "%";
	$("#ai-bar").setAttribute("aria-valuenow", String(pct));
	$("#ai-phase").textContent = phase;
	$("#ai-detail").textContent = (detail ? detail + " · " : "") + pct + "%";
}

function setSending(on) {
	const b = $("#ai-send");
	b.dataset.mode = on ? "stop" : "send";
	b.setAttribute("aria-label", on ? "Stop generating" : "Send");
	b.title = on ? "Stop" : "Send";
	const mb = $("#ai-model-btn");
	mb.disabled = on;
	mb.title = on ? "Wait for the answer to finish, or press stop, to switch" : "Change how questions are answered";
}

/* ───────────────────────── panel ───────────────────────── */

const ICON_SEND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';

function build() {
	panel = document.createElement("section");
	panel.className = "ai-panel";
	panel.id = "ai-panel";
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", "Site assistant");
	panel.hidden = true;
	panel.innerHTML = `
<header class="ai-head">
	<div class="ai-title"><strong>Ask this site</strong><button type="button" class="ai-model-btn" id="ai-model-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="ai-models" hidden><span id="ai-sub">Choose a model</span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>
	<div class="ai-head-btns">
		<button type="button" class="ai-ibtn" id="ai-menu-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="ai-menu" aria-label="Options"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
		<button type="button" class="ai-ibtn" id="ai-close" aria-label="Close assistant"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
	</div>
	<div class="ai-menu" id="ai-menu" role="menu" hidden>
		<button type="button" role="menuitem" id="ai-clear">Clear conversation</button>
		<button type="button" role="menuitem" id="ai-remove">Remove downloaded models</button>
	</div>
	<div class="ai-menu ai-models" id="ai-models" role="menu" aria-label="Choose how questions are answered" hidden></div>
</header>
<div class="ai-body">
	<div class="ai-view" id="ai-v-pick" hidden>
		<h2>How should I answer?</h2>
		<p id="ai-pick-why"></p>
		<div class="ai-opts" id="ai-pick-list"></div>
		<p class="ai-note">The AI models run on your device and are downloaded only if you pick one. You can switch at any time, even in the middle of a conversation.</p>
	</div>
	<div class="ai-view" id="ai-v-consent" hidden>
		<h2>Run the assistant on your device?</h2>
		<div id="ai-consent-body"></div>
		<p class="ai-note" id="ai-consent-note"></p>
		<div class="ai-actions">
			<button type="button" class="ai-btn ai-btn--primary" id="ai-accept">Download</button>
			<button type="button" class="ai-btn" id="ai-decline">Not now</button>
		</div>
		<div class="ai-alt">
			<button type="button" class="ai-link" id="ai-switch"></button>
			<button type="button" class="ai-link" id="ai-search-only"></button>
		</div>
		<p class="ai-credit" id="ai-credit"></p>
	</div>
	<div class="ai-view" id="ai-v-loading" hidden>
		<h2 id="ai-phase">Starting…</h2>
		<div class="ai-bar" id="ai-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Model loading progress"><div id="ai-bar-fill"></div></div>
		<p class="ai-detail" id="ai-detail"></p>
		<p class="ai-note">The first time can take a few minutes. You can keep reading this page; the download carries on.</p>
		<div class="ai-actions"><button type="button" class="ai-btn" id="ai-cancel">Cancel</button></div>
	</div>
	<div class="ai-view ai-chat" id="ai-v-chat" hidden>
		<div class="ai-banner" id="ai-banner" hidden></div>
		<div class="ai-log" id="ai-log" role="log" aria-live="polite" aria-label="Conversation" tabindex="0"></div>
	</div>
	<div class="ai-view" id="ai-v-error" hidden>
		<h2>Could not start the model</h2>
		<p id="ai-error-text"></p>
		<div class="ai-actions">
			<button type="button" class="ai-btn ai-btn--primary" id="ai-retry">Try again</button>
			<button type="button" class="ai-btn" id="ai-error-cpu">Choose another model</button>
			<button type="button" class="ai-btn" id="ai-error-search">Use instant answers</button>
		</div>
		<details class="ai-details"><summary>Technical details</summary><pre id="ai-diag"></pre><button type="button" class="ai-link" id="ai-copy">Copy details</button></details>
	</div>
</div>
<form class="ai-form" id="ai-form" autocomplete="off" hidden>
	<textarea id="ai-input" rows="1" maxlength="600" placeholder="Ask about this page or the site…" aria-label="Your question"></textarea>
	<button type="submit" class="ai-send" id="ai-send" data-mode="send" aria-label="Send" title="Send"></button>
</form>
<p class="ai-foot" id="ai-foot"></p>`;
	document.body.appendChild(panel);

	const send = $("#ai-send");
	send.innerHTML = ICON_SEND;
	new MutationObserver(() => (send.innerHTML = send.dataset.mode === "stop" ? ICON_STOP : ICON_SEND)).observe(send, { attributes: true, attributeFilter: ["data-mode"] });

	$("#ai-close").addEventListener("click", close);
	$("#ai-accept").addEventListener("click", () => {
		state.consent.add(state.model);
		startModel(state.model);
	});
	$("#ai-decline").addEventListener("click", () => (state.everReady ? setView("ready") : showPick()));
	const toSearch = () => {
		if (state.everReady && state.mode !== "search") announce("Switched to instant answers.");
		useSearch(true);
	};
	$("#ai-search-only").addEventListener("click", toSearch);
	$("#ai-error-search").addEventListener("click", toSearch);
	$("#ai-switch").addEventListener("click", showPick);
	$("#ai-error-cpu").addEventListener("click", showPick);
	$("#ai-retry").addEventListener("click", () => startModel(state.model));
	$("#ai-cancel").addEventListener("click", cancelLoad);
	$("#ai-copy").addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText($("#ai-diag").textContent);
			$("#ai-copy").textContent = "Copied";
		} catch {
			$("#ai-copy").textContent = "Select the text above and copy it";
		}
	});

	const menu = $("#ai-menu");
	const menuBtn = $("#ai-menu-btn");
	const closeMenu = () => {
		menu.hidden = true;
		menuBtn.setAttribute("aria-expanded", "false");
		state.removeArmed = false;
		$("#ai-remove").textContent = "Remove downloaded models";
	};
	const models = $("#ai-models");
	const modelBtn = $("#ai-model-btn");
	closeModels = () => {
		models.hidden = true;
		modelBtn.setAttribute("aria-expanded", "false");
	};
	menuBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		closeModels();
		menu.hidden = !menu.hidden;
		menuBtn.setAttribute("aria-expanded", String(!menu.hidden));
	});
	modelBtn.addEventListener("click", async (e) => {
		e.stopPropagation();
		if (!models.hidden) return closeModels();
		closeMenu();
		await ensureDevice();
		optionRows(models, true);
		models.hidden = false;
		modelBtn.setAttribute("aria-expanded", "true");
		(models.querySelector(".is-active") || models.querySelector("button:not(:disabled)"))?.focus();
	});
	document.addEventListener("click", (e) => {
		if (!menu.hidden && !menu.contains(e.target)) closeMenu();
		if (!models.hidden && !models.contains(e.target)) closeModels();
	});
	$("#ai-clear").addEventListener("click", () => {
		closeMenu();
		clearChat();
	});
	$("#ai-remove").addEventListener("click", async () => {
		if (!state.removeArmed) {
			state.removeArmed = true;
			$("#ai-remove").textContent = "Click again to delete the model";
			return;
		}
		closeMenu();
		await removeModels();
	});

	const input = $("#ai-input");
	const grow = () => {
		input.style.height = "auto";
		input.style.height = Math.min(input.scrollHeight, 120) + "px";
		input.style.overflowY = input.scrollHeight > 120 ? "auto" : "hidden";
	};
	input.addEventListener("input", grow);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			$("#ai-form").requestSubmit();
		}
	});
	$("#ai-form").addEventListener("submit", (e) => {
		e.preventDefault();
		if (state.busy) return stopGenerating();
		const q = input.value;
		input.value = "";
		grow();
		ask(q);
	});
	$("#ai-log").addEventListener("scroll", () => {
		const l = $("#ai-log");
		stick = l.scrollHeight - l.scrollTop - l.clientHeight < 40;
	});
	document.addEventListener("keydown", (e) => {
		if (e.key !== "Escape" || panel.hidden) return;
		if (!menu.hidden) closeMenu();
		else if (!models.hidden) {
			closeModels();
			modelBtn.focus();
		} else close();
	});
}

async function firstOpen() {
	ensureSite().catch(() => {});
	const { have, pref } = readStore();

	// Chose instant answers last time: no need to look at the device before answering.
	if (pref === "search") {
		useSearch(false);
		ensureDevice().catch(() => {});
		return;
	}
	await ensureDevice();

	// A model downloaded before loads straight from browser storage. state.consent stays empty here, so if the
	// browser has dropped the files, startModel falls back to the consent view instead of downloading again.
	if (pref && have.includes(pref) && availability(pref).ok) return startModel(pref);
	showPick();
}

export function open(from) {
	opener = from || opener;
	if (!panel) build();
	panel.hidden = false;
	requestAnimationFrame(() => panel.classList.add("is-open"));
	if (!started) {
		started = true;
		firstOpen();
	} else if (state.view === "ready") $("#ai-input").focus();
	opener && opener.setAttribute("aria-expanded", "true");
}

export function close() {
	if (!panel) return;
	panel.classList.remove("is-open");
	panel.hidden = true;
	if (opener) {
		opener.setAttribute("aria-expanded", "false");
		opener.focus({ preventScroll: true });
	}
}

export function toggle(from) {
	if (panel && !panel.hidden) close();
	else open(from);
}
