---
title: Web Services and JDBC Connector Field Notes
---

Web Services and JDBC are the two connectors that carry a custom integration. Both look configuration-driven and both are really code-driven: the interesting behaviour lives in connector rules. This page collects the mechanics, the traps and the patterns that worked.

## Part 1: the Web Services connector

### Anatomy

A Web Services source is a list of **endpoints**, each tagged with an operation type: Test Connection, Custom Authentication, Account Aggregation, Group Aggregation, Get Object, Create, Update, Enable, Disable, Add Entitlement, Remove Entitlement. Some placeholders recur everywhere:

| Placeholder or field | Meaning |
|---|---|
| `$application.<attr>$` | A connector attribute, for example the bearer token the authentication endpoint maintains |
| `$plan.<field>$` | A value from the provisioning plan |
| `$response.<field>$` | A field of the response in a chained Get Object call |
| `rootPath` | JSONPath where the records start in the response |
| `resMappingObj` | Maps response fields to schema attributes. **An attribute absent from it is never populated**, even if the schema declares it and the API returns it |
| `parentEndpointName` | Chains a Get Object call to an aggregation call, so a list returns thin records and each is fetched in full. Aggregation becomes N+1 |
| `beforeRule` / `afterRule` | Attach a connector rule to an endpoint |
| `possibleHttpErrors`, `authenticationFailedErrorMsg` | Let the connector recognise an application-level error inside an HTTP 200 |
| `encrypted` | The list of connector attributes stored encrypted. Anything not on it can be returned in clear text by the API |
| `throwProvBeforeRuleException`, `throwProvAfterRuleException` | When true, an exception in a rule fails the operation instead of being swallowed. Leave both true |

