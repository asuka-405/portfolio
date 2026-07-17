import { richTextToHtml, richTextToPlain } from "../lib/html.mjs";
import { downloadArticleImage } from "./download-images.mjs";
import { renderCodeBlock } from "../render/code-block.mjs";

async function fetchChildren(client, blockId) {
	const results = [];
	let cursor = undefined;
	do {
		const res = await client.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 });
		results.push(...res.results);
		cursor = res.has_more ? res.next_cursor : undefined;
	} while (cursor);
	return results;
}

function toEmbedUrl(rawUrl) {
	try {
		const url = new URL(rawUrl);
		const host = url.hostname.replace(/^www\./, "");

		if (host === "youtube.com" || host === "m.youtube.com") {
			const id = url.searchParams.get("v");
			return id ? `https://www.youtube.com/embed/${id}` : rawUrl;
		}
		if (host === "youtu.be") {
			return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
		}
		if (host === "loom.com") {
			return rawUrl.replace("/share/", "/embed/");
		}
		if (host === "vimeo.com") {
			const id = url.pathname.split("/").filter(Boolean).pop();
			return id ? `https://player.vimeo.com/video/${id}` : rawUrl;
		}
		return rawUrl;
	} catch {
		return rawUrl;
	}
}

async function renderTable(client, block) {
	const rows = await fetchChildren(client, block.id);
	const hasHeader = block.table?.has_column_header;
	const rowsHtml = rows
		.filter((r) => r.type === "table_row")
		.map((r, i) => {
			const cellTag = hasHeader && i === 0 ? "th" : "td";
			const cells = r.table_row.cells
				.map((cell) => `<${cellTag}>${richTextToHtml(cell)}</${cellTag}>`)
				.join("");
			return `<tr>${cells}</tr>`;
		});
	const [headRow, ...bodyRows] = rowsHtml;
	const thead = hasHeader && headRow ? `<thead>${headRow}</thead>` : "";
	const tbodyRows = hasHeader ? bodyRows : rowsHtml;
	return `<div class="tbl-wrap reveal"><table class="tbl">${thead}<tbody>${tbodyRows.join("")}</tbody></table></div>`;
}

/**
 * Walks a section's flat block list, grouping consecutive prose-shaped blocks (paragraphs,
 * h3 subheadings, lists, quotes, dividers) into `.prose` divs, and emitting non-prose blocks
 * (images, tables, code, embeds, callouts, toggles) as their own top-level elements —
 * matching how the hand-written articles interleave `.prose` with `.cmd`/`.callout`/etc.
 */
