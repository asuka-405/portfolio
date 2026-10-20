import { escapeHtml, slugify } from "./html.mjs";
import { renderCodeBlock } from "../render/code-block.mjs";

// A deliberately small Markdown subset for hand-written docs topics (docs-src/). It emits the
// same markup blocks-to-html.mjs produces from Notion, so local and Notion pages look identical:
//   ## Heading          -> <h3 id>            ### Sub-heading -> bold paragraph
//   paragraphs, - / 1. lists, **bold**, *em*, `code`, [text](url)
//   | pipe | tables |   -> .tbl-wrap table
//   ```lang fences      -> highlighted .code-block (lang "html" is injected verbatim)
//   > quote             -> .callout
//   :::details Title    -> collapsible .cmd-explain, closed by a line holding only :::
//   ---                 -> <hr>

function inline(src) {
	const codes = [];
	let s = src.replace(/`([^`]+)`/g, (_, c) => {
		codes.push(c);
		return `\u0000${codes.length - 1}\u0000`;
	});
	s = escapeHtml(s);
	s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => {
		const external = /^https?:\/\//i.test(url);
		return `<a href="${url}"${external ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
	});
	s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
	return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
}

function splitRow(line) {
	const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
	return body.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

function isTableStart(lines, i) {
	return /^\s*\|/.test(lines[i]) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1]);
}

function renderTable(rows) {
	const [head, , ...body] = rows;
	const th = splitRow(head).map((c) => `<th>${inline(c)}</th>`).join("");
	const trs = body.map((r) => `<tr>${splitRow(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
	return `<div class="tbl-wrap reveal"><table class="tbl"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

/** Renders a Markdown string to the body HTML of a docs page. `headings` (optional array) collects
 * { id, text } for every `##` so the caller can build an in-page contents list. */
export async function renderMarkdownBody(md, headings = []) {
	const lines = md.replace(/\r\n/g, "\n").split("\n");
	const out = [];
	let prose = [];
	let para = [];
	let list = null; // { tag, items: [] }

	const flushPara = () => {
		if (para.length) prose.push(`<p>${inline(para.join(" "))}</p>`);
		para = [];
	};
	const flushList = () => {
		if (!list) return;
		prose.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
		list = null;
	};
	const flushProse = () => {
		flushPara();
		flushList();
		if (!prose.length) return;
		out.push(`<div class="prose reveal">\n${prose.map((p) => `\t\t\t\t\t${p}`).join("\n")}\n\t\t\t\t</div>`);
		prose = [];
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		const fence = /^```(\w*)\s*$/.exec(line);
		if (fence) {
			flushProse();
			const code = [];
			for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) code.push(lines[i]);
			const lang = fence[1].toLowerCase();
			out.push(lang === "html" ? code.join("\n") : await renderCodeBlock(code.join("\n"), lang || "text"));
			continue;
		}

		const details = /^:::details\s+(.+)$/.exec(line);
		if (details) {
			flushProse();
			const inner = [];
			let depth = 1;
			for (i++; i < lines.length; i++) {
				if (/^:::details\s/.test(lines[i])) depth++;
				else if (/^:::\s*$/.test(lines[i]) && --depth === 0) break;
				inner.push(lines[i]);
			}
			const body = await renderMarkdownBody(inner.join("\n"));
			out.push(
				`\t\t\t\t<details class="cmd-explain reveal">\n\t\t\t\t\t<summary>${inline(details[1])}<span class="chev">›</span></summary>\n\t\t\t\t\t<div class="body">${body}</div>\n\t\t\t\t</details>`
			);
			continue;
		}

		if (isTableStart(lines, i)) {
			flushProse();
			const rows = [];
			for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(lines[i]);
			i--;
			out.push(renderTable(rows));
			continue;
		}

		if (/^>\s?/.test(line)) {
			flushProse();
			const paras = [[]];
			for (; i < lines.length && /^>\s?/.test(lines[i]); i++) {
				const text = lines[i].replace(/^>\s?/, "");
				if (!text.trim()) paras.push([]);
				else paras[paras.length - 1].push(text);
			}
			i--;
			const html = paras
				.filter((p) => p.length)
				.map((p) => `<p>${inline(p.join(" "))}</p>`)
				.join("\n\t\t\t\t\t");
			out.push(`\t\t\t\t<div class="callout reveal">\n\t\t\t\t\t${html}\n\t\t\t\t</div>`);
			continue;
		}

		if (!line.trim()) {
			flushPara();
			continue;
		}

		if (/^---+\s*$/.test(line)) {
			flushPara();
			flushList();
			prose.push("<hr>");
			continue;
		}

		const h2 = /^##\s+(.+)$/.exec(line);
		if (h2) {
			flushProse(); // one reveal block per section keeps each block small enough to reveal and hit-test sanely
			const text = h2[1].trim();
			const id = slugify(text);
			headings.push({ id, text });
			prose.push(`<h3 id="${id}">${inline(text)}</h3>`);
			continue;
		}
		const h3 = /^###\s+(.+)$/.exec(line);
		if (h3) {
			flushPara();
			flushList();
			prose.push(`<p><strong>${inline(h3[1].trim())}</strong></p>`);
			continue;
		}
		if (/^#\s/.test(line)) continue; // the page title lives in the front matter

		const li = /^(\s*)([-*]|\d+\.)\s+(.+)$/.exec(line);
		if (li) {
			flushPara();
			const tag = /\d/.test(li[2]) ? "ol" : "ul";
			if (list && list.tag !== tag) flushList();
			if (!list) list = { tag, items: [] };
			list.items.push(li[3]);
			continue;
		}
		if (list && /^\s{2,}\S/.test(line)) {
			list.items[list.items.length - 1] += " " + line.trim();
			continue;
		}

		flushList();
		para.push(line.trim());
	}
	flushProse();
	return out.join("\n\n");
}