```html
<!-- dgm:ws-pipeline -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 262" role="img" aria-labelledby="ws-pipeline-t ws-pipeline-d" xmlns="http://www.w3.org/2000/svg"><title id="ws-pipeline-t">Where rules run around a web services operation</title><desc id="ws-pipeline-d">Each operation can run a before rule, then the HTTP call, then an after rule that reshapes the response.</desc><defs><marker id="ws-pipeline-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="ws-pipeline-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="grp teal" x="0" y="8" width="820" height="112" style="fill:none;stroke:var(--teal);stroke-opacity:0.65;stroke-dasharray:6 4"/><text class="h" x="10" y="23" text-anchor="start">Aggregation</text><rect class="box " x="14" y="34" width="130" height="76" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="79.0" y="62.5" text-anchor="middle">Operation</text><text class="s" x="79.0" y="77.5" text-anchor="middle">account or group</text><text class="s" x="79.0" y="90.5" text-anchor="middle">aggregation</text><rect class="box violet" x="174" y="34" width="130" height="76" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="239.0" y="56.0" text-anchor="middle">Before rule</text><text class="s" x="239.0" y="71.0" text-anchor="middle">token, paging,</text><text class="s" x="239.0" y="84.0" text-anchor="middle">parameters</text><text class="m" x="239.0" y="97.0" text-anchor="middle">requestEndPoint</text><path class="ln teal  " d="M144,72.0 L174,72.0" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ws-pipeline-ar-teal)"/><rect class="box blue" x="334" y="34" width="130" height="76" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="399.0" y="62.5" text-anchor="middle">HTTP call</text><text class="s" x="399.0" y="77.5" text-anchor="middle">connector client</text><text class="s" x="399.0" y="90.5" text-anchor="middle">on the appliance</text><path class="ln teal  " d="M304,72.0 L334,72.0" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ws-pipeline-ar-teal)"/><rect class="box violet" x="494" y="34" width="130" height="76" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="559.0" y="56.0" text-anchor="middle">After rule</text><text class="s" x="559.0" y="71.0" text-anchor="middle">reshape, disabled</text><text class="s" x="559.0" y="84.0" text-anchor="middle">flag, allowlist</text><text class="m" x="559.0" y="97.0" text-anchor="middle">rawResponseObject</text><path class="ln teal  " d="M464,72.0 L494,72.0" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ws-pipeline-ar-teal)"/><rect class="box teal" x="654" y="34" width="130" height="76" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="719.0" y="69.0" text-anchor="middle">Accounts</text><text class="s" x="719.0" y="84.0" text-anchor="middle">mapped into ISC</text><path class="ln teal  " d="M624,72.0 L654,72.0" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ws-pipeline-ar-teal)"/><rect class="grp gold" x="0" y="136" width="820" height="112" style="fill:none;stroke:var(--gold);stroke-opacity:0.65;stroke-dasharray:6 4"/><text class="h" x="10" y="151" text-anchor="start">Provisioning</text><rect class="box " x="14" y="160" width="130" height="76" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="79.0" y="188.5" text-anchor="middle">Plan</text><text class="s" x="79.0" y="203.5" text-anchor="middle">from a request or</text><text class="s" x="79.0" y="216.5" text-anchor="middle">lifecycle action</text><rect class="box violet" x="174" y="160" width="130" height="76" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="239.0" y="175.5" text-anchor="middle">Before rule</text><text class="s" x="239.0" y="190.5" text-anchor="middle">build body, read</text><text class="s" x="239.0" y="203.5" text-anchor="middle">comments, live</text><text class="s" x="239.0" y="216.5" text-anchor="middle">lookup</text><text class="m" x="239.0" y="229.5" text-anchor="middle">provisioningPlan</text><path class="ln gold  " d="M144,198.0 L174,198.0" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ws-pipeline-ar-gold)"/><rect class="box blue" x="334" y="160" width="130" height="76" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="399.0" y="188.5" text-anchor="middle">HTTP call</text><text class="s" x="399.0" y="203.5" text-anchor="middle">create, modify,</text><text class="s" x="399.0" y="216.5" text-anchor="middle">enable, disable</text><path class="ln gold  " d="M304,198.0 L334,198.0" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ws-pipeline-ar-gold)"/><rect class="box violet" x="494" y="160" width="130" height="76" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="559.0" y="188.5" text-anchor="middle">After rule</text><text class="s" x="559.0" y="203.5" text-anchor="middle">check the response</text><text class="s" x="559.0" y="216.5" text-anchor="middle">body</text><path class="ln gold  " d="M464,198.0 L494,198.0" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ws-pipeline-ar-gold)"/><rect class="box gold" x="654" y="160" width="130" height="76" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="719.0" y="188.5" text-anchor="middle">Result</text><text class="s" x="719.0" y="203.5" text-anchor="middle">committed or</text><text class="s" x="719.0" y="216.5" text-anchor="middle">failed</text><path class="ln gold  " d="M624,198.0 L654,198.0" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ws-pipeline-ar-gold)"/></svg></div><figcaption><b>Rule hook points.</b> Rules run on the appliance, around the connector's own call. Logic that looks missing from the endpoint configuration is usually in the before rule.</figcaption></figure>
```

### Authentication

Use a **Custom Authentication** endpoint when the API issues its own tokens: ISC posts the credentials, reads the token from the response, and stores it in an encrypted attribute that every other endpoint references.

Traps seen:

- **Expired tokens returned as HTTP 200.** One application returned `200` with `TOKEN_EXPIRED` or `JWT token expired!` in the body, not `401`. The connector only re-authenticates if those strings are listed in `authenticationFailedErrorMsg` and `possibleHttpErrors`. Misspell one or let the vendor reword it and error bodies flow into the account pipeline as data, with no alert.
- **Tokens with no refresh.** A 24-hour maximum token with no refresh token means the connector re-authenticates from scratch. Fine, but it makes the token endpoint a single point of failure.
- **The token endpoint can fail under concurrency.** In a sandbox test, five simultaneous request submissions timed out 5 out of 5 on one vendor's token endpoint. Stagger bulk work.
- **Rules that mint their own tokens.** Two rules on one source requested a token with the service account name and password embedded as query parameters in a URL literal in the rule source. When the service credential rotates it must be changed in the source **and** each rule, and a live `GET` of the rule returns the credential in clear text. Use `$application.token$` or a connector attribute instead.
- **Credential halves left in clear.** An API client id and secret pair was split: the secret was on the `encrypted` list, the id was not. Add every credential-like attribute to `encrypted` and then verify through the API that it returns masked.

### Pagination, volume and ceilings

