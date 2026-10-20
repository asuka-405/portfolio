---
title: The HR Authoritative Source and Identity Model
---

Everything ISC does to people starts with the authoritative source. On this program the HR system was the only real one, and the identity model built on it carried 60-odd attribute mappings, 40-odd transforms and a handful of cloud rules. Get this layer right and joiner, mover and leaver mostly behave. Get it wrong and every other page of this guide turns into firefighting.

## Choose the authoritative source on purpose

- **One authoritative source for the workforce.** A second profile existed only for a few administrator identities loaded from a delimited file with no cluster. Keep secondary profiles tiny and give them a lower priority number than the main one so correlation stays predictable.
- **The HR system must carry what automation needs.** If lifecycle automation needs a disable date, a time zone, a manager identifier or a reason for leaving, those fields must exist in HR and be mandatory. We added several integration-specific fields to the HR object: a disable-access date, an employment status flag for the identity system, a reason for leaving, the work location time zone, a last-modified timestamp, and fields to hold the email address and login name written back by ISC.
- **Mandatory means enforced.** The design assumed the disable date and leave date were mandatory. Hypercare then produced cases where HR forgot to update the disable date, or entered the wrong last day, and the account stayed live or was cut early. Put validation in the HR system, not in a document.

## Connecting a Salesforce-based HR system (Sage People)

The HR system was Sage People, which runs on Salesforce. The ISC Web Services connector talked to its REST query API.

| Aspect | What we did | Why it matters |
|---|---|---|
| Authentication | OAuth token endpoint called by a custom authentication step; the token is mapped into the source and sent as a bearer header | Credentials for the token call end up in the endpoint body, so check how the source stores them (see the security page) |
| Query | A SOQL query over the team member object joined to current employment, selecting around 40 fields | Select only what you map. Every extra field slows the sync and widens the blast radius of a rename |
| Paging | Termination step reads the `done` flag and follows `nextRecordsUrl` until finished | Without correct pagination steps the connector reads one page and stops |
| Schedule | Hourly, all 24 hours | Joiners and leavers react within an hour. The design promised hourly sync from day one |
| Timeout | 200 seconds | The first full load is large; size the timeout for it |
| Delta | A delta query filtered on a last-modified field existed in the legacy design | Decide deliberately whether you use delta. Delta reads usually cannot detect records that disappeared, so even with delta you need periodic full aggregations |
| Test connection | A query with a hard `LIMIT 2` | Confirms the credential and endpoint only. It does not validate your projection |

Writeback to the HR system (email address, login name) used a PATCH to the same object. It is covered below.

## The join key

The design pinned the whole lifecycle to one HR field: the unique employee identifier, stable for the whole journey of a person including leaving and rehire. Everything keys on it.

| Concept | Rule |
|---|---|
| Joiner | An identifier ISC has never seen, with status `Active` or `Pre Joiner` |
| Mover | An identifier ISC already has, with any change in a mapped attribute |
| Leaver | An existing identifier whose disable-access date is today or in the past, whatever the employment status says |
| Rehire | An existing identifier returning to `Active` or `Pre Joiner` with an empty reason for leaving |

### The rehire rule is an HR process, not an ISC feature

The platform cannot decide whether someone is a rehire or a new person. The program put a rule on HR:

- Back within 6 months, **same location and department:** reuse the old identifier. ISC reactivates the old account.
- Back within 6 months into a **different department or location**, or after 6 months in any case: HR creates a **new** record with a **new** identifier. ISC creates a new identity, a new login and a new mailbox.

The reason was data protection. In one case an ex-employee moved between countries and wanted to keep the old mailbox, which held another entity's client data. Reactivating the old account would have exposed it. The 6-month rule was written into the risk log as the mitigation and communicated to HR, and it still produced hypercare tickets from regions that had not got the message.

## Identity attribute mapping

