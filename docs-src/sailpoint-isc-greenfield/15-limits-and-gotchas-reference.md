---
title: Limits, Caveats and Workarounds Reference
---

One table per area, for use during build and support. Each row says what happens, what to do instead and which page of the guide explains it. Items are **Observed** on the program unless marked otherwise. Limits tied to licensing or release level (the workflow tier limit, unlicensed actions, the VA timeout) were measured on a 2026 tenant: re-test on yours before designing around them.

## Search, API and listing

| Caveat | Workaround | Page |
|---|---|---|
| A `limit` above 250 on the source-app access-profile sub-resource returns an empty list, silently | Page at 250 | Access Model |
| The source-app list payload shows an empty `accessProfiles` array for apps that have profiles | Read the app's own sub-resource | Access Model |
| Entitlement **attributes are not indexed**; only name, value, attribute, schema and source are searchable | Put the context in the display name or in tags | Forms and Workflows |
| Values containing hyphens tokenise, so wildcard prefix queries on them fail | Query on another field, or use tags | Forms and Workflows |
| `GET /connector-rules/{id}` returns the script in clear text, including any embedded credential | Never put credentials in rules; restrict who can call it | Security |
| Cloud rules cannot be read with `GET` | Use the configuration export with type `RULE` | Security |
| `GET /sources/{id}` returns attributes not on the `encrypted` list in clear | Audit the `encrypted` list | Security |
| A list rendered into a Lucene query appears as `[5 2]` and gives HTTP 400 | Build `tags:("A" "B")` as an OR | Forms and Workflows |

## Aggregation and paging

| Caveat | Workaround | Page |
|---|---|---|
| A single large page with no paging steps drops the overflow silently, and the dropped accounts later look deleted | Implement paging; monitor population per run and alert on a drop or a count equal to a page size | Web Services and JDBC |
| An expired token returning an HTTP 200 body is not an error to the connector | Detect in the rule and refresh | Connector Patterns |
| Aggregate groups before accounts, or entitlement references dangle | Order the aggregations | Connector Patterns |
| Every source needs a schedule. Two production sources ran for months without one | Make the schedule a line on the onboarding checklist and monitor last aggregation date | Hypercare |
| Delete threshold defaults can allow a mass delete if a source returns nothing | Set it deliberately on every source (10 percent on the directories) and verify; an early document and a later one disagreed on one source, so verify rather than trust | Active Directory |
| Entitlement counts halving between runs | A truncated aggregation: check paging and the delete threshold | Symptom Lookup |

## Connectors and rules

| Caveat | Workaround | Page |
|---|---|---|
| A status comparison that stops matching makes every account look enabled | Set `IIQDisabled` in both directions in every rule | Connector Patterns |
| `HttpURLConnection` cannot send PATCH | GET then PUT, or use the connector's own HTTP helper | Web Services and JDBC |
| An Apache HTTP client inside a rule produced consecutive aggregation errors and was reverted | Use the connector's own helper | Web Services and JDBC |
| Cloud rules have no network access | Move lookups to a workflow or a connector rule | Identity Model |
| A cloud rule cannot call an external model or service | Run the call elsewhere and hand the result in | Identity Model |
| Rule changes may need SailPoint to deploy them | Plan release time for it | Security |
| Rules that parse identifiers out of entitlement names depend on the name format | Treat the format as a contract; never rename | Access Model |
| Double spaces or case differences in names (two rules in one set had a double space) | Look up by exact name and normalise | Web Services and JDBC |
| Correlation is case-sensitive | Normalise case, or correlate on a normalised attribute | Identity Model |
| Two rule variants left in the tenant (four near-identical lifecycle rules) | Keep one, archive the rest outside | Identity Model |
| Debug webhook helpers in production rules fail provisioning when the listener is down | Remove, or gate behind a false flag and swallow failure | Security |
| IQService before and after scripts run on the Windows host, outside the cloud sandbox | Use sparingly and document | Active Directory |

## Lifecycle and identity