| Pattern | What happens |
|---|---|
| Single page with a large `pageSize`, `enableHasMore` false, no paging steps | Works until the population exceeds the page size. Then the overflow is **silently dropped**. On a later run those accounts look deleted and, if the delete threshold allows, are removed with their entitlement links |
| Real pagination with `paginationSteps` | Follow a "next page" indicator; a Salesforce-style `done` flag plus `nextRecordsUrl` was used for HR |
| N+1 Get Object | A 600-account population needs about 600 sequential calls. Raise the timeout (180 s versus a 120 s norm) and pick a quiet window |
| No partitioning, no delta | Every run is a full sweep. Partitioning is the lever if the population grows |
| An API built for the integration | May return everything in one response; no pagination needed. Confirm with the owner, do not assume |

Add **population monitors**: record the number of accounts returned per run and alert on a sudden drop or a count that sits exactly at a page size.

### After-rules: the contract and the patterns

An after-rule receives the raw response and **must return `{"data": [ ... ]}`**, a list of account maps, even for one record. They are where most real logic sits.

```java
// Minimal shape of a status-aware after-rule.
Map newmap = new HashMap();
newmap.put("UserID", resp.get("UserID"));
// ... copy the fields you want (allowlist) ...

// Normalise the target's wording, set the flag in BOTH directions.
String enabled = String.valueOf(resp.get("UserIsEnabled"));
newmap.put("IIQDisabled", !"true".equalsIgnoreCase(enabled));

List data = new ArrayList();
data.add(newmap);
return Collections.singletonMap("data", data);
```

What after-rules did across the program:

- Built composite entitlement values and removed vendor-internal fields.
- Exploded a comma-delimited role field into one entitlement per role.
- Dropped roles by agreement (anything containing "admin" was excluded from governance on one integration).
- Made a **second HTTP call** to merge in data the first call cannot return, for example a disabled-users list, or the second half of a group catalogue.
- Synthesised a display name from first and last name.

Cautions:

| Caution | Detail |
|---|---|
| Allowlist beats denylist | Copy named fields onto a fresh map. Stripping a denylist lets any new vendor field flow into the account. The allowlist has the opposite cost: a new field is dropped until the rule changes. Pick on purpose |
| Set both flag directions | A rule that only sets `IIQDisabled: true` depends on absence meaning enabled |
| Exact-string status checks | `"InActive".equals(status)` stops matching on `Inactive`, `INACTIVE`, `0` or a JSON boolean. Normalise first |
| Fail loudly on a second call | If the second call cannot be made (no token), log an unmistakable line and alert on it. Otherwise the population looks entirely enabled |
| Logging level | One rule logged every account at error level on every run, with the whole list, daily. Wrong severity buries real errors |
| Debug flags | Keep a `LOGGING_ENABLED`-style flag, default false, and switch it on only for a diagnostic window |
| Unreachable code | Dead statements after a `return` hide mistakes. Delete them |

### Before-rules: rewriting what gets sent

A before-rule receives the endpoint and the provisioning plan and returns a modified endpoint. They are used when the plan placeholders cannot build the request.

- **The endpoint body can be dead configuration.** If the rule replaces the body, anything written in the endpoint's body field is misleading. We found endpoints whose `jsonBody` was null, and others whose body used a different key than the rule sent. Document that "the rule is the only place the request exists".
- **One rule for both add and remove.** A single rule can serve both entitlement directions by reading each attribute request's own operation. Editing it changes both directions at once.
- **Substitution-string encodings.** One product took parameters as a flat string of comma-separated `name=value` pairs, with square brackets around values containing spaces. The rule builds the string. A value containing a comma or a bracket breaks it, and nothing escapes it.
- **Swallowed exceptions.** Wrapping the whole loop in `try/catch (Exception) { log }` converts a loud failure into a request with blank substitution variables. Let the exception propagate so the operation fails.
- **Only some attributes sync.** A before-rule that builds an update body from a `switch` over attribute names only supports the names in the switch. Anything else produces a plan that **reaches the target with the field absent and succeeds**. Name this limit in your capability statement.
- **Policy-only fields.** A field can exist only in the provisioning policy so the rule can read it, never in the schema. It will never appear on an aggregated account. That is elegant and looks like a mistake if you do not know it.
- **Environment values hard-coded in rules.** Base URL, application name and API version appeared as literals in both the endpoint and the rules. A URL change is a rule change. Read them from connector attributes.
- **HTTP library choice.** `HttpURLConnection` cannot send PATCH (use GET then PUT instead). An Apache HTTP client inside a rule produced consecutive aggregation errors and was reverted. Use the connector's own `WebServicesClient`.
- **Time-limited calls.** A call that exceeds the VA timeout (63 seconds in our measurement) wedged that requester for about an hour: every later request from the same identity came back cancelled.

