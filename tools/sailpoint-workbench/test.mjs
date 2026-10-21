// Run with: node --test tools/sailpoint-workbench/test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseXml } from "./xml.js";
import { translateRule, scanRule } from "./rules.js";
import { convert } from "./engine.js";
import { SAMPLE_FILES } from "./sample.js";
import { zip } from "./zip.js";

test("xml: CDATA, entities, self-closing, doctype", () => {
	const r = parseXml(`<?xml version="1.0"?><!DOCTYPE s PUBLIC "a" "b"><s a="1&amp;2"><x/><y><![CDATA[a < b]]></y></s>`);
	const s = r.children[0];
	assert.equal(s.attrs.a, "1&2");
	assert.equal(s.children[1].text, "a < b");
});

test("xml: mismatched tag throws", () => {
	assert.throws(() => parseXml("<a><b></a>"));
});

test("rules: concat + lower", () => {
	const r = translateRule('String f = identity.getAttribute("firstname"); return f.toLowerCase() + "." + identity.getAttribute("lastname");', {});
	assert.ok(r.ok);
	assert.equal(r.transform.type, "concat");
});

test("rules: if/else chain falls through", () => {
	const r = translateRule('String s = link.getAttribute("st"); if ("A".equals(s)) return "E"; else if ("C".equals(s)) return "K"; return "U";', { sourceName: "HR" });
	assert.ok(r.ok, r.reason);
	assert.equal(r.transform.type, "conditional");
});

test("rules: loops and context are refused", () => {
	assert.equal(translateRule("for (int i=0;i<2;i++){} return 'x';").ok, false);
	assert.ok(scanRule('context.getObjectByName(Identity.class, "x")').blockers.length > 0);
});

test("convert: sample export", () => {
	const r = convert(SAMPLE_FILES, { defaultOwner: "spadmin" });
	assert.equal(r.errors.length, 0);
	assert.ok(r.items.some((i) => i.kind === "Identity profile"));
	assert.ok(r.files.find((f) => f.path === "manifest.json"));
	const adSource = JSON.parse(r.files.find((f) => f.path === "sources/Corp_AD/source.json").content);
	assert.equal(adSource.connectorAttributes.password, "", "secrets must not be exported");
	assert.ok(!JSON.stringify(adSource).includes("ACP"));
	const kinds = r.steps.map((s) => s.kind);
	assert.ok(kinds.indexOf("source") < kinds.indexOf("identity-profile"));
	assert.ok(kinds.indexOf("identity-profile") < kinds.indexOf("role"));
});

test("convert: bad file is reported, others still convert", () => {
	const r = convert([{ name: "bad.xml", text: "<a><b></a>" }, ...SAMPLE_FILES]);
	assert.equal(r.errors.length, 1);
	assert.ok(r.stats.total > 10);
});

test("zip: signature and entry count", () => {
	const z = zip([{ path: "a.txt", content: "hi" }]);
	assert.equal(z[0], 0x50);
	assert.equal(z[1], 0x4b);
});

import { parseCsv } from "./csv.js";
import { simulate, runCases } from "./transform-sim.js";
import { analyzeGaps } from "./gap.js";
import { planEntitlements } from "./entitlements.js";
import { splitCampaigns } from "./campaigns.js";

test("csv: quotes, commas, CRLF, BOM", () => {
	const r = parseCsv('﻿a,b\r\n"x,1","he said ""hi"""\r\n');
	assert.deepEqual(r.rows[0], { a: "x,1", b: 'he said "hi"' });
});

test("sim: nested transform and trace", () => {
	const t = { type: "lower", attributes: { input: { type: "concat", attributes: { values: [{ type: "identityAttribute", attributes: { name: "a" } }, "-x"] } } } };
	const r = simulate(t, { identity: { a: "AB" } });
	assert.equal(r.output, "ab-x");
	assert.equal(r.trace.children[0].type, "concat");
});

test("sim: unsimulated types are reported, not guessed", () => {
	const r = simulate({ type: "usernameGenerator", attributes: {} });
	assert.equal(r.ok, false);
	assert.match(r.error, /not simulated/);
});

test("sim: conditional and cases", () => {
	const t = { type: "conditional", attributes: { expression: "$a eq $b", positiveCondition: "Y", negativeCondition: "N", a: "x", b: "x" } };
	const r = runCases(t, [{ name: "t", expected: "Y" }, { name: "f", expected: "N" }]);
	assert.equal(r[0].pass, true);
	assert.equal(r[1].pass, false);
});

test("gap: sample scores and flags blocked rules", () => {
	const res = convert(SAMPLE_FILES, { defaultOwner: "a" });
	const g = analyzeGaps(res, SAMPLE_FILES);
	assert.ok(g.score > 0);
	assert.ok(g.findings.some((f) => /blocked/i.test(f.title)));
});

test("entitlements: plan validates and rejects bad rows", () => {
	const csv = "source,entitlement,owner,description,requestable\nAD,CN=A,a@x.test,desc,true\nAD,CN=A,b@x.test,dup,true\nAD,CN=B,not-an-email,x,maybe\n";
	const r = planEntitlements(csv, { ownerKey: "email" });
	assert.equal(r.plan.length, 1);
	assert.equal(r.errors, 2);
	assert.equal(r.plan[0].ops[0].path, "/owner");
});

test("campaigns: split by group, respect the limit, no duplicate identity", () => {
	const csv = "uid,dept,items\n" + Array.from({ length: 10 }, (_, i) => `u${i},${i < 6 ? "A" : "B"},${i + 1}`).join("\n") + "\nu1,A,5\n";
	const r = splitCampaigns(csv, { groupBy: ["dept"], maxSize: 15, weightColumn: "items", namePrefix: "Q" });
	assert.ok(r.campaigns.every((c) => c.total <= 15));
	const all = r.campaigns.flatMap((c) => c.ids);
	assert.equal(new Set(all).size, all.length);
	assert.ok(r.problems.some((p) => /Duplicate/.test(p.message)));
	assert.equal(r.payloads[0].type, "SEARCH");
});