| Caveat | Workaround | Page |
|---|---|---|
| Lifecycle state actions name target sources by explicit list. Only 13 of 146 sources were in the disable action at the end | Add "update the lifecycle source list" to every onboarding checklist | Lifecycle |
| An organisation setting controls whether lifecycle changes honour a source's "can enable" flag | Know its value | Lifecycle |
| Account creation happens in the user's local time zone, and the termination cut-off is local | Document the time zones (organisation, workflow schedule, identity) | Architecture |
| The HR feed carried years of leavers: about 43,000 identities for about 13,000 people | Filter or treat as inactive by design | Identity Model |
| More than 1,300 directory accounts had no employee id | Clean up before the first production aggregation | Testing and Go-Live |
| A predictable initial password built from HR attribute slices | Generate randomly | Active Directory |
| A last day wrongly entered in HR disables the wrong day | Mandatory fields and an HR change process | Lifecycle |

## Access model and requests

| Caveat | Workaround | Page |
|---|---|---|
| Entitlements requestable directly bypass the approval scheme | Make entitlements non-requestable by default; search for exceptions | Access Model |
| One person owning thousands of profiles routes every review through them | Governance groups | Access Model |
| Governing profiles over a huge catalogue (tens of thousands of role assignments) is not worth it | Review the catalogue; request only what is asked for | Access Model |
| Approvals with no reminders or fallback sit forever | Set reminders and a fallback approver | Access Model |
| Revocation approval defaults to none | Decide and record per application | Access Model |
| Role propagation was disabled | Know the setting | Access Model |
| Empty placeholder roles clutter reports | Fill or remove | Access Model |
| Applications with no tile are discoverable only by search | Publish the naming convention | Access Model |

## Forms and launchers

| Caveat | Workaround | Page |
|---|---|---|
| Dependent dropdowns cannot cascade through search data sources | Multi-step interactive forms | Forms and Workflows |
| Data-source queries do not interpolate form values | Use workflow-built option lists | Forms and Workflows |
| A condition on a form **input** did nothing; element conditions work | Test in a browser | Forms and Workflows |
| `SHOW` only works on a section | Invert to hides | Forms and Workflows |
| Section labels are not rendered | Put text in field labels | Forms and Workflows |
| Operators other than `EQ`, `CO`, `NOT_CO`, `IN`, `NOT_IN`, `SW`, `EW` are rejected; string and boolean only | Restructure the condition | Forms and Workflows |
| No repeatable group | Fixed blocks revealed by condition, or loop over a multi-select | Forms and Workflows |
| Conditions address elements by numeric id | Preserve ids when editing | Forms and Workflows |
| Input and element casing can differ (`userSailpointId` and `userSailPointId`) | Read the element's casing downstream | Forms and Workflows |
| Launcher-driven forms leave `formData` empty in execution history | List form instances; a GET by id omits `formData` | Forms and Workflows |
| Deleting a form while a launch is open breaks it with a 404 | Retire it instead | Forms and Workflows |
| A launcher is not patchable (405) and is visible only when assigned and its workflow is enabled | Assign through an entitlement or a role | Forms and Workflows |

## Workflows

| Caveat | Workaround | Page |
|---|---|---|
| Secrets written through the API are silently dropped; the reference form comes only from the UI | Create secrets in the UI | Forms and Workflows |
| A full PUT wipes a UI-set secret | Read back and preserve the reference | Forms and Workflows |
| One OAuth reference per workflow | Avoid two credentialed HTTP steps in one workflow | Forms and Workflows |
| An unresolved template path renders as literal `{{...}}` | Verify field names; never assume an error | Forms and Workflows |
| `.JSON()` is the only stringify function | Use it | Forms and Workflows |
| Define Variable and Update Variable allow at most 50 operations per variable (documented) | Group | Forms and Workflows |
| The workflow tier limit is 50 steps after the trigger, counting loop bodies | Split workflows | Forms and Workflows |
| Validation happens on enable; step display names must be under 65 characters | Enable to validate | Forms and Workflows |
| An enabled workflow cannot be PUT | Disable, PUT, enable | Forms and Workflows |
| `sp:generic-approval` was not licensed | Form-based approval | Forms and Workflows |
| `sp:interactive-form` does not reliably raise `sp:form-submitted` | Trigger on the approval form | Forms and Workflows |
| There is no create-account action | `POST /accounts`, which runs the connector create and its before-rules | Forms and Workflows |
| Inner loop steps are missing from the parent history | Debug the inner execution | Forms and Workflows |
| A call that exceeds the VA timeout (63 seconds, measured) wedged a requester for about an hour | Keep calls short and asynchronous | Web Services and JDBC |
| Workflow definitions can carry secrets | Reference, not literal | Security |