### Revocation done in rules

On one REST integration the Remove Entitlement endpoint did almost nothing. Two before-rules, about 400 lines each, read live grants from the target, decided between removing one role, deleting a grant row or disabling the user, and called four endpoints directly.

Read the rules, not the endpoint, to learn what revocation does. A benefit of this design: it reads **live** data, so revocation stays correct even when the aggregated view in ISC is months old.

### The debug webhook

Four production rules across the tenant posted diagnostics to an internal HTTP listener through a `sendLog` helper. Two versions existed:

| Version | When the listener is down |
|---|---|
| Unsafe: throws a runtime exception, no timeouts | The operation fails or hangs |
| Safe: catches, logs a warning, 2-second timeouts | The operation continues |

**Remove debug webhooks before production.** If you must keep one, use the safe version and a flag set to false.

### Names with whitespace

Two traps cost real time:

- A schema named with **two spaces** between words propagates into every endpoint operation type and connector attribute. A single-space search finds nothing. Renaming detaches every entitlement and access profile, so leave it.
- Two rules in the same set carried a **double space** after a prefix; the other two did not. Looking up by the "obvious" name returned nothing.
- Header values with trailing spaces or leading spaces in keys are harmless until a stricter server arrives.

Choose names without whitespace in the first place and lint for it.

### Test Connection is not a test

Test Connection often calls a trivial endpoint (`LIMIT 2`, a filter that matches nothing). It proves reachability and authentication, not the aggregation projection. After a change, run a **small-scope aggregation** and compare counts and status distribution.

## Part 2: the JDBC connector

### Anatomy

| Attribute | Purpose |
|---|---|
| `SQL` / `<schema>.SQL` | The aggregation query for a schema |
| `getObjectSQL` | Single-account read, with the native identity substituted |
| `testConnSQL` | Used by Test Connection |
| `url`, `user`, `password`, `driverClass` | The connection |
| `buildMapRule` | A **JDBCBuildMap** rule that runs per result-set row |
| `jdbcProvisionRule` | A **JDBCProvision** rule that does *all* writes |

**There is no provisioning SQL on the source.** `createSQL`, `updateSQL`, `enableSQL` and the entitlement maps are all null. Every write is a `PreparedStatement` opened inside the provisioning rule. To know what provisioning does, read the rule.

### Configuration traps

- **Three copies of every setting.** The UI writes the account schema's settings under the bare name, an `undefined.` prefix and, for groups, both `Group.` and `group.`. They are normally identical. On one source they were not: two different host addresses for the same database. Which was used depended on how the schema was addressed. **Edit through the UI so all copies stay in step**, and check all prefixes after any API change.
- **The driver JAR is per source.** A driver upgrade is repeated on every JDBC source.
- **Duplicate entries in the `encrypted` list** (`privateKey`, `passphrase` twice, an `undefined.password`) suggest hand editing. Tidy, but verify each name against a real attribute first.
- **Environment names hard-coded in rule SQL.** A sandbox rule backup named the sandbox database in every statement, so promoting it unchanged would point production at the sandbox. Parameterise environment-specific names.
- **A production source on an instance named like a test instance.** Confirm instance names with the DBA team.

### Aggregation SQL traps