- The profile mapped account attributes straight across (names, department, title, country code), referenced transforms for anything that needed cleaning, and called cloud rules for computed values.
- Directory identifiers were also read back in from the target accounts (login name, mail, distinguished name of the user and the manager) so later steps could build on them.
- Manager is correlated by comparing the manager's HR identifier to each identity's own identifier; for directory accounts the built-in manager correlation by account ID was used.

### Transforms: use lookups, not nested conditionals

The legacy tool normalised location and country names with enormous nested `IIF(Eq(...))` expressions: more than fifty location rewrites in a single expression, plus employee-type mappings. Replacing those with ISC lookup transforms was one of the best decisions of the build.

The transforms that were worth having:

| Purpose | Examples |
|---|---|
| Normalisation | Remove diacritical marks, trim, spaces collapse, lower and upper case |
| Standards formats | E.164 phone, ISO 3166 country, RFC 5646 language, ISO 8601 date |
| Lookups | Country name, location name, office location code, RDC maps, employee type |
| Per-country contacts | HR contact, finance contact, local IT contact, driven by country or location lookups |
| Directory builders | Active and disabled distinguished names, login name, mail nickname |
| Date logic | Is the hire date today, past or future; is now past the end date |

Caveats:

- **Lookup tables hold business data inside the tenant.** HR contacts, finance contacts and local IT contacts per country live in transform tables. They change monthly. Agree an owner, a delivery channel (we used a monthly file from HR) and a change procedure, or contacts go stale and mails go to people who left. Several hypercare tickets were exactly this.
- **Transforms reference transforms.** A directory DN transform referenced a location lookup that referenced a trim. Test the chain with real values, including blanks.
- **A "default" on every lookup.** A location missing from the table otherwise yields an empty value and, downstream, an account in the wrong container or none at all.
- **Keep a naming scheme.** We had separate "on identity profile" and "SP" variants of several DN transforms. Pick one set and retire the rest, or you will edit the wrong one.

## Cloud rules that compute identity attributes

Cloud rules run inside ISC with no network access. The program used them for values that need real logic.

| Rule | Computes | Notes |
|---|---|---|
| Lifecycle state generator | The `cloudLifecycleState` attribute from HR status, end date and time zone | Several variants (temp, latest, extended) existed in the tenant. Only one is referenced by the profile; the rest are clutter and a trap |
| Next processing date | The moment, in UTC, at which the identity's end date is reached at 22:00 local time | Used by schedule-driven leaver workflows |
| Login name generator | The sAMAccountName | Described below |
| Mail generator | The email address | Described below |
| End-date eligibility | A flag for a SaaS payroll app's half-month disable schedule | Shows how business calendars end up in rules |

Things to know about cloud rules:

- **You cannot read them back through a normal GET.** To see the code you export configuration (a single export call limited to the rule type), which creates an export job. Treat that as part of discovery.
- **Changes may go through SailPoint.** In the early build the tracker recorded a "rules upload ticket opened with SailPoint, awaiting review and upload". Ask what the current process and turnaround are for your tenant, and build that into the plan.
- **No network, no model.** A cloud rule cannot call an external service, so anything needing a lookup against another system has to run in a workflow or a connector rule.
- **Delete the variants.** Four near-identical lifecycle rules and two next-processing rules sat in the tenant. Keep one, name it plainly, and archive the others outside the tenant.

### How the lifecycle rule thinks

The core of the generator is worth copying as a pattern:

```java
// Treat the end date as 00:00:01 on the day, move it to the person's own time zone, and
// pin it to 22:00 local. Compare with "now" in UTC at hour precision.
endDateLocal = endDate.withZoneSameInstant(ZoneId.of(tz)).withHour(22).truncatedTo(ChronoUnit.HOURS);
endUtc       = endDateLocal.withZoneSameInstant(ZoneId.of("UTC"));
nowUtc       = ZonedDateTime.now(ZoneId.of("UTC")).truncatedTo(ChronoUnit.HOURS);

if (!nowUtc.isBefore(endUtc) && !status.startsWith("Inactive")) return "inactive";
if (status.equalsIgnoreCase("Active"))      return "active";
if (status.equalsIgnoreCase("Pre Joiner"))  return "preJoiner";
if (status.startsWith("Inactive"))          return "active";   // paid or unpaid leave stays active
return "intermediate";
```

