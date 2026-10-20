---
title: Choosing and Building Application Connectors
---

Connecting an application is a pipeline of decisions, not a single configuration. This page covers how to choose a pattern, what to establish with the application team before you build, and what each integration style looked like in practice. The next page goes deep on the Web Services and JDBC connectors.

## Choose the pattern

Apply these in order and stop at the first that fits.

1. **Does the application authenticate through Active Directory?** Govern the AD groups with the AD connector. You get provisioning, aggregation and certification of the access for free, and joiner and leaver already work because the directory does.
2. **Is there a purpose-built connector?** Use it (for example Dynamics 365, an ITSM product, a SaaS HR system). Check what it cannot do before you commit.
3. **Is there a documented REST API for user and role management?** Use Web Services. Expect to write rules.
4. **Is there a database you may read, and a stored procedure or table you may write?** Use JDBC. Expect to write a build-map rule and a provisioning rule.
5. **None of the above?** Load a flat file over SFTP. It supports aggregation, correlation and certification. Provisioning stays manual or ticket-based.
6. **Nothing at all?** Out of scope until the application changes.

```html
<!-- dgm:connector-choice -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 360" role="img" aria-labelledby="connector-choice-t connector-choice-d" xmlns="http://www.w3.org/2000/svg"><title id="connector-choice-t">Choosing an integration pattern</title><desc id="connector-choice-d">Apply the questions in order and stop at the first that fits.</desc><defs><marker id="connector-choice-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="connector-choice-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="connector-choice-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="connector-choice-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><polygon class="box gold" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1" points="150,10.0 295.0,38 150,66.0 5.0,38"/><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="35.5" text-anchor="middle">Authenticates through Active</text><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="47.5" text-anchor="middle">Directory?</text><rect class="box teal" x="430" y="14" width="200" height="48" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="530.0" y="35.0" text-anchor="middle">AD connector</text><text class="s" x="530.0" y="50.0" text-anchor="middle">govern the directory groups</text><path class="ln teal  " d="M295,38 L430,38" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#connector-choice-ar-teal)"/><text class="l" x="360" y="32" text-anchor="middle">yes</text><path class="ln   " d="M150,66 L150,86" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#connector-choice-ar)"/><polygon class="box gold" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1" points="150,76.0 295.0,104 150,132.0 5.0,104"/><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="101.5" text-anchor="middle">A purpose-built connector</text><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="113.5" text-anchor="middle">exists?</text><rect class="box teal" x="430" y="80" width="200" height="48" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="530.0" y="101.0" text-anchor="middle">Direct connector</text><text class="s" x="530.0" y="116.0" text-anchor="middle">check what it cannot do</text><path class="ln teal  " d="M295,104 L430,104" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#connector-choice-ar-teal)"/><text class="l" x="360" y="98" text-anchor="middle">yes</text><path class="ln   " d="M150,132 L150,152" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#connector-choice-ar)"/><polygon class="box gold" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1" points="150,142.0 295.0,170 150,198.0 5.0,170"/><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="167.5" text-anchor="middle">A documented REST API for</text><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="179.5" text-anchor="middle">users and roles?</text><rect class="box blue" x="430" y="146" width="200" height="48" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="530.0" y="167.0" text-anchor="middle">Web Services</text><text class="s" x="530.0" y="182.0" text-anchor="middle">expect to write rules</text><path class="ln accent  " d="M295,170 L430,170" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#connector-choice-ar-accent)"/><text class="l" x="360" y="164" text-anchor="middle">yes</text><path class="ln   " d="M150,198 L150,218" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#connector-choice-ar)"/><polygon class="box gold" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1" points="150,208.0 295.0,236 150,264.0 5.0,236"/><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="233.5" text-anchor="middle">A database you may read and</text><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="245.5" text-anchor="middle">write?</text><rect class="box blue" x="430" y="212" width="200" height="48" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="530.0" y="226.5" text-anchor="middle">JDBC</text><text class="s" x="530.0" y="241.5" text-anchor="middle">build map and provisioning</text><text class="s" x="530.0" y="254.5" text-anchor="middle">rules</text><path class="ln accent  " d="M295,236 L430,236" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#connector-choice-ar-accent)"/><text class="l" x="360" y="230" text-anchor="middle">yes</text><path class="ln   " d="M150,264 L150,284" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#connector-choice-ar)"/><polygon class="box gold" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1" points="150,274.0 295.0,302 150,330.0 5.0,302"/><text class="s" style="fill:var(--ink);font-weight:700" x="150" y="305.5" text-anchor="middle">None of the above?</text><rect class="box gold" x="430" y="278" width="200" height="48" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="530.0" y="292.5" text-anchor="middle">Flat file over SFTP</text><text class="s" x="530.0" y="307.5" text-anchor="middle">aggregation, correlation and</text><text class="s" x="530.0" y="320.5" text-anchor="middle">reviews</text><path class="ln gold  " d="M295,302 L430,302" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#connector-choice-ar-gold)"/><text class="l" x="360" y="296" text-anchor="middle">yes</text><rect class="box ghost" x="660" y="10" width="154" height="90" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="737.0" y="32.5" text-anchor="middle">Why this order</text><text class="s" x="737.0" y="47.5" text-anchor="middle">least custom code</text><text class="s" x="737.0" y="60.5" text-anchor="middle">first. Each step down</text><text class="s" x="737.0" y="73.5" text-anchor="middle">adds rules to build</text><text class="s" x="737.0" y="86.5" text-anchor="middle">and own</text><rect class="box ghost" x="660" y="130" width="154" height="100" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="737.0" y="151.0" text-anchor="middle">Disconnected</text><text class="s" x="737.0" y="166.0" text-anchor="middle">a ticket-based</text><text class="s" x="737.0" y="179.0" text-anchor="middle">application is the</text><text class="s" x="737.0" y="192.0" text-anchor="middle">last resort. Keep the</text><text class="s" x="737.0" y="205.0" text-anchor="middle">ticket as the audit</text><text class="s" x="737.0" y="218.0" text-anchor="middle">trail</text><rect class="box ghost" x="660" y="260" width="154" height="90" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="737.0" y="295.5" text-anchor="middle">Nothing at all</text><text class="s" x="737.0" y="310.5" text-anchor="middle">out of scope until the</text><text class="s" x="737.0" y="323.5" text-anchor="middle">application changes</text></svg></div><figcaption><b>Selection principle.</b> Directory first, then a purpose-built connector, then web services or JDBC, then a flat file. A flat file is not a failure; it gave review coverage to most of the estate.</figcaption></figure>
```

