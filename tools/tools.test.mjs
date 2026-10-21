// Run with: node --test tools/tools.test.mjs   (SailPoint workbench tests: node --test tools/sailpoint-workbench/test.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import { explain, parseCron, CronError } from "./cron-explainer/cron.js";
import * as rx from "./regex-tester/regex.js";
import * as ld from "./ldap-toolkit/ldap.js";
import * as df from "./diff-tool/diff.js";
import * as ar from "./arch-installer/archgen.js";

const FROM = Date.UTC(2026, 9, 21, 12, 0, 0);

test("cron: unix and quartz basics", () => {
	const a = explain("30 9 * * 1-5", { from: FROM });
	assert.equal(a.flavor, "unix");
	assert.match(a.description, /09:30.*Monday/);
	const b = explain("0 0 17 ? * 6L", { from: FROM });
	assert.equal(b.flavor, "quartz");
	assert.match(b.description, /last Friday/);
	assert.equal(new Date(b.runs[0]).toISOString(), "2026-10-30T17:00:00.000Z");
});

test("cron: Quartz needs ? in one day field, 5-field Quartz hints at seconds", () => {
	assert.equal(explain("0 0 12 * * *").ok, false);
	assert.match(explain("0 0 1,15 * ?").error, /seconds/);
	assert.equal(explain("61 * * * *").ok, false);
});

test("cron: conversion and DST gap", () => {
	assert.equal(explain("0 22 * * 1-5").converted.expr, "0 0 22 ? * 2-6");
	assert.equal(explain("0 0 2 * * ?").converted.expr, "0 2 * * *");
	const dst = explain("0 30 1 * * ?", { from: Date.UTC(2026, 2, 26), tz: "Europe/London", count: 5 });
	assert.ok(dst.warnings.some((w) => /does not exist/.test(w)));
	assert.throws(() => parseCron("", "unix"), CronError);
});

test("regex: flavor verdicts", () => {
	assert.equal(rx.analyze("(?<=a)b").compat.go.status, "incompatible");
	assert.equal(rx.analyze("(?<=a)b").compat.java.status, "compatible");
	assert.equal(rx.analyze("(?<first_name>x)").compat.java.status, "incompatible");
	assert.equal(rx.analyze("\\Afoo\\z").compat.js.status, "differs");
	assert.equal(rx.analyze("a{").compat.java.status, "incompatible");
	assert.equal(rx.analyze("^(a+)+$").compat.js.status, "risky");
	assert.equal(rx.analyze("^(a+)+$").compat.go.status, "compatible");
});

test("regex: js runner, translation, replacement notes", () => {
	const r = rx.runJs({ pattern: "(?<n>\\d+)", input: "a1 b22", flags: "" });
	assert.deepEqual(r.matches.map((m) => m.named.n), ["1", "22"]);
	assert.equal(rx.runJs({ pattern: "(", input: "" }).ok, false);
	const t = rx.translateToJs("(?i)\\Aab\\z");
	assert.equal(t.flags, "i");
	assert.ok(new RegExp(t.pattern, t.flags).test("AB"));
	assert.ok(rx.analyzeReplacement("$1x").go.some((m) => /1x/.test(m)));
});

test("ldap: dn escape, parse, compare", () => {
	assert.equal(ld.escapeDnValue("Smith, John"), "Smith\\, John");
	const a = ld.analyzeDn("CN=Smith\\, John,OU=Fin,DC=example,DC=test");
	assert.equal(a.dnsDomain, "example.test");
	assert.equal(a.canonical, "example.test/Fin/Smith, John");
	assert.ok(ld.sameDn("cn=A,dc=x", "CN=a, DC=x"));
});