| Trap | Effect |
|---|---|
| `TOP (1000)` | Silently truncates a catalogue |
| Hard-coded ID lists for groups (`WHERE ID = 254 OR ID = 255`) | Adding a group means editing SQL; there is no category filter |
| Filter `IsWindowADAccount = '1'` | Only AD-linked accounts are visible. Counts are not user counts. A user who stops being AD-linked drops out and is deleted next run |
| Join to a group-user table producing a row per user-group pair | With `isMulti: false` and `mergeRows: false`, ISC has no instruction to merge rows into one account with two entitlement values. Set the attribute multi-valued and enable row merging |
| Status baked into the entitlement value | Same group-client pair exists as active and inactive values, inflating counts and campaigns |
| Schema with identity and display inverted | An access form drawing options from the schema empties if you change the identity attribute |

### Build-map rules

A build-map rule turns one row into an account map. A brittle version:

```java
Map map = JDBCConnector.buildMapFromResultSet(result, schema);
Boolean status = (Boolean) map.get("IsActive");   // throws on null or a non-boolean
if (status == false) map.put("IIQDisabled", true);
return map;
```

If the column is null or the driver returns a different type, the cast throws and **that row fails**. The account silently drops out of the aggregation and later becomes a deletion candidate. A robust version:

```java
Map map = JDBCConnector.buildMapFromResultSet(result, schema);
Object v = map.get("IsActive");
boolean active = v != null && "true".equalsIgnoreCase(String.valueOf(v));
map.put("IIQDisabled", !active);
return map;
```

### Provisioning rules

Patterns that worked:

1. **Dispatch on `AccountRequest.Operation`**: Create, Modify, Disable, Enable, Delete.
2. **Use a transaction for multi-table writes.** The most robust rule inserted into three tables with auto-commit off, committed on success, and rolled back on a SQL exception, then set `STATUS_FAILED`.
3. **Check for duplicates** before inserting an assignment.
4. **Resolve names to IDs inside the rule** (role name to role ID) rather than expecting ISC to supply IDs.
5. **Refuse delete explicitly** with a clear message; accounts are disabled, not deleted.
6. **Call a stored procedure when the target has complex side effects.** Let the application team own the procedure and its tests.
7. **Treat the status flags as two-sided.** Disabling set one status column in one table and another account-status column in a second table, and enabling reversed both and cleared the termination date.

Gotchas:

| Gotcha | Detail |
|---|---|
| An undeclared variable gates the whole create path | A rule's guard condition referenced two identifiers that were never declared (a corrupted spelling and a case mismatch). The condition could never evaluate as intended. The **modify** path, used by most requests, had separate code and worked, so nobody noticed. Exercise every operation in a lower environment, especially create for a person with no existing account |
| Failures in the target but not the mirror | See below |
| Credentials in rules | Rules on the Web Services sources carried service credentials as URL query parameters; check JDBC rules for embedded connection strings too. Rotation must change the source and every rule |
| Rule gate uses the access request comments | See below |

### Carrying extra provisioning data: the comments channel

The ISC provisioning plan has no field for "which database" or "which client". Two integrations needed to insert **several entitlement values in one write** (role plus office plus client; group plus client plus database). The solution:

1. The request form captures all selections.
2. The workflow writes them as **JSON into the comments of the access request** (`Manage Access` step).
3. The provisioning rule reads `attrReq.getComments()`, parses the JSON, clears the comment and acts on the values.

```java
AttributeRequest ar = account.getAttributeRequest("databases");
Map meta = JsonUtil.toMap(ar.getComments());
ar.setComments(null);
if (meta == null) throw new RuntimeException("METADATA IS NULL");
String client   = (String) meta.get("RequestedClientName");
String database = (String) meta.get("dataBaseToBeProvisioned");
String group    = (String) meta.get("RequestedGroup");
```

This works and is the best answer found to an out-of-the-box limitation. It has a hard coupling:

| If you do this | What happens |
|---|---|
| Rename the JSON keys in the workflow | The rule throws `METADATA IS NULL` or reads nulls |
| Rename the keys in the rule | The workflow's payload is no longer understood |
| Grant the entitlement any other way (API call, role, certification remediation, access profile) | No comments arrive; the rule throws and provisioning fails |

**The only supported way to grant that entitlement is the launcher.** Say so on the page where someone might try another route, or make the rule fall back to deriving the values from the entitlement itself. Change the workflow and the rule as one unit.

### A central database in front of many databases