Two corollaries:

- **A flat file is not a failure.** It gave review coverage to a large part of the application estate with near-zero build effort and no change to the application.
- **A ticket-based "disconnected" application is the last resort.** If you must keep one, keep the ITSM ticket as the audit trail and plan to replace it.

## What to establish before you build

Use a standard questionnaire per application (a template is on the checklists page). The answers that changed the build most:

| Question | Why it matters |
|---|---|
| Hosting: SaaS, vendor-hosted or on-premises | Decides VA placement and who can change the API |
| Is there an API for user and group management? A backend database you can reach? | Decides the connector family |
| Lower environments and access to them | Without one you test in production. Ask in the first email |
| Who is in scope (employees only, clients too, bots)? | Keep scope to HR-sourced employees unless there is a reason |
| How is a user created today and who does it? | That is the process you automate or replace |
| Mandatory attributes for a new user | They become the create policy |
| How are accesses defined (roles, groups, client, location)? | Becomes the entitlement model |
| How are leavers handled? Immediately? How is the app told? | Becomes the disable path |
| How often and how are reviews done? | Becomes the campaign design |
| Does the application authenticate through AD or SSO? | If yes, disabling the AD account may already block access, which changes the risk of leaving the app account alone |
| Who are the business and technical owners? | Reviewers, approvers and source owners |

Treat unanswered questions as risks. The tracker for the phase 2 questionnaire round showed that many "responses" were partial or redirected to a technical contact; the response count is not the same as readiness.

## Decide what ISC does to the target

For every application, write a one-paragraph **capability statement**. Do it per operation, in plain words, and publish it alongside the technical documentation.