Design points that carry over:

- **A far-future default end date** (year 9000) avoids null handling.
- **An invalid or missing time zone falls back to a sensible default** rather than throwing.
- **Hour-level truncation** makes the comparison deterministic for a rule that is recomputed on every refresh.
- **Leave statuses are not leavers.** Paid and unpaid leave kept the identity active.
- **Log the inputs.** The rule logs every input to every condition. That is verbose but it is the only way to explain a state change later.

## Login names, emails and distinguished names

Joiner automation generated three identifiers. The rules are small and every one of them produced hypercare tickets.

| Identifier | Rule | Caveat |
|---|---|---|
| Login name | First 3 letters of first name + last 3 letters of last name + a two-digit counter, 8 characters maximum | The counter increments until `idn.accountExistsByDisplayName` says it is free. We capped the loop at 2,000 attempts. Short names are padded with random letters |
| Email | `first.last`, then `first.last1`, `first.last2`... on collision | Checked against the directory, not only ISC. Name changes generate a new address; the old one becomes a secondary alias |
| Distinguished name | CN + region / department / work location path | **The CN is the login name**, so the directory's "Name" shows `ABC123` rather than a human name |

That last point caused several tickets: after the cutover date, new users appeared in the directory console under their login name. The explanation that worked for service desks: the directory's Name attribute defaults to the CN, display name is a different attribute and is still the human name, Outlook and Teams use display name, and for audit reports you should export display name, CN, login name and Name together. Publish that note before go-live.

### Display names

- **Double spaces.** A name attribute built from a directory CN gave "First  Last" for people without a middle name. Normalise with a collapse-spaces transform and search with that in mind.
- **Maiden names.** If HR's full name includes a maiden name and you split it, you get "First Last Last". Build the display name from first name and last name only, and keep a separate attribute for the app that needs a different format.
- **Requested name changes.** HR corrects a surname and expects a new email: that is a mover with a name change, handled by the directory before-provisioning logic (new address, UPN, SMTP and SIP proxy addresses, old SMTP kept as an alias). It needs to push the new address back to HR.

## Writeback to HR

Email and login name must be written back to the HR system so downstream systems and HR users see them. The pattern that worked:

1. **Event-driven workflow** fires on a change of the email or login name attribute (ignoring the literal value `none`), waits briefly, then PATCHes the HR record.
2. **Scheduled workflow** runs twice a day and sweeps for identities whose values are not yet in HR, so a failed event is repaired automatically.
3. Both send a notification on failure.

Caveats from the program:

- The HR OAuth call used a **password grant**, and the workflow HTTP step held the **client secret in the body in plaintext**. ISC lets you reference a stored secret in a workflow, but the secrets can only be created in the UI. Do that, not the plaintext version. See the workflows and security pages.
- HR users kept asking "please push the work email into the HR system" for pre-joiners. The scheduled sweep exists because the event path is not perfect; tell HR the sweep interval so they know when to expect it.
- Name corrections after the email was written back arrived as support requests ("push the new work email"). Decide who owns that path and whether it can be automated.

## Correlation

Account-to-identity correlation was attribute-based on almost every source. Conventions that emerged:

| Source type | Typical sequence |
|---|---|
| Directory | login name, then email |
| Application with login = email | email only |
| SQL applications | login name, then email, then employee number |
| Mixed | email, then login name, then employee number |

Rules that follow from this:

- **Correlation is case sensitive unless you say otherwise.** An email that differs only in case does not correlate, and the account lands in the uncorrelated pile rather than showing a mismatch. Set `ignoreCase` deliberately.
- **A single-attribute correlation with no fallback is fragile.** An identity with no email cannot correlate at all.
- **Never correlate on a synthesised display name.** One source built `userName` from first and last name in an after-rule; it was a display field, not a login.
- **Align correlation and provisioning.** The attributes you correlate on should be the same ones the create policy writes, otherwise a freshly created account fails to correlate.
- **Plan for uncorrelated accounts.** Access reviews need a source-owner campaign for them (see the campaigns page).

