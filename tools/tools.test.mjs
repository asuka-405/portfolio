// Run with: node --test tools/tools.test.mjs   (SailPoint workbench tests: node --test tools/sailpoint-workbench/test.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import { explain, parseCron, CronError } from "./cron-explainer/cron.js";
import * as rx from "./regex-tester/regex.js";
import * as ld from "./ldap-toolkit/ldap.js";
import * as df from "./diff-tool/diff.js";
import * as jq from "./jsonq-playground/jsonq.js";
import * as sc from "./scim-builder/scim.js";
import * as pm from "./permissions-toolkit/perms.js";
import * as fl from "./fstab-linter/fstab.js";
import * as rl from "./sailpoint-rules/rules.js";
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

test("diff: git-style hunks match the semantic result", () => {
	// Reordered keys and array elements are not a change, so only the real edits show as lines.
	const a = JSON.stringify({ z: 1, items: [{ id: 1, v: "a" }, { id: 2, v: "b" }] });
	const b = JSON.stringify({ items: [{ id: 2, v: "B" }, { id: 1, v: "a" }], z: 1 });
	const g = df.gitDiff(a, b);
	assert.equal(g.ok, true);
	assert.deepEqual(g.stats, { added: 1, removed: 1 });
	const lines = g.hunks.flatMap((h) => h.lines);
	assert.ok(lines.some((l) => l.t === "-" && l.text.includes('"b"')));
	assert.ok(lines.some((l) => l.t === "+" && l.text.includes('"B"')));
	assert.equal(df.gitDiff(a, a).hunks.length, 0);
	assert.equal(df.gitDiff("{bad", "{}").ok, false);

	// Hunk arithmetic: header counts equal the lines inside, and the patch text starts like git's.
	const x = Array.from({ length: 20 }, (_, i) => `l${i}`);
	const y = x.slice();
	y[3] = "changed";
	y.splice(15, 0, "inserted");
	const r = df.lineHunks(x, y, { context: 2 });
	assert.equal(r.hunks.length, 2);
	for (const h of r.hunks) {
		assert.equal(h.oldLines, h.lines.filter((l) => l.t !== "+").length);
		assert.equal(h.newLines, h.lines.filter((l) => l.t !== "-").length);
	}
	assert.equal(df.hunkHeader(r.hunks[0]), "@@ -2,5 +2,5 @@");
	assert.ok(df.unifiedPatch(r.hunks, "a", "b").startsWith("diff --git a/a b/b\n--- a/a\n+++ b/b\n@@"));
	assert.equal(df.lineHunks(x, y, { context: Infinity }).hunks.length, 1);

	// ignore options still apply to the line view
	const iiq = df.gitDiff(df.SAMPLE.xml[0], df.SAMPLE.xml[1], { iiq: true });
	assert.ok(!iiq.hunks.some((h) => h.lines.some((l) => /modified=/.test(l.text))));
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

test("jsonq: JSONPath selectors, filters and errors", () => {
	const d = jq.SAMPLE.data;
	const titles = (q) => jq.queryJsonPath(d, q).matches.map((m) => m.value);
	assert.deepEqual(titles("$.store.books[?@.price < 10].title"), ["Sayings of the Century", "Moby Dick"]);
	assert.deepEqual(titles("$.store.books[?@.isbn].title"), ["Moby Dick", "The Lord of the Rings"]);
	assert.equal(titles("$..price").length, 4);
	assert.equal(titles("$.store.books[-1].id")[0], 4);
	assert.deepEqual(titles("$.store.books[0:2].id"), [1, 2]);
	assert.deepEqual(jq.queryJsonPath({ a: [1, 2, 3] }, "$.a[::-1]").matches.map((m) => m.value), [3, 2, 1]);
	assert.deepEqual(titles("$.store.books[?match(@.title, 'S.*') && @.category == 'fiction'].id"), [2]);
	assert.equal(jq.queryJsonPath(d, "$.store.books[0].title").matches[0].path, "$['store']['books'][0]['title']");
	assert.equal(jq.queryJsonPath(d, "$.a[").ok, false);
});

test("jsonq: jq subset", () => {
	const run = (p, data = jq.SAMPLE.data) => jq.runJq(p, data);
	assert.deepEqual(run("[.store.books[].price] | add").results, [53.92]);
	assert.deepEqual(run(".store.books | map(select(.price < 10)) | map(.id)").results, [[1, 3]]);
	assert.deepEqual(run(".store.books | group_by(.category) | map({c: .[0].category, n: length})").results[0].map((x) => x.n), [3, 1]);
	assert.deepEqual(run('.store.books[0] | "\\(.title) by \\(.author)"').results, ["Sayings of the Century by Nigel Rees"]);
	assert.deepEqual(run("if .a then 1 elif .b then 2 else 3 end", { b: true }).results, [2]);
	assert.deepEqual(run('.a // "x"', {}).results, ["x"]);
	assert.deepEqual(run("del(.a, .b[0])", { a: 1, b: [1, 2], c: 3 }).results, [{ b: [2], c: 3 }]);
	assert.equal(run(".a[").ok, false);
	assert.equal(run(".a | length", { a: 5 }).results[0], 5);
	assert.equal(run("nope", {}).ok, false);
});

test("scim: builders, filters and validation", () => {
	const u = sc.buildUser({ userName: "a@x.com", emailWork: "a@x.com", department: "IT", managerId: "m1" });
	assert.ok(u.schemas.includes(sc.SCHEMA.enterprise));
	assert.equal(u.emails[0].primary, true);
	assert.equal(u[sc.SCHEMA.enterprise].manager.value, "m1");
	assert.equal(sc.buildUser({ userName: "x", active: "false" }).active, false);

	const res = sc.SAMPLE_RESOURCE;
	const t = (f) => sc.evalFilter(sc.parseFilter(f), res);
	assert.equal(t('userName eq "BJENSEN@example.com"'), true); // case-insensitive
	assert.equal(t('emails[type eq "work" and value ew "@example.com"]'), true);
	assert.equal(t('not (emails.type eq "home")'), false);
	assert.equal(t("title pr"), false);
	assert.equal(t('urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department sw "Tour"'), true);
	assert.throws(() => sc.parseFilter('userName equals "x"'), /not a filter operator/);
	assert.throws(() => sc.parseFilter('userName eq "x'), /Unterminated/);
	assert.equal(sc.filterQuery('a eq "b"'), "filter=a%20eq%20%22b%22");

	assert.deepEqual(sc.validatePatch(sc.buildPatch(sc.SAMPLE_PATCH)), []);
	const bad = sc.validatePatch({ schemas: [], Operations: [{ op: "remove" }, { op: "add" }, { op: "bogus", path: "x" }] });
	assert.ok(bad.filter((b) => b.level === "error").length >= 4);
	assert.ok(sc.validateResource({ schemas: [sc.SCHEMA.user], userName: "x", active: "true" }).some((i) => /boolean/.test(i.message)));
	assert.ok(sc.validateResource({ schemas: [sc.SCHEMA.user], userName: "x", emails: [{ value: "a@b.co", primary: true }, { value: "c@d.co", primary: true }] }).some((i) => /primary/.test(i.message)));
	assert.equal(sc.validateResource(sc.SAMPLE_RESOURCE).filter((i) => i.level === "error").length, 0);
	assert.match(sc.buildCurl({ method: "PATCH", baseUrl: "https://h/scim/v2/", resource: "Users", id: "42", body: { a: 1 } }), /-X PATCH 'https:\/\/h\/scim\/v2\/Users\/42'/);
});

test("perms: modes, chmod expressions, umask", () => {
	assert.equal(pm.toSymbolic(0o4755), "rwsr-xr-x");
	assert.equal(pm.toSymbolic(0o1777), "rwxrwxrwt");
	assert.equal(pm.parseSymbolicString("-rwsr-xr-x"), 0o4755);
	assert.equal(pm.toOctal(0o644), "644");
	assert.equal(pm.applyChmod("u+x,g-w,o=", 0o664).mode, 0o740);
	assert.equal(pm.applyChmod("u=rwx,g=u,o=", 0).mode, 0o770);
	assert.equal(pm.applyChmod("a+rX,go-w", 0o640, { isDir: true }).mode, 0o755);
	assert.equal(pm.applyChmod("+x", 0o644, { umask: 0o077 }).mode, 0o744);
	assert.equal(pm.applyChmod("g+s", 0o755, { isDir: true }).mode, 0o2755);
	assert.equal(pm.applyChmod("u+q", 0o644).ok, false);
	assert.equal(pm.umaskResult(0o027).file.octal, "640");
	assert.equal(pm.umaskResult(0o027).dir.octal, "750");
	assert.ok(pm.describeMode(0o777).warnings.some((w) => /World-writable/.test(w)));
	assert.ok(pm.describeMode(0o1777, { isDir: true }).warnings.some((w) => /sticky/.test(w)));
});

test("perms: sudoers parse and lint", () => {
	const p = pm.parseSudoers(pm.SAMPLE_SUDOERS);
	assert.equal(p.errors.length, 0);
	const rules = p.entries.filter((e) => e.kind === "rule");
	assert.equal(rules.length, 6);
	const deploy = rules.find((r) => r.users[0] === "deploy");
	assert.deepEqual(deploy.specs[0].hosts, ["web1", "web2"]);
	assert.equal(deploy.specs[0].runas, "www-data");
	assert.ok(deploy.specs[0].cmds.every((c) => c.tags.includes("NOPASSWD")));
	const lint = pm.lintSudoers(p);
	assert.ok(lint.some((l) => l.level === "error" && /without a password/.test(l.message)));
	assert.ok(lint.some((l) => /not an absolute path/.test(l.message)));
	assert.ok(lint.some((l) => /bash is a shell/.test(l.message)));
	assert.ok(lint.some((l) => /wildcard/.test(l.message)));
	const bad = pm.parseSudoers("this is nonsense\nalice host = /bin/ls\n%admin ALL=(ALL) !/usr/bin/su, ALL");
	assert.ok(bad.errors.length >= 1);
	assert.ok(pm.lintSudoers(bad).some((l) => /Negated/.test(l.message)));
	assert.match(pm.explainEntry(deploy), /www-data/);
});

test("fstab: parse and lint", () => {
	const p = fl.parseFstab(fl.SAMPLE_FSTAB);
	assert.equal(p.entries.length, 8);
	const lint = fl.lintFstab(p);
	const has = (re, level) => lint.some((l) => re.test(l.message) && (!level || l.level === level));
	assert.ok(has(/kernel name/, "warn"));
	assert.ok(has(/"ro" and "rw"/, "error"));
	assert.ok(has(/password=/, "error"));
	assert.ok(has(/tmpfs without size/, "warn"));
	assert.ok(has(/_netdev/, "warn"));
	assert.ok(has(/umask/, "warn"));
	assert.ok(has(/pass should be 0/, "warn"));
	const clean = fl.lintFstab(fl.parseFstab("UUID=5f2b9c1e-3a47-4d88-9d0a-2f6c1b7e9a10 / ext4 defaults,noatime,errors=remount-ro 0 1\nUUID=ABCD-1234 /boot/efi vfat umask=0077 0 0\nUUID=0d3e1c11-7a9f-4a7c-b1d4-5e9a0e2f6b33 none swap sw 0 0\n"));
	assert.equal(clean.filter((l) => l.level !== "info").length, 0);
	const dup = fl.lintFstab(fl.parseFstab("UUID=5f2b9c1e-3a47-4d88-9d0a-2f6c1b7e9a10 /data ext4 defaults 0 2\nUUID=0d3e1c11-7a9f-4a7c-b1d4-5e9a0e2f6b33 /data ext4 defaults 0 2\n"));
	assert.ok(dup.some((l) => /already mounted/.test(l.message)));
	assert.ok(fl.lintFstab(fl.parseFstab("/dev/sda1 relative ext4 defaults,subvol=@ 0 2")).some((l) => /absolute/.test(l.message)));
	assert.match(fl.formatFstab("a / ext4 defaults 0 1\nbbbbbb /home ext4 defaults 0 2"), /^a {5}/);
});

test("rules: templates render and the checker flags blocked code", () => {
	for (const t of rl.TEMPLATES) {
		const r = rl.renderTemplate(t, rl.defaultValues(t));
		assert.equal(r.ok, true, t.id);
		if (t.reference) { assert.equal(r.files.length, 0); continue; }
		assert.ok(r.files.length >= 1, t.id);
		if (t.group === "Cloud rules") {
			const x = r.files[0].text;
			assert.match(x, new RegExp(`<Rule language="beanshell" name="[^"]+" type="${t.type}">`), t.id);
			assert.ok(!x.includes("{{"), `${t.id} has an unfilled placeholder`);
			assert.deepEqual(rl.checkRule(x).filter((c) => c.level === "error"), [], `${t.id} trips the blocked-code check`);
		}
		if (t.group === "Transforms") JSON.parse(r.files[0].text);
		if (t.group === "Connector rules") {
			assert.ok(!r.files[0].text.includes("{{"), t.id);
			JSON.parse(r.files[1].text);
		}
	}
	const combine = rl.TEMPLATES.find((t) => t.id === "bm-combine");
	const x = rl.renderTemplate(combine, { ...rl.defaultValues(combine), first: 'a"b' }).files[0].text;
	assert.ok(x.includes('a\\"b'), "string values are escaped for Java");
	assert.equal(rl.renderTemplate(combine, { ...rl.defaultValues(combine), joiner: "x" }).ok, true);
	const jp = rl.TEMPLATES.find((t) => t.id === "jp-skeleton");
	assert.equal(rl.renderTemplate(jp, { ...rl.defaultValues(jp), table: "users; DROP TABLE x" }).ok, false);
	assert.equal(rl.renderTemplate(jp, { ...rl.defaultValues(jp), columns: "a,b c" }).ok, false);
	const msgs = rl.checkRule(rl.SAMPLE_CHECK).map((c) => c.message).join("|");
	assert.match(msgs, /getObjectByName/);
	assert.match(msgs, /System.out/);
	assert.match(msgs, /sleep/);
	assert.match(msgs, /hard-coded secret/);
});