| Operation | Typical answers seen |
|---|---|
| Read accounts and entitlements | Always |
| Create account | Yes on JDBC and some REST; **no** on a Dynamics 365 connector at the time |
| Update account attributes | Often **no**. Several integrations had no update policy at all |
| Enable and disable | Usually yes |
| Delete | Usually refused. Accounts are disabled, not deleted |
| Add and remove entitlements | Varies. One REST application could revoke but never grant |
| Password | Out of scope everywhere |

Why this matters: the `features` list on a source is a menu of **claims**, not a measurement. Several sources advertised password, authentication or delete features for which no endpoint or rule existed, and one refused deletes in code while the source declared them. Stakeholders read the feature list. Write the real answer down.

### Common scoping decisions that kept recurring

- **Entitlement management is read-only.** ISC does not create the application's roles or groups; it reads them. This was the default in almost every requirement document.
- **No birthright access for applications.** Application access is request-based, with one or two approval levels.
- **Account attributes sync only when asked.** Enable attribute sync per attribute, per application.
- **Client users are out of scope.** Only HR-sourced employees.
- **One user type in scope.** Where an application distinguishes types (operational, self-service, robot), only one was in scope.

## Integration styles, with what each taught us

Product names are used for commercial products; internal systems are described by pattern.

### Active-Directory-governed product (fund accounting)

Access is membership of a handful of AD groups per instance. The product also requires a user to exist in the application before they can be granted access, and the reverse. ISC governs group membership; joiner, mover and leaver for the product itself stay out of scope because there is no API. Lesson: when an application is governed through AD, the integration is mostly access-model design.

### Dynamics 365 Finance and Operations (native connector)

Users are synced from the cloud directory. The connector supported read, enable and disable, but not create, move, delete or group membership. The requirement document recorded that gap and that "client access is not in scope". Entitlements outnumbered users many times over (tens of thousands of organisation roles for a few thousand users), so aggregation volume and campaign size need planning. Two D365-family sources were failing at the end of the program; watch native connector health.

### Workflow / BPM product with a REST API (Enate)

Three entitlement types: a user group (optional, specific to region and service line), and two mandatory roles. Access depends on the account existing in the product and matching the directory email. Source scripts handled disable-status after aggregation, a contact-type check on create, and add and remove for the role and group entitlements. UX decision: a launcher form for joiners **plus** the request center for existing users produced two interfaces for one product. The recommendation, accepted, was to use the request center for both.

### Consolidation product (OneStream) over a generic API

The product has no resource model; everything goes through two generic API calls that invoke named data adapters and data management steps. The first lesson: **part of the integration lives inside the application** (see the next page). The second: a user chooses security groups according to function scope, so the access model needed a mapping between function and group.

### Internal client-management portal (REST, POST only)

Two disjoint user populations behind one list endpoint, paging by page size with no overflow signal, tokens that expire with an HTTP 200 body, and revocation done entirely in rules that parse identifiers out of the entitlement name. Read access was solid; granting was absent in production.

### Internal operations app on SQL Server (JDBC)

Three entitlement types (role, local office, local client entity) that must be inserted together, selected by a custom form, carried to the JDBC rule in the **access request comments**, and written inside a database transaction. A second similar app used one database **per client** behind a mirror database. Both are covered in the next two pages.

### Global entity-management app with a SQL back end

Account creation through plain SQL inserts into a handful of user and group tables; default administrator group and file access value supplied by the rule; enable and disable through an `InActive` flag column; entitlements restricted to a default for the first phase. Passwords are not passed. Because the table design was simple, SQL-only provisioning was enough.

### HR / payroll SaaS products with simple APIs

Group aggregation did not exist (the product had no groups), so a "dummy" entitlement was created by an after-rule so access requests had something to attach to. Authentication for one of them was a hard-coded basic authorization header in two operations; fix it with a credential placeholder. A scheduled workflow, split into two half-month runs, disabled terminated users because the product needed it on a calendar basis.

### Service desk / ITSM product

The deployment used mail to create tickets (a fixed subject convention) rather than the ISC service desk connector. The product itself synchronised from AD every 24 hours and took disabled users offline. The vendor connector supports ticket creation for manual provisioning and status check, authenticated by AR-JWT or OAuth2, and needs outbound 443 from the VA. If you want status synchronisation and closure tracking, use it. If you only need an audit trail, mail with a subject convention is simpler but ties you to the ITSM parser.