One application used a database **per client**. ISC cannot aggregate across many databases through one source. The solution was a **centralised mirror schema** that holds users, entitlements and a client-to-database map, with a stored procedure that writes into the right client database.

Consequences to design for:

- Every provisioning operation writes **twice**: through the procedure into the real client database, and into the mirror so the next aggregation sees it.
- If the procedure fails but the mirror write succeeds, **ISC reports the mirror's view** and re-provisioning looks like a no-op. "ISC says I have it, the application says no" is the symptom.
- The client-to-database map is itself an entitlement. A change to the schema's identity attribute empties the client dropdown on the request form.
- A dedicated-instance sibling of the same application used plain SQL per client with a fixed group list; a shared, hard-coded build map served both.

### Secrets, rotation and rule inventory

- 41 connector rules existed. Maintain an inventory: rule name, type, the source it is attached to, and **every place it hard-codes an environment value or credential**.
- A rule is a record you can read with a normal API call. Exports and shared copies should be scrubbed of connection strings, query-string credentials and long hex literals.
- Unattached rules (templates, older versions) accumulate. Prune them or label them.

## Part 3: testing a custom integration

A checklist that would have caught most of the defects above:

1. Test Connection, then a **small-scope aggregation**, then a full one. Compare account and entitlement counts to the target.
2. Status: confirm a known-disabled account aggregates as disabled and a known-enabled one as enabled. Change a wording in the target in a lower environment and confirm the failure is visible.
3. **Overflow**: temporarily reduce a page size or `TOP` and confirm you can see the drop.
4. Run each provisioning operation in a lower environment: create (for a person who has **no** account), enable, disable, add each entitlement type, remove each type, and an unsupported operation.
5. Run the same operation by every legitimate route (form, access profile, role, API).
6. Simulate a target outage mid-operation and confirm the plan fails rather than reports success.
7. Look in the target and confirm the result. Do not trust the ISC status.
8. Re-aggregate and confirm ISC shows the change.
9. Rotate the credential and confirm where it must change.
10. Turn logging on, read the log of one run, and turn it off.

## What SailPoint's documentation and community add

### API rate limits

The [rate limit documentation](https://developer.sailpoint.com/docs/api/rate-limit/) states a default of **100 requests per client ID and API version per 10 seconds.** Exceeding it returns HTTP 429 with a `Retry-After` header giving the seconds to wait. Individual APIs may differ, so check each specification. Practical impact for this guide:

- A script that loops over campaigns, sources or profiles needs backoff. Plan concurrency around the client ID, not the token, and note that two scripts sharing one client share the allowance.
- Do not give every tool the same administrator client. Separate clients give separate allowances and a usable audit trail.
- The Web Services connector backs off on 429 using `Retry-After`. Community reports describe a limited number of retries, so a vendor API with a tight limit can still fail an aggregation. Check the vendor's own limit before choosing page size and concurrency.

### Provisioning retries

Community threads describe a retry mechanism for provisioning: a retryable error is retried a limited number of times (three is commonly quoted), configured per source through `retryableErrors` with optional `provisioningMaxRetries` and `provisioningRetryThreshold`. Reports conflict on whether the threshold can be tuned and whether the spacing is one minute or one hour, and one report quotes support saying the values are fixed. **Treat retries as a behaviour to test on your tenant, not a setting to rely on.** Match error codes or stable message fragments, not messages containing dates or sequence numbers.

### Pagination cautions from the community

- Identify the application's real paging parameter first; many are not `startIndex`.
- Offset paging can break when data changes during the run. If the vendor offers a cursor or query token, prefer it.
- Large page sizes can time out. One thread reports aggregation timing out above a count of 200.
- A `TERMINATE_IF` check on record count must be placed correctly relative to the offset increment, or the loop ends early.
- Mixing connectors is legitimate. A JDBC source for aggregation with a web-services path for provisioning is a documented community pattern where the application has no aggregation API.

## Actions

- Write the capability statement and publish it with the rule inventory.
- Add population-count, status-count and last-aggregation-age monitors.
- Remove debug webhooks and embedded credentials before production.
- Edit multi-prefix JDBC attributes only in the UI.
- Test each provisioning operation by each route in a lower environment.