## Data reconciliation before cutover

A pre-go-live reconciliation of directory accounts against HR found well over a thousand active directory accounts with no employee ID, plus a long tail of other mismatches (accounts for people HR no longer had, staff on unpaid leave, service-like accounts in human OUs). Do this analysis early:

1. Export directory accounts and HR records. Compare on employee ID, then email, then name.
2. Classify: matches, directory-only, HR-only, duplicates, non-human accounts in human OUs.
3. Agree a remediation owner and a deadline for each class. Backfilling the employee ID attribute in the directory is a legitimate one-off to enable correlation.
4. Define the **standard human-account OU** scope so the directory aggregation excludes service and shared accounts.

## What SailPoint's documentation adds

From the [identity profile documentation](https://documentation.sailpoint.com/saas/help/setup/identity_profiles.html), the [account loading documentation](https://documentation.sailpoint.com/saas/help/accounts/loading_data.html) and community threads on correlation and authoritative-source migration, checked October 2026.

### Identity profiles

- **One identity belongs to one profile,** the highest-priority profile where it has an account on that profile's authoritative source. Priority follows creation order (10, 20, and so on) and can be changed through the update-identity-profile API. Plan the order before you create overlapping profiles.
- **Required mappings:** user name, work email and last name must be mapped in every profile and cannot be null. User name must be unique across identities; a duplicate raises an identity exception.
- **Do not use the characters `* ( ) & ! .`** in the source attribute mapped to the user name or alternative sign-in attribute.
- **A multi-value attribute in a transform uses only its first value.** Test with a person who has two.
- **You cannot create or delete an identity profile while an account aggregation is running.**
- **Deleting a profile deletes its identities** unless they can be reassigned, and their accounts become uncorrelated. Remove source-owner and app-owner links from those identities first, or the deletion fails.
- **After changing mappings the profile shows "Needs Processing".** Apply the changes, and use Preview on the mappings page with real data first.
- **Rules need review by SailPoint before implementation; transforms do not.** This is why a rule change can take calendar time.

### Optimized aggregation and correlation


```html
<!-- dgm:optimized-agg -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 290" role="img" aria-labelledby="optimized-agg-t optimized-agg-d" xmlns="http://www.w3.org/2000/svg"><title id="optimized-agg-t">Optimized and unoptimized aggregation</title><desc id="optimized-agg-d">An optimized run skips unchanged accounts and does not re-run correlation. An unoptimized run reprocesses everything.</desc><defs><marker id="optimized-agg-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="optimized-agg-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="optimized-agg-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="grp accent" x="6" y="8" width="520" height="274" style="fill:none;stroke:var(--accent);stroke-opacity:0.6;stroke-dasharray:6 4"/><text class="h" x="16" y="23" text-anchor="start">Optimized (default, UI and schedules)</text><rect class="box " x="24" y="110" width="120" height="52" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="84.0" y="125.5" text-anchor="middle">Read every</text><text class="t" x="84.0" y="140.5" text-anchor="middle">record</text><text class="s" x="84.0" y="155.5" text-anchor="middle">from the source</text><polygon class="box gold" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1" points="236,94.0 311.0,136 236,178.0 161.0,136"/><text class="s" style="fill:var(--ink);font-weight:700" x="236" y="133.5" text-anchor="middle">Changed since</text><text class="s" style="fill:var(--ink);font-weight:700" x="236" y="145.5" text-anchor="middle">last run?</text><path class="ln   " d="M144,136.0 L161,136" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#optimized-agg-ar)"/><rect class="box ghost" x="364" y="48" width="148" height="52" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="438.0" y="64.5" text-anchor="middle">Skip the account</text><text class="s" x="438.0" y="79.5" text-anchor="middle">no correlation, no</text><text class="s" x="438.0" y="92.5" text-anchor="middle">manager correlation</text><rect class="box accent" x="364" y="168" width="148" height="64" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="438.0" y="184.0" text-anchor="middle">Update attributes</text><text class="s" x="438.0" y="199.0" text-anchor="middle">evaluate correlation</text><text class="s" x="438.0" y="212.0" text-anchor="middle">and manager</text><text class="s" x="438.0" y="225.0" text-anchor="middle">correlation</text><path class="ln   " d="M236,94 L236,74 L364,74" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#optimized-agg-ar)"/><text class="l" x="300" y="68" text-anchor="middle">no</text><path class="ln accent  " d="M236,178 L236,200 L364,200" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#optimized-agg-ar-accent)"/><text class="l" x="300" y="194" text-anchor="middle">yes</text><rect class="grp gold" x="546" y="8" width="268" height="274" style="fill:none;stroke:var(--gold);stroke-opacity:0.65;stroke-dasharray:6 4"/><text class="h" x="556" y="23" text-anchor="start">Unoptimized (API only)</text><rect class="box gold" x="562" y="40" width="236" height="62" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="680.0" y="60.5" text-anchor="middle">load-accounts with</text><text class="t" x="680.0" y="75.5" text-anchor="middle">disableOptimization=true</text><text class="s" x="680.0" y="90.5" text-anchor="middle">that one run only</text><rect class="box " x="562" y="120" width="236" height="52" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="680.0" y="143.0" text-anchor="middle">Every record is processed</text><text class="s" x="680.0" y="158.0" text-anchor="middle">correlation re-run for all</text><rect class="box teal" x="562" y="190" width="236" height="70" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="680.0" y="214.5" text-anchor="middle">Manually correlated accounts</text><text class="t" x="680.0" y="229.5" text-anchor="middle">are kept</text><text class="s" x="680.0" y="244.5" text-anchor="middle">check them before you start</text><path class="ln gold  " d="M680,102 L680,120" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#optimized-agg-ar-gold)"/><path class="ln gold  " d="M680,172 L680,190" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#optimized-agg-ar-gold)"/></svg></div><figcaption><b>Why a fixed correlation rule can do nothing.</b> Accounts that did not change are skipped, so they are never re-matched. Use the unoptimized run after correcting correlation logic or the data it matches.</figcaption></figure>
```

This is the most useful addition to the correlation section above. By default an aggregation is **optimized**: it reads every record, but an existing account with no detected change is skipped and **neither account correlation nor manager correlation is evaluated for it**. Consequences:

- Fixing a correlation rule, or fixing the data it matches on, does not re-correlate accounts that did not change. Accounts stay uncorrelated until you run an unoptimized aggregation.
- Scheduled and manual runs from the UI are always optimized. An unoptimized run is available only through the API, by passing `disableOptimization=true` to the account-load call, and it applies to that run only.
- Manually correlated accounts are kept on an unoptimized run, so check for them before you start.

Community practice for changing correlation: confirm the new attribute is populated, unique and immutable on every existing account, add it as the **first** criterion with the old one as a temporary fallback (criteria are evaluated in order), run the unoptimized aggregation, then review what is still uncorrelated. Community threads also report a default fallback that compares the account name with the identity name when no configured criterion matches, which can correlate an account you did not expect. Treat that as observed by others, not documented.

```html
<!-- dgm:profile-priority -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 270" role="img" aria-labelledby="profile-priority-t profile-priority-d" xmlns="http://www.w3.org/2000/svg"><title id="profile-priority-t">One identity belongs to one identity profile</title><desc id="profile-priority-d">An identity joins the highest priority profile whose authoritative source holds one of its accounts.</desc><defs><marker id="profile-priority-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="profile-priority-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="profile-priority-ar-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk blue" style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="profile-priority-ar-violet" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk violet" style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box " x="6" y="20" width="200" height="60" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="106.0" y="47.0" text-anchor="middle">Person A</text><text class="s" x="106.0" y="62.0" text-anchor="middle">account on the HR source only</text><rect class="box " x="6" y="170" width="200" height="70" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="106.0" y="195.5" text-anchor="middle">Person B</text><text class="s" x="106.0" y="210.5" text-anchor="middle">accounts on the HR source and</text><text class="s" x="106.0" y="223.5" text-anchor="middle">on the admin source</text><rect class="box blue" x="330" y="20" width="210" height="70" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="435.0" y="45.5" text-anchor="middle">HR profile, priority 20</text><text class="s" x="435.0" y="60.5" text-anchor="middle">authoritative source: HR</text><text class="s" x="435.0" y="73.5" text-anchor="middle">system</text><rect class="box violet" x="330" y="150" width="210" height="70" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="435.0" y="175.5" text-anchor="middle">Admin profile, priority 10</text><text class="s" x="435.0" y="190.5" text-anchor="middle">authoritative source: small</text><text class="s" x="435.0" y="203.5" text-anchor="middle">admin file</text><path class="ln accent  " d="M206,50 L330,55" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#profile-priority-ar-accent)"/><path class="ln accent  " d="M206,195 L330,190" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#profile-priority-ar-accent)"/><text class="l" x="268" y="176" text-anchor="middle">highest priority wins</text><path class="ln  dash " d="M206,185 L260,120 L330,75" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#profile-priority-ar)"/><rect class="box blue" x="630" y="20" width="180" height="70" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="720.0" y="38.0" text-anchor="middle">Identity in the HR</text><text class="t" x="720.0" y="53.0" text-anchor="middle">profile</text><text class="s" x="720.0" y="68.0" text-anchor="middle">mappings and lifecycle of</text><text class="s" x="720.0" y="81.0" text-anchor="middle">the HR profile</text><rect class="box violet" x="630" y="150" width="180" height="70" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="720.0" y="168.0" text-anchor="middle">Identity in the admin</text><text class="t" x="720.0" y="183.0" text-anchor="middle">profile</text><text class="s" x="720.0" y="198.0" text-anchor="middle">mappings of the admin</text><text class="s" x="720.0" y="211.0" text-anchor="middle">profile</text><path class="ln blue  " d="M540,55 L630,55" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#profile-priority-ar-blue)"/><path class="ln violet  " d="M540,185 L630,185" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#profile-priority-ar-violet)"/><text class="l" x="410" y="258" text-anchor="middle">Priority follows creation order by default (10, 20, ...). Lower number wins. Change it with the update profile API.</text></svg></div><figcaption><b>Priority matters for second sources.</b> Plan the order before you create overlapping profiles; you cannot create or delete a profile while an account aggregation is running.</figcaption></figure>
```

### Choosing the join key

Both the documentation and the community's authoritative-source migration guide say the same thing we concluded: use an attribute that is unique, consistently captured in every system and immutable, and **avoid personally identifiable values such as government identifiers.**

### Replacing or changing the HR system

SailPoint's [migration guide](https://community.sailpoint.com/t5/Identity-Security-Cloud-Wiki/Migrating-Between-Authoritative-Sources/ta-p/194410) gives a sequence worth adopting if the HR platform will change during or after your program:

```html
<!-- dgm:hr-migration -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 420" role="img" aria-labelledby="hr-migration-t hr-migration-d" xmlns="http://www.w3.org/2000/svg"><title id="hr-migration-t">Replacing the HR system without a big bang</title><desc id="hr-migration-d">Nine steps: move the HR system first, onboard it separately, mirror the identity profile, migrate access-driving attributes last.</desc><defs></defs><rect class="box gold" x="34" y="6" width="770" height="38" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="44" y="22.0" text-anchor="start">Go live with the new HR system first</text><text class="s" x="44" y="37.0" text-anchor="start">not the same day as the ISC switch. Watch the data for days, pause orchestrations</text><circle class="badge" cx="16" cy="25" r="9"/><text class="badge-t" x="16" y="28.6" text-anchor="middle">1</text><rect class="box " x="34" y="51" width="770" height="38" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="44" y="67.0" text-anchor="start">Onboard the new HR source</text><text class="s" x="44" y="82.0" text-anchor="start">let several aggregations run, configure manager correlation</text><circle class="badge" cx="16" cy="70" r="9"/><text class="badge-t" x="16" y="73.6" text-anchor="middle">2</text><rect class="box " x="34" y="96" width="770" height="38" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="44" y="112.0" text-anchor="start">Correlate to existing identities</text><text class="s" x="44" y="127.0" text-anchor="start">on the agreed unique attribute. Review the uncorrelated report</text><circle class="badge" cx="16" cy="115" r="9"/><text class="badge-t" x="16" y="118.6" text-anchor="middle">3</text><rect class="box " x="34" y="141" width="770" height="38" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="44" y="157.0" text-anchor="start">Create a mirrored identity profile</text><text class="s" x="44" y="172.0" text-anchor="start">same mappings and transforms. Confirm identity counts</text><circle class="badge" cx="16" cy="160" r="9"/><text class="badge-t" x="16" y="163.6" text-anchor="middle">4</text><rect class="box accent" x="34" y="186" width="770" height="38" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="44" y="202.0" text-anchor="start">Raise its priority</text><text class="s" x="44" y="217.0" text-anchor="start">check identities moved: counts, search, spot checks</text><circle class="badge" cx="16" cy="205" r="9"/><text class="badge-t" x="16" y="208.6" text-anchor="middle">5</text><rect class="box " x="34" y="231" width="770" height="38" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="44" y="247.0" text-anchor="start">Update role criteria</text><text class="s" x="44" y="262.0" text-anchor="start">add OR clauses so people qualify on old or new HR data</text><circle class="badge" cx="16" cy="250" r="9"/><text class="badge-t" x="16" y="253.6" text-anchor="middle">6</text><rect class="box accent" x="34" y="276" width="770" height="38" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="44" y="292.0" text-anchor="start">Migrate attributes gradually</text><text class="s" x="44" y="307.0" text-anchor="start">firstValid transforms. Lifecycle state and other access-driving attributes last</text><circle class="badge" cx="16" cy="295" r="9"/><text class="badge-t" x="16" y="298.6" text-anchor="middle">7</text><rect class="box " x="34" y="321" width="770" height="38" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="44" y="337.0" text-anchor="start">Re-point owners and groups</text><text class="s" x="44" y="352.0" text-anchor="start">governance groups, source owners, application owners</text><circle class="badge" cx="16" cy="340" r="9"/><text class="badge-t" x="16" y="343.6" text-anchor="middle">8</text><rect class="box teal" x="34" y="366" width="770" height="38" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="44" y="382.0" text-anchor="start">Clean up</text><text class="s" x="44" y="397.0" text-anchor="start">delete the old profile, optionally the old source</text><circle class="badge" cx="16" cy="385" r="9"/><text class="badge-t" x="16" y="388.6" text-anchor="middle">9</text></svg></div><figcaption><b>Sequence from SailPoint's authoritative-source migration guide.</b> Choose a low-impact window and keep a rollback plan with time to execute it.</figcaption></figure>
```

1. Go live with the new HR system first and do not switch ISC to it the same day. Pause orchestrations and watch its data for a few days to a week.
2. Onboard the new HR source, let several aggregations run and configure manager correlation.
3. Correlate its accounts to existing identities on the agreed unique attribute and review the uncorrelated report.
4. Create a new identity profile mirroring the old mappings and transforms, confirm identity counts, then raise its priority.
5. Update role criteria with OR clauses so people qualify on either the old or new HR data.
6. Migrate attributes gradually with `firstValid` transforms, **moving lifecycle state and other access-driving attributes last.**
7. Re-point owners and governance groups, then delete the old profile.

## Actions

- Specify the HR fields automation needs and enforce them in HR.
- Document the join key and the rehire rule and get HR's written agreement.
- Replace conditional-heavy mappings with lookup transforms that have defaults, and name an owner for every table.
- Keep one version of each cloud rule; export and archive the rest.
- Publish the CN-equals-login-name explanation to service desks before go-live.
- Reconcile directory accounts to HR at least a month before cutover.
