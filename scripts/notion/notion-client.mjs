import { Client } from "@notionhq/client";

let client = null;

export function getNotionClient() {
	if (client) return client;

	const token = process.env.NOTION_TOKEN;
	if (!token) {
		throw new Error(
			"NOTION_TOKEN is not set. Copy .env.example to .env locally, or set it in Netlify's " +
				"Environment variables (Site settings → Environment variables)."
		);
	}
	client = new Client({ auth: token });
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