test("ldap: filter parse, format, errors, recipes", () => {
	const f = "(&(objectCategory=person)(|(sAMAccountName=svc-*)(cn=*smith))(!(mail=*)))";
	assert.equal(ld.formatFilter(ld.parseFilter(f)), f);
	assert.throws(() => ld.parseFilter("(a=b"), ld.LdapError);
	assert.throws(() => ld.parseFilter("(a=(b))"), /Unescaped/);
	assert.equal(ld.escapeFilterValue("a*(b)"), "a\\2A\\28b\\29");
	assert.match(ld.buildRecipe("disabled").filter, /803:=2/);
	assert.match(ld.explainFilter(ld.parseFilter("(cn=*x)")).advice[0], /leading \*/);
});

test("ldap: uac and time conversions", () => {
	assert.deepEqual(ld.decodeUac(66050).flags.map((x) => x.name), ["ACCOUNTDISABLE", "NORMAL_ACCOUNT", "DONT_EXPIRE_PASSWORD"]);
	const t = ld.parseDirectoryTime("133800000000000000");
	assert.equal(t.date.toISOString(), "2024-12-30T02:40:00.000Z");
	assert.equal(ld.timeFormats(t.date).filetime, "133800000000000000");
});

test("diff: json by key, ignore keys, patch", () => {
	const a = JSON.stringify({ items: [{ id: 1, v: "a" }, { id: 2, v: "b" }], t: 1 });
	const b = JSON.stringify({ items: [{ id: 2, v: "B" }, { id: 1, v: "a" }, { id: 3 }], t: 2 });
	const r = df.diff(a, b, { arrayMode: "key", ignoreKeys: ["t"] });
	assert.equal(r.stats.total, 2);
	assert.ok(r.changes.some((c) => c.path === "/items[id=2]/v"));
	const p = df.diff("[1,2]", "[1,3,4]", { arrayMode: "index" });
	assert.deepEqual(df.toJsonPatch(p.changes).map((x) => x.op), ["replace", "add"]);
});

test("diff: xml ignores order and volatile attributes", () => {
	const r = df.diff(df.SAMPLE.xml[0], df.SAMPLE.xml[1], { iiq: true });
	assert.equal(r.format, "xml");
	assert.ok(!r.changes.some((c) => /@id|@modified/.test(c.path)));
	assert.ok(r.changes.some((c) => /entry\[key=file\]\/@value/.test(c.path)));
	assert.equal(df.diff("{bad", "{}").ok, false);
});

test("arch: script is valid, validated and safe", () => {
	const r = ar.generateInstall({ luks: true });
	assert.ok(r.ok);
	assert.match(r.files[0].content, /cryptsetup luksFormat/);
	assert.match(r.files[0].content, /Type the disk path again/);
	assert.equal(ar.generateInstall({ disk: "/dev/sda; rm -rf /" }).ok, false);
	assert.equal(ar.generateInstall({ bootloader: "systemd-boot", boot: "bios" }).ok, false);
	assert.equal(ar.generateInstall({ hostname: "x y" }).ok, false);
});

test("arch: fstab validation and layout", () => {
	const p = ar.validateFstab([{ spec: "UUID=1111-2222", mount: "/", type: "ext4", options: "defaults", pass: 0 }, { spec: "UUID=1111-2223", mount: "/", type: "ext4", options: "defaults", pass: 2 }, { spec: "bad spec", mount: "/x", type: "ext4", options: "defaults" }]);
	assert.ok(p.some((x) => /already used/.test(x.message)));
	assert.ok(p.some((x) => /not a recognised device spec/.test(x.message)));
	const out = ar.buildFstab([{ spec: "UUID=1", mount: "/", type: "ext4", options: "defaults", dump: 0, pass: 1 }]);
	assert.match(out, /UUID=1\s+\/\s+ext4\s+defaults\s+0\s+1/);
});

test("regex: empty matches are reported once", () => {
	const r = rx.runJs({ pattern: "a*", input: "baa" });
	assert.deepEqual(r.matches.map((m) => `${m.index}:${m.text}`), ["0:", "1:aa", "3:"]);
});
