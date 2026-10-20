---
title: Access Reviews and Campaigns at Scale
---

Access reviews were the part of the program with the most volume and the least product support. By the end the tenant held about 500 campaigns built from about 520 templates, and most of them were quarterly reviews of applications that had no live connector. This page covers how the review estate got that big, the decisions that shaped it, and the script that made it manageable.

## What the estate looked like

| Item | Scale |
|---|---|
| Campaigns | about 500: roughly 440 search-based, about 60 source-owner |
| Status | about 400 completed, about 100 active |
| Templates | about 520 |
| Governance groups used as reviewers | 45, each of one to four people, named "<Application> Access Reviewers" |
| Auto-approval / reauthorisation | both off |
| Flat-file sources | about 120, most of them feeding reviews |

Two things stand out. First, **most reviews ran on flat files**. For an application with no connector, the cheapest way to get its access into ISC is a CSV of user and entitlement, loaded through a delimited-file or SQL-loader source, then reviewed like any other source. Second, some of those sources were named per reviewer and per quarter. That looks like a source created for each review cycle (an inference from the names, so check your own tenant), which is why the source count reached the hundreds.

## Why flat-file reviews exist

- The application cannot be integrated yet, but audit wants evidence of a periodic review now.
- The application is integrated read-only in a later phase, and the review is the bridge.
- The access list comes from a report the application owner already produces.

The trade-off is that a flat-file review is only as good as the file. Nothing keeps it fresh, nothing reconciles it to the real application, and the correlation to identities depends on a single column. Treat it as a review input, not as a system of record.

## Campaign types you will use

| Type | Reviews | Use it for |
|---|---|---|
| Search-based (access) | Entitlements held by correlated accounts, selected by a search query | Almost everything. Scope with a query on source, tag or metadata |
| Source owner | All accounts on a source, including uncorrelated ones | Accounts that did not match an identity. The source owner is the only person who can judge them |
| Identity | Everything a person holds | Manager reviews of a team. Heavy on reviewers |

Uncorrelated accounts never appear in an access campaign. If you do not run a source-owner campaign too, they are never reviewed, and they tend to be the riskiest accounts on the source.

## Rules the platform enforces

- **Reviewers cannot review their own access.** ISC moves the item to the reviewer's manager. Expect "unexpected reviewer" noise and tell reviewers why.
- **A campaign that selects nothing is created empty.** It does not error. Either the accounts are uncorrelated or nobody holds the access.
- **Reviewer names must be unique.** A display name that matches two people fails. Use an email address.
- **Reminders, escalation and reassignment are organisation-level settings,** not per campaign. Set them before the first launch.
- **A campaign decision does not always remove access.** Revocation in a flat-file source only creates a task or a ticket. Say so in the reviewer instructions.

## The campaign factory

Creating hundreds of campaigns by hand is not credible, and the mistakes (wrong source, wrong reviewer, a stale file) are only found after launch. We built a Python tool, driven by a workbook, to create them safely. The design is worth copying whatever language you use.