async function renderSectionBody(client, blocks, slug, imageCounter, warnings) {
	const output = [];
	let proseBuffer = [];
	let listBuffer = null; // { type: 'ul'|'ol', items: [] }

	const flushList = () => {
		if (!listBuffer) return;
		const tag = listBuffer.type;
		proseBuffer.push(`<${tag}>${listBuffer.items.map((i) => `<li>${i}</li>`).join("")}</${tag}>`);
		listBuffer = null;
	};
	const flushProse = () => {
		flushList();
		if (proseBuffer.length === 0) return;
		output.push(`<div class="prose reveal">\n${proseBuffer.map((p) => `\t\t\t\t\t${p}`).join("\n")}\n\t\t\t\t</div>`);
		proseBuffer = [];
	};

	for (const block of blocks) {
		const type = block.type;

		if (type === "bulleted_list_item" || type === "numbered_list_item") {
			const tag = type === "bulleted_list_item" ? "ul" : "ol";
			if (listBuffer && listBuffer.type !== tag) flushList();
			if (!listBuffer) listBuffer = { type: tag, items: [] };
			listBuffer.items.push(richTextToHtml(block[type].rich_text));
			continue;
		}
		if (listBuffer) flushList();

		switch (type) {
			case "paragraph": {
				const html = richTextToHtml(block.paragraph.rich_text);
				if (html.trim()) proseBuffer.push(`<p>${html}</p>`);
				break;
			}
			case "heading_2": {
				proseBuffer.push(`<h3>${richTextToHtml(block.heading_2.rich_text)}</h3>`);
				break;
			}
			case "heading_3": {
				proseBuffer.push(`<p><strong>${richTextToHtml(block.heading_3.rich_text)}</strong></p>`);
				break;
			}
			case "quote": {
				proseBuffer.push(`<blockquote>${richTextToHtml(block.quote.rich_text)}</blockquote>`);
				break;
			}
			case "divider": {
				proseBuffer.push("<hr>");
				break;
			}
			case "callout": {
				flushProse();
				const html = richTextToHtml(block.callout.rich_text);
				output.push(`\t\t\t\t<div class="callout reveal">\n\t\t\t\t\t<p>${html}</p>\n\t\t\t\t</div>`);
				break;
			}
			case "toggle": {
				flushProse();
				const summary = richTextToHtml(block.toggle.rich_text);
				const children = await fetchChildren(client, block.id);
				const nested = await renderSectionBody(client, children, slug, imageCounter, warnings);
				output.push(
					`\t\t\t\t<details class="cmd-explain reveal">\n\t\t\t\t\t<summary>${summary}<span class="chev">›</span></summary>\n\t\t\t\t\t<div class="body">${nested}</div>\n\t\t\t\t</details>`
				);
				break;
			}
			case "code": {
				flushProse();
				const code = richTextToPlain(block.code.rich_text);
				if (block.code.language === "html") {
					// Escape hatch: a code block set to the "HTML" language is injected verbatim,
					// unescaped — lets an article embed custom markup (e.g. hand-built diagrams
					// using the site's own .dgm/.arch/.ladder components) that Notion has no
					// native block for, while staying real HTML/CSS instead of a static image.
					output.push(code);
				} else {
					const html = await renderCodeBlock(code, block.code.language);
					output.push(html);
				}
				break;
			}
			case "table": {
				flushProse();
				output.push(await renderTable(client, block));
				break;
			}
			case "image": {
				flushProse();
				const src = block.image.type === "external" ? block.image.external.url : block.image.file.url;
				imageCounter.n += 1;
				const localSrc = await downloadArticleImage(src, slug, imageCounter.n);
				const caption = richTextToPlain(block.image.caption) || `Figure in ${slug}`;
				const captionHtml = richTextToHtml(block.image.caption);
				output.push(
					`\t\t\t\t<figure class="reveal">\n\t\t\t\t\t<img src="${localSrc}" alt="${caption.replace(/"/g, "&quot;")}" loading="lazy" />\n${
						captionHtml ? `\t\t\t\t\t<figcaption class="fig-cap">${captionHtml}</figcaption>\n` : ""
					}\t\t\t\t</figure>`
				);
				break;
			}
			case "video":
			case "embed": {
				flushProse();
				const raw = block[type].type === "external" ? block[type].external.url : block[type].url;
				if (!raw) {
					warnings.push(`Skipped ${type} block ${block.id}: no embeddable URL (uploaded file videos aren't supported).`);
					break;
				}
				const embedUrl = toEmbedUrl(raw);
				output.push(
					`\t\t\t\t<div class="embed-wrap reveal">\n\t\t\t\t\t<iframe src="${embedUrl}" title="Embedded content" loading="lazy" allowfullscreen></iframe>\n\t\t\t\t</div>`
				);
				break;
			}
			case "bookmark": {
				const url = block.bookmark.url;
				proseBuffer.push(`<p><a href="${url}" target="_blank" rel="noopener">${url}</a></p>`);
				break;
			}
			default: {
				warnings.push(`Skipped unsupported block type "${type}" (${block.id}).`);
			}
		}
	}

	flushProse();
	return output.join("\n\n");
}

/**
 * Fetches a Notion page's block tree and splits it into sections at each heading_1,
 * mirroring the site's existing .doc-section (kicker + h2) / no-kicker single-section
 * patterns depending on whether the article uses heading_1s at all.
 */
export async function convertPageToSections(client, pageId, slug) {
	const topBlocks = await fetchChildren(client, pageId);
	const imageCounter = { n: 0 };
	const warnings = [];

	const rawSections = [];
	let current = { headingBlock: null, blocks: [] };
	for (const block of topBlocks) {
		if (block.type === "heading_1") {
			if (current.blocks.length > 0 || current.headingBlock) rawSections.push(current);
			current = { headingBlock: block, blocks: [] };
		} else {
			current.blocks.push(block);
		}
	}
	if (current.blocks.length > 0 || current.headingBlock) rawSections.push(current);

	let partNumber = 0;
	const sections = [];
	for (const raw of rawSections) {
		const bodyHtml = await renderSectionBody(client, raw.blocks, slug, imageCounter, warnings);
		if (!bodyHtml.trim() && !raw.headingBlock) continue;
		let kicker = null;
		let heading = null;
		if (raw.headingBlock) {
			partNumber += 1;
			kicker = `Part ${partNumber}`;
			heading = richTextToHtml(raw.headingBlock.heading_1.rich_text);
		}
		sections.push({ kicker, heading, bodyHtml });
	}

	return { sections, warnings };
}