## Campaigns

| Caveat | Workaround | Page |
|---|---|---|
| Uncorrelated accounts are never in an access campaign | A source-owner campaign | Campaigns |
| Reviewers cannot review their own access; ISC moves the item to the manager | Tell reviewers | Campaigns |
| User ids differing only in case make ISC drop one spelling | Unify them when writing the file | Campaigns |
| Reviewer display names must be unique | Use email | Campaigns |
| Attributes used by correlation or a profile cannot be deleted or renamed | Add new first, remove old last | Campaigns |

## Configuration and promotion

| Caveat | Workaround | Page |
|---|---|---|
| Source secrets do not move with Config Hub | Re-enter in the target tenant | Testing and Go-Live |
| VAs and clusters are per tenant | Build them | Testing and Go-Live |
| JDBC URLs, hostnames and rule literals differ per environment | An environment table; search rules for sandbox values | Testing and Go-Live |
| Mail routing differs per environment | A notification matrix | Hypercare |
| The `encrypted` list can drift or hold duplicates | Audit it | Security |
| The `features` list can overstate capability | Run the operation and record what works | Security |

## How to use this table

1. Before designing a form, workflow or connector, read the matching section.
2. When something misbehaves, search this page for the symptom, then the last page for the diagnostic.
3. Add a row when you find a new limit, with the date measured and the tenant release.

## Documented by SailPoint

Limits and behaviours taken from SailPoint's own documentation (checked October 2026) rather than from our measurements. Each links to the page of the guide where it is discussed.

| Area | Documented limit or behaviour | Page |
|---|---|---|
| API | 100 requests per client ID and API version per 10 seconds; HTTP 429 with a `Retry-After` header | Web Services and JDBC |
| Aggregation | Optimized by default: unchanged accounts skip account and manager correlation. `disableOptimization=true` through the API for one unoptimized run | Identity Model |
| Aggregation | Delete threshold is an integer 1 to 100, rounded to whole accounts, and applies to scheduled and flat-file runs | Connector Patterns |
| Aggregation | Schedule time zone follows the VA cluster setting and does not shift for daylight saving time | Connector Patterns |
| Flat files | Best under 500 MB; delimited files sorted by account ID | Connector Patterns |
| Quick compliance sources | Up to 3 aggregations per day, 8 hours apart, not applied to Org Admins | Connector Patterns |
| Workflows | 400K executions per day at full speed, then about 5 per second; up to two hours after first enablement | Forms and Workflows |
| Workflows | Parallel loop 250 items; serial loop 1,000 items; serial loop test limited to 50 iterations | Forms and Workflows |
| Workflows | One trigger per workflow; 50 operations per variable | Forms and Workflows |
| Identity profile | One profile per identity, by priority; user name, work email and last name required; avoid `* ( ) & ! .` in the user name source | Identity Model |
| Identity profile | Cannot create or delete a profile during an account aggregation; deleting a profile deletes its identities | Identity Model |
| Certifications | Automated reassignment stops after four hops | Campaigns |
| Config Hub | 10 manual backups, 5,000 objects per backup or draft, weekly system backups kept to five | Testing and Go-Live |
| Config Hub | Unsupported object types are skipped and the import still reports COMPLETE; non-employee sources cannot be deployed | Testing and Go-Live |
| Virtual appliances | At least two per cluster, sandbox included; one per host; reserved range `10.255.255.241/28`; untrusted certificates rejected | Architecture |
| Tenant | Org name 3 to 13 characters; sandbox URL carries `-sb` | Architecture |

## Actions

- Keep a copy of this table in your project wiki and add rows as you find them.
- Re-test every platform-limit row on your tenant before relying on it.
- Link each row from the design document that depends on it.