```html
<!-- dgm:qar-factory -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 330" role="img" aria-labelledby="qar-factory-t qar-factory-d" xmlns="http://www.w3.org/2000/svg"><title id="qar-factory-t">The campaign factory run</title><desc id="qar-factory-d">Preflight and plan, then per source: snapshot, upload, settings, aggregate, remove stale accounts, create staged campaigns, verify; a person launches.</desc><defs><marker id="qar-factory-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="qar-factory-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="qar-factory-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box " x="6" y="14" width="180" height="54" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="96.0" y="31.5" text-anchor="middle">Preflight</text><text class="s" x="96.0" y="46.5" text-anchor="middle">workbook, API, file</text><text class="s" x="96.0" y="59.5" text-anchor="middle">server, settings</text><rect class="box " x="214" y="14" width="180" height="54" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="304.0" y="31.5" text-anchor="middle">Plan</text><text class="s" x="304.0" y="46.5" text-anchor="middle">validate every source and</text><text class="s" x="304.0" y="59.5" text-anchor="middle">campaign row</text><path class="ln   " d="M186,41.0 L214,41.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#qar-factory-ar)"/><rect class="grp accent" x="0" y="92" width="820" height="124" style="fill:none;stroke:var(--accent);stroke-opacity:0.6;stroke-dasharray:6 4"/><text class="h" x="10" y="107" text-anchor="start">For each source that passed</text><rect class="box " x="10" y="120" width="118" height="78" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="69.0" y="143.0" text-anchor="middle">Snapshot</text><text class="s" x="69.0" y="158.0" text-anchor="middle">settings,</text><text class="s" x="69.0" y="171.0" text-anchor="middle">schema,</text><text class="s" x="69.0" y="184.0" text-anchor="middle">correlation</text><rect class="box " x="144" y="120" width="118" height="78" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="203.0" y="143.0" text-anchor="middle">Upload</text><text class="s" x="203.0" y="158.0" text-anchor="middle">clean file,</text><text class="s" x="203.0" y="171.0" text-anchor="middle">never overwrite</text><text class="s" x="203.0" y="184.0" text-anchor="middle">a different one</text><path class="ln accent  " d="M128,159.0 L144,159.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#qar-factory-ar-accent)"/><rect class="box " x="278" y="120" width="118" height="78" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="337.0" y="143.0" text-anchor="middle">Settings</text><text class="s" x="337.0" y="158.0" text-anchor="middle">schema,</text><text class="s" x="337.0" y="171.0" text-anchor="middle">correlation</text><text class="s" x="337.0" y="184.0" text-anchor="middle">attribute</text><path class="ln accent  " d="M262,159.0 L278,159.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#qar-factory-ar-accent)"/><rect class="box blue" x="412" y="120" width="118" height="78" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="471.0" y="149.5" text-anchor="middle">Aggregate</text><text class="s" x="471.0" y="164.5" text-anchor="middle">wait for the</text><text class="s" x="471.0" y="177.5" text-anchor="middle">load</text><path class="ln accent  " d="M396,159.0 L412,159.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#qar-factory-ar-accent)"/><rect class="box gold" x="546" y="120" width="118" height="78" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="605.0" y="149.5" text-anchor="middle">Remove stale</text><text class="s" x="605.0" y="164.5" text-anchor="middle">guarded by a</text><text class="s" x="605.0" y="177.5" text-anchor="middle">percentage</text><path class="ln accent  " d="M530,159.0 L546,159.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#qar-factory-ar-accent)"/><rect class="box accent" x="680" y="120" width="118" height="78" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="739.0" y="148.5" text-anchor="middle">Create</text><text class="t" x="739.0" y="163.5" text-anchor="middle">campaigns</text><text class="s" x="739.0" y="178.5" text-anchor="middle">STAGED only</text><path class="ln accent  " d="M664,159.0 L680,159.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#qar-factory-ar-accent)"/><path class="ln   " d="M394,41.0 L440,41 L440,92" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><path class="ln accent  " d="M740,198 L740,236" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#qar-factory-ar-accent)"/><rect class="box teal" x="580" y="236" width="234" height="56" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="697.0" y="254.5" text-anchor="middle">Verify before launch</text><text class="s" x="697.0" y="269.5" text-anchor="middle">campaign report against the file</text><text class="s" x="697.0" y="282.5" text-anchor="middle">read back</text><rect class="box " x="300" y="236" width="244" height="56" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="422.0" y="261.0" text-anchor="middle">Discrepancy report</text><text class="s" x="422.0" y="276.0" text-anchor="middle">why, what to do, state left behind</text><path class="ln teal dash " d="M580,264.0 L544,264" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#qar-factory-ar-teal)"/><rect class="box gold" x="6" y="236" width="260" height="56" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="136.0" y="261.0" text-anchor="middle">A person launches</text><text class="s" x="136.0" y="276.0" text-anchor="middle">the script cannot activate a campaign</text><path class="ln  dash " d="M300,264 L266,264" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#qar-factory-ar)"/><text class="l" x="410" y="318" text-anchor="middle">Safe to repeat: identical files are reused, finished rows skipped, source settings can be restored.</text></svg></div><figcaption><b>Factory design.</b> Dry run, snapshot and restore, staged creation and verification are the safety properties worth copying in any language.</figcaption></figure>
```

