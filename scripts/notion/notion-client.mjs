import { Client } from "@notionhq/client";

let client = null;

// Notion allows roughly three requests a second on average. Space calls out a little, and when the API
// still answers 429 (rate_limited) wait as long as it asks, or back off exponentially, then try again.
const MIN_GAP_MS = 350;
const MAX_RETRIES = 8;
let lastCall = 0;
let queue = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function paced() {
	const turn = queue.then(async () => {
		const wait = lastCall + MIN_GAP_MS - Date.now();
		if (wait > 0) await sleep(wait);
		lastCall = Date.now();
	});
	queue = turn.catch(() => {});
	return turn;
}

async function fetchWithRetry(url, init) {
	for (let attempt = 0; ; attempt++) {
		await paced();
		let res;
		try {
			res = await fetch(url, init);
		} catch (err) {
			if (attempt >= MAX_RETRIES) throw err;
			await sleep(1000 * 2 ** attempt);
			continue;
		}
		if ((res.status === 429 || res.status >= 502) && attempt < MAX_RETRIES) {
			const asked = Number(res.headers.get("retry-after"));
			const wait = Number.isFinite(asked) && asked > 0 ? asked * 1000 : Math.min(30000, 1000 * 2 ** attempt);
			console.warn(`[notion] ${res.status}, retrying in ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
			await sleep(wait);
			continue;
		}
		return res;
	}
}

export function getNotionClient() {
	if (client) return client;

	const token = process.env.NOTION_TOKEN;
	if (!token) {
		throw new Error(
			"NOTION_TOKEN is not set. Copy .env.example to .env locally, or set it in Netlify's " +
				"Environment variables (Site settings → Environment variables)."
		);
	}
	client = new Client({ auth: token, fetch: fetchWithRetry });
	return client;
}

export function getDatabaseId() {
	const id = process.env.NOTION_DATABASE_ID;
	if (!id) {
		throw new Error("NOTION_DATABASE_ID is not set (see .env.example).");
	}
	return id;
}

export function getDocsDatabaseId() {
	const id = process.env.NOTION_DOCS_DATABASE_ID;
	if (!id) {
		throw new Error("NOTION_DOCS_DATABASE_ID is not set (see .env.example).");
	}
	return id;
}