## Entitlement shapes you will meet

| Shape | Example | Handling |
|---|---|---|
| Flat group | A security group name | Standard |
| Composite value | `role >> client >> service line ((grantId::roleId))` | The suffix is a key rules parse. Never change the format casually |
| Composite with status | `group \| client \| status` | The status changes with the person, so the same group exists as active and inactive values. Counts inflate |
| Scoped grant | Role + office, or role + client entity | Three attributes in one grant; carry them together via the request comment or a form |
| Multi-valued per user | A user in several groups | Needs a multi-valued account attribute and row merging if the SQL returns one row per pair |
| Catalogue not aggregated | Roles never granted do not appear | If there is no group aggregation endpoint, ISC only knows combinations currently held by someone |

## Account status convention

Every one of the six custom integrations used the same trick: a rule sets `IIQDisabled: true` on the account map when the source says the account is inactive. No source mapped a native flag straight to the disabled state. Three consequences:

- The decision is a **string or boolean comparison in code**. If the target changes its wording (`InActive` to `Inactive`), the comparison silently stops matching.
- Rules that only ever set `true` rely on **absence meaning enabled**. Set both directions explicitly.
- A token failure inside an after-rule that calls a second endpoint for the disabled list leaves **everyone enabled**. Log it and alert on it.

## Writing the integration down

Per integration, keep a pack of five documents and one evidence folder. This is what made knowledge transfer routine:

| File | Content |
|---|---|
| Overview | A 60-second version, read order and open items |
| Integration reference | Source configuration, endpoints or SQL, schemas, every rule, access model, request flow |
| Tenant context | The tenant conventions the integration relies on, so the pack stands alone |
| Edge cases and dead ends | Silent failures, hard ceilings and approaches proven not to work |
| Runbook | Schedules, health checks, troubleshooting by symptom, change checklist |
| Config evidence | Redacted copies of the live configuration |

## What SailPoint's documentation adds

Checked against the [account loading documentation](https://documentation.sailpoint.com/saas/help/accounts/loading_data.html) and community threads on thresholds, October 2026.

### The account delete threshold, precisely

- The setting is **the maximum percentage of accounts that can be deleted in one aggregation.** Over the limit, the documentation says the aggregation is cancelled and a warning generated. A related multi-host page says deletions are skipped instead, so confirm which you get on your source type by testing, and monitor for the warning either way.
- It must be an **integer from 1 to 100.** The UI dropdown reportedly lists values only up to 20 percent, but a docs-team reply on the community says you can type a larger number.
- **Small sources round.** The value is rounded to the nearest whole account. If it rounds to less than one account, the aggregation is cancelled only when 100 percent of accounts would be deleted. At 5 percent on a 10-account source it rounds to one account, so any deletion cancels the run.
- It applies to scheduled and flat-file aggregations too.
- There is no built-in alert on a bulk status change such as many terminations. Community answers point to a workflow or a search-based monitor for that, which matches the monitors on the hypercare page.
- A community case matches our concern exactly: a web-services source began returning an error with zero results and then deleted accounts. A low threshold (a few percent) was the suggested guard.

### Optimized aggregation

By default, aggregation is optimized and skips unchanged accounts without re-running correlation. See the identity model page before you debug an uncorrelated account.

### Scheduling facts

- Frequencies are daily, every N, weekly and monthly. A daily recurrence ends at midnight, and monthly dates run from 1 to 28.
- **The schedule time zone follows the VA cluster setting, and schedules do not shift for daylight saving time.** For a global program, write the time zone next to every schedule.
- Queued or in-progress operations can delay the start of an aggregation.

### Flat files

- For best results keep flat files under 500 MB.
- A delimited file should be **sorted by account ID.** Otherwise you can see one entitlement per account, because rows for the same account are not adjacent.
- Without a connected VA, the flat file source is loaded by upload ("aggregate using latest file"), not by a schedule.

## Actions

- Use the pattern selection order and record the reasons.
- Send the questionnaire in the first email and ask for the lower environment immediately.
- Publish a capability statement per application.
- Set `IIQDisabled` in both directions in every rule.
- Produce the document pack as part of the definition of done.