### The workbook

| Sheet | Holds |
|---|---|
| Settings | Tenant, API client, file server, behaviour switches |
| Sources | One row per source: name, file, which column is the id, which is the correlation attribute, which columns are entitlements |
| Campaigns | One row per campaign: source, scope, reviewer or governance group, deadline, type |

Column header prefixes tell the tool what a column is, and they combine: `I_` identifier, `D_` display name, `E_` entitlement, `C_` correlation attribute. A column called `I_D_UserName` is both the id and the display name.

### What a run does

1. **Preflight.** The workbook can be saved, the API login works, the file server login works, settings are valid. If any of this fails, nothing has changed.
2. **Plan.** Every source and every campaign row is validated: reviewer found, group exists, entitlement column present. A bad source is skipped and recorded, the rest go on.
3. **Run, per source.** Snapshot the source settings, schema and correlation. Upload a clean copy of the file. Update the source settings. Aggregate. Remove stale accounts. Create the campaigns.

### Safety properties

| Property | How |
|---|---|
| Never launches | Campaigns are created **STAGED**. Any call that activates, completes or reassigns a campaign is refused inside the script |
| Dry run | `--dry-run` reads and validates everything and changes nothing |
| Partial runs | `--only A3,ADP` limits the run to named sources |
| Resume | `--retry-failed` repeats only what failed, and rows already marked complete are skipped |
| Idempotent | An identical file already on the server is reused. Settings already in place are left alone |
| No silent overwrite | A different file with the same name is never replaced: the new one is uploaded with a `_qar` suffix |
| Undo | Every source's settings, schema and correlation are snapshotted. `--restore latest` puts them back after a typed confirmation |
| Explains itself | Every failure is reported as **WHY** it happened, **DO** what to do, and the **STATE** it left behind |
| Exit code | 1 when anything was discrepant, so it can sit in a pipeline |

### Choices that mattered

- **Correlation column by match rate.** Rather than trusting the file's author, the tool tests the candidate columns (email, login name) against the identity cube and picks the one that matches most accounts.
- **Stale account removal with a guard.** Accounts in ISC but not in the new file are removed, unless that would exceed a configured percentage. This stops a truncated file from emptying a source.
- **Wait for the identity refresh.** After removing stale accounts, the tool waits before creating the campaign, otherwise the removed accounts are still in the review.
- **Reviewer fallback.** A blank reviewer means the user's manager. A governance group can be named instead.
- **Add new attributes before removing old ones.** ISC will not delete or rename an attribute that a correlation rule, identity profile or entitlement uses ("Object in use by another"). Adding first and removing last avoids the deadlock.

## Verifying before anyone launches

The most valuable addition came later: after each campaign is created, still STAGED, compare it to the file it was built from.

1. Download ISC's own **Campaign Status Report** CSV for the campaign. If it cannot be produced, read the same facts from the review items through the API.
2. Read the **flat file back from the file server**, the one the source really loads, not the local copy.
3. Compare, for the campaign's own scope only.

Three numbers per campaign are put side by side: what the file holds, what should be in the campaign, and what is in it.

| Row | Meaning |
|---|---|
| users | distinct people holding at least one in-scope entitlement |
| distinct entitlements | different entitlement values |
| user + entitlement pairs | what a reviewer has to decide on |
| per-user min / avg / max | how many each person holds |

"Should be in the campaign" is the file minus what ISC cannot include: uncorrelated accounts for an access campaign, and the inverse for a source-owner campaign.

| Result | Meaning |
|---|---|
| OK | Every expected pair is in the campaign and nothing else |
| Missing from campaign | The file has it and the account is correlated, but the campaign lacks it. The load missed it, or the search index was behind, or there is no reviewer |
| Extra in campaign | A stale account, or a value no longer in the file |
| Uncorrelated user in access campaign | An uncorrelated account leaked into a campaign meant for correlated people |
| Unexpected reviewer (a note, not a failure) | ISC moved a self-review to the manager |

The evidence is kept: a per-campaign report, a discrepancy list with likely reasons and the original status CSV from ISC.

### Limits of the check

- People are matched by display name. Two people with the same name collapse into one, which can hide an offsetting error.
- Entitlement values are matched ignoring case but counted exactly. ISC shows `Lda` and `LDA` as one value.
- **User ids that differ only in case** (`USER01` and `user01` in the same file) make ISC drop the rows of one spelling. The tool unifies them when it writes the file and reports any that were already loaded wrongly.
- ISC's CSV adds a leading apostrophe to values that start with `-`. The check removes it.
- Identity campaigns are not compared pair by pair.
- A campaign checked after launch is still compared, but decisions already made do not change the item list.

## Scoping reviews with tags and metadata

Tags on entitlements (about 4,000 were tagged) and a governance metadata attribute marking the review population let search-based campaigns select exactly the entitlements in scope. One tag per client entity, for example, produces one campaign per entity without touching the template. A tag-based scope also survives new entitlements being aggregated, where a hand-picked list does not.

## Failure modes seen

| Symptom | Cause | Fix |
|---|---|---|
| Campaign created, zero reviews | Accounts uncorrelated, or nobody holds that access | Source-owner campaign, or fix correlation |
| Reviewer not found | Display name matched two people | Use email |
| Reviewer group not found | No governance group of that exact name | Create the group first; the error lists close names |
| Entitlement not found | The value is not in the loaded file | Check spelling, or select every entitlement |
| Aggregation did not finish | The load failed | Check source health and the connection, retry |
| A same-named file already on the server | Someone else's file | Upload as `_qar`, then reconcile by hand |
| Workbook will not save | Open in Excel | Close it |

## What SailPoint's documentation adds

- **Reassignment** ([reassigning certifications](https://documentation.sailpoint.com/saas/user-help/certs/reassign_certs.html)): the reviewer gives a reason in the comments, ISC checks the person being certified will not end up reviewing their own access, and automated reassignment stops after **four hops**, leaving the item with the fifth person in the chain. Long chains of "not mine" therefore end up on someone by accident.
- **No automatic reviewer failover** after launch, according to community answers. Set up [work reassignment](https://documentation.sailpoint.com/saas/help/users/work_reassignment.html) for planned absences before the campaign starts.
- **Reminders** go to reviewers weekly until they finish unless reminder emails are disabled. Escalation behaviour for IdentityIQ is described at length in the community; confirm the ISC equivalent before promising reviewers one.
- **Delimited files** must be sorted by account ID, or a campaign can show one entitlement per account (see the connectors page). The factory's file writer should sort on the id column. Files over 500 MB are outside the documented comfort zone.
- **API pacing.** A factory that creates hundreds of campaigns shares the 100 requests per 10 seconds allowance per client ID and API version. Add backoff on 429 using the `Retry-After` header, and give the tool its own API client.
- **A custom escalation workflow** from the community handles 250 items at a time, which mirrors the parallel loop cap. If you build one, use a serial loop for larger sets.

## Actions

- Decide per application whether it is reviewed on a live connector or a flat file, and record why.
- Create governance groups before campaigns reference them, with at least two people each.
- Automate campaign creation, always create STAGED, and add a dry run and a snapshot-and-restore from day one.
- Verify every campaign against its source file before launch. Keep the evidence.
- Run a source-owner campaign for uncorrelated accounts, or accept in writing that they go unreviewed.
- Set reminders, escalation and reassignment at the organisation level before the first launch.
- Tell reviewers what a revoke decision will and will not do on a flat-file source.
