---
title: API Recipes and Symptom Lookup
---

The last page is for the person on call. It lists the read-only API calls that explain most situations, then a symptom table generalised from the runbooks of several integrations. Everything here is safe to try first; none of the calls change anything unless marked.

## Read-only API calls

Use a token with read scope. Version prefixes (`v2025`, `beta`) change over time, so confirm them against the current API reference.

```
GET  /v2025/sources/{id}
GET  /v2025/sources/{id}/schemas
GET  /v2025/sources/{id}/provisioning-policies
GET  /beta/sources/{id}/schedules
GET  /v2025/connector-rules
GET  /v2025/connector-rules/{id}
GET  /v2025/entitlements?filters=source.id eq "{id}"
GET  /v2025/access-profiles?limit=250
GET  /beta/source-apps
GET  /beta/source-apps/{id}/access-profiles?limit=250
GET  /v2025/roles
GET  /v2025/workflows
GET  /v2025/workflows/{id}
GET  /v2025/form-definitions
GET  /v2025/form-definitions/{id}
GET  /v2025/launchers
GET  /v2025/identity-profiles
POST /v2025/search
```

| Call | Use it to | Watch out for |
|---|---|---|
| Source, schemas, provisioning policies | See what a source is configured to do | A source can be configured to do nothing while rules do the work |
| Schedules | Find sources with no aggregation schedule | An empty list is the finding |
| Connector rules, by id | Read the script | **Returns the script in clear text, including any embedded credential.** Do not paste the output anywhere |
| Entitlements filtered by source | Count and inspect | Counts that halve between runs mean a truncated load |
| Access profiles | Inventory | Page at 250 |
| Source apps and their sub-resource | See which profiles a tile holds | The list payload shows empty arrays. Use the sub-resource, and a `limit` above 250 returns an empty list silently |
| Roles | Inventory criteria roles | Read the criteria; membership is attribute-driven |
| Workflows and form definitions | Inspect triggers and steps | Secrets may be present. A launcher-driven form instance shows `formData` only in the list call |
| Launchers | See what is exposed to users | Not patchable |
| Identity profiles | Check mappings | Compare sandbox and production |
| Search (POST) | Aggregations for counts, status and freshness | The best monitoring tool in the platform |

### Two calls that change things

- **`POST /v2025/accounts`** runs the connector's create operation and its before-rules. Use it to prove a create works. Use a test identity.
- **Configuration export with type `RULE`** is the way to read cloud rules, which cannot be fetched with `GET`. Treat the export as sensitive.

### Search recipes

Run these through the search API against the `identities`, `accounts` and `entitlements` indices. The query strings are ideas, not tested syntax: confirm the field names on your tenant first.

| Question | Query idea |
|---|---|
| Which sources have not aggregated recently? | Aggregation on the last aggregation date attribute, sorted ascending |
| How many disabled accounts on a source? | Accounts query: `source.name:"X" AND disabled:true`, count only |
| Who is uncorrelated? | Accounts query: `uncorrelated:true` on the source |
| Which entitlements are directly requestable? | Entitlements query on `requestable:true` and compare with the intended set |
| Did a literal placeholder leak? | An accounts or entitlements query for the placeholder string a rule is supposed to replace |
| Who joined or left last night? | Identities query on created date or lifecycle state, with the attributes you want in the export |

## Symptom lookup

Generalised from the runbooks of one REST integration, one JDBC integration with two instances and one REST integration for a finance system. Each row says what to suspect first, not the only possibility.

### Aggregation and data

| Symptom | Most likely cause | Check |
|---|---|---|
| Aggregation fails right at the start | Token endpoint unreachable, or the client credentials were rotated | Test the token call from the appliance's network |
| Aggregation "succeeds" but accounts carry error text | The error-detection settings in the source were altered, or the application changed its error wording | Compare the error strings with the source configuration |
| Some accounts missing entirely, no error | A page-size ceiling is reached; overflow is dropped | Count accounts against the source; look for a count equal to a page size |
| A whole aggregation row vanished with no error | An unguarded cast in a rule threw on a missing or null field | Read the after-rule for casts; test with null |
| **Every account shows as enabled** | A status comparison in the after-rule stopped matching, or the call that fetches disabled users could not be made | Look for a "no token" or "skipping" log line; test the comparison against a live value |
| Many uncorrelated accounts | Email or login mismatch, including case; no fallback rule | Compare the correlation attribute on both sides, case-sensitively |
| Entitlement counts halved | A truncated aggregation | Run again and compare; check paging |
| Entitlement values changed en masse | Expected when the application re-mints identifiers on edit | Confirm with the owner before assuming a fault |
| An access review shows no admin-level access | An agreed exclusion in the integration | Check the exclusion list |
| A user in the application is not in ISC | A filter restricts the integration to employees | Check the filter |
| A role exists in the application but not in ISC | Nobody holds it and groups are not aggregated | Run a group aggregation |
| Aggregation deleted accounts | The delete threshold let a partial response through | Check the threshold and the response size |
| Catalogue is out of date | Entitlement aggregation has no schedule | Check schedules; run by hand |
| A search or API call for a schema or rule returns nothing | A double space in the name | Copy the exact name from the export |

### Provisioning and requests

| Symptom | Most likely cause | Check |
|---|---|---|
| Account creation fails or hangs with no clear reason | A debug webhook in a before-create rule is enabled and its listener is down | Look for a debug flag set true |
| A literal placeholder (for example `COMPUTED_BY_RULE`) appears in the target | The before-create rule did not run | Check rule attachment |
| Revocation reported success but the target did not change | A parse of the entitlement value failed in the before-rule | Compare the value format with what the rule expects |
| Enable failed with no useful error | A logger or webhook call in a before-enable rule | Read the rule |
| Entitlement add or remove did nothing | The rule logged "empty, skipping" and exited | Look for the skip message |
| Fewer assignments than requested | Malformed entries skipped, or a name contained a delimiter | Check the delimiter |
| A name or email change did not reach the application | There is no update policy or update endpoint | Check the provisioning policies |
| A group is missing from the requestable set | The catalogue is a hard-coded list | Read the query that defines it |
| An operation works on one instance but not the other | The two rules handle different operations | Compare the rule operations |
| Behaviour changed on both instances after one rule edit | The rule is shared | Look at which sources the rule is attached to |
| Delete refused although the feature list says it is supported | The rule refuses it | Read the rule |
| Reading an endpoint body does not match what the application receives | The endpoint body is dead configuration and a rule replaces it | Read the rule, not the endpoint |

### Requests, forms and workflows

| Symptom | Most likely cause | Check |
|---|---|---|
| Several requests in a row from one person all `CANCELLED` | A call exceeded the appliance timeout (63 seconds measured) and wedged that requester for about an hour | Check the earliest failing request for duration |
| An approval never appeared | The approval expired without reminders or a fallback, which looks the same as never arriving | Look at the approval's history |
| A literal `{{` in a payload or message | A template path did not resolve | Check the field name, including casing |
| The manager never received the form | The manager attribute is wrong or the notification went elsewhere | Check the manager attribute and the notification routing |
| Credentials mail went to the wrong person | Routing by role after a manager change | Check the template recipient |
| No Launch button | The launcher is not assigned or its workflow is disabled | Check the assignment and the workflow state |
| A workflow works in the UI but fails after an API edit | The PUT wiped the secrets | Re-create the secrets in the UI |
| A workflow save returns 200, but enabling fails | Validation runs on enable | Fix the named violation; check the step names |
| A form option list is empty | The data-source query does not interpolate form values | Test with a literal |
| Users ask where to request an application | There is no tile | Give them the naming convention to search |

### Cluster and infrastructure

| Symptom | Most likely cause | Check |
|---|---|---|
| Several integrations on the same cluster fail together | The cluster, or a shared service account, is the problem | Check cluster status and the shared login |
| One integration fails while its cluster peers are fine | Its own network path, such as egress or DNS to an external host | Test the route from the appliance |
| A cluster in a warning state | A cluster with a single appliance has no redundancy | Check appliance count |

### Directory and lifecycle

| Symptom | Most likely cause | Check |
|---|---|---|
| Group membership gone after the leaver date | No allow-list or delay in the leaver flow | Review the leaver actions |
| Leaver not disabled on an application | The application is not in the lifecycle action source list | Read the list |
| Account disabled a day early or late | The end date or the time zone is wrong | Check the HR record and the identity's time zone |
| Joiners missing from the directory | A start date outside the processing window, or a missing mandatory field | Check the joiner search export |
| A rehired person has two accounts | The rehire flow did not match the existing identity | Check the join key |

## Making a change safely

1. Read the current configuration with the calls above and save a copy.
2. Change it in sandbox.
3. Test with a single object before many.
4. Check what else uses the thing: a rule attached to two sources, an attribute used by correlation, a form a launcher points at.
5. Deploy, then verify with a search, not by trusting the 200.
6. Update the runbook and the lifecycle source list if you added a source.

## Added from SailPoint's documentation

### Force a re-correlation

Accounts that stay uncorrelated after you fix a correlation rule or the data it matches were probably skipped by an **optimized** aggregation, which does not re-run correlation for unchanged accounts. The UI always runs optimized. Through the API, call the account-load endpoint for the source with `disableOptimization=true`. It applies to that run only, reprocesses every record, and keeps manually correlated accounts. Check the delete threshold first, because an unoptimized run touches everything.

### Pace your scripts

The default allowance is 100 requests per client ID and API version per 10 seconds. A 429 response carries `Retry-After`. Sleep for that many seconds, then retry. Give automation its own API client.

### More symptoms

| Symptom | Most likely cause | Check |
|---|---|---|
| Still uncorrelated after fixing the data or the rule | Optimized aggregation skipped unchanged accounts | Run an unoptimized aggregation through the API |
| Aggregation cancelled with a warning about deletions | The delete threshold stopped a bulk delete | Compare the account count with the source before raising the threshold |
| One entitlement per account in a flat-file source | The delimited file is not sorted by account ID | Sort on the id column |
| Import reports COMPLETE but objects are missing | The object type is not importable and was skipped silently | Compare an export before and after; use `preview=true` |
| A deployed non-employee source behaves like a normal source | Non-employee sources cannot be deployed | Recreate it in the target |
| Schedule fires an hour off after a clock change | Schedules follow the cluster time zone and do not shift for daylight saving | Check the cluster time zone |
| Workflow errors in the first hours after enabling the feature | First enablement can take up to two hours | Wait, then retest |
| Parallel-loop workflow fails on a large input | More than 250 items | Chunk the input or use a serial loop |
| Item reassigned to an unexpected reviewer | The four-hop reassignment limit, or the self-review check | Read the reassignment history |

## Actions

- Save the read-only list and the symptom tables where on-call engineers can find them.
- Teach the team that a 200 on a PUT is not proof, and that the search API is the verification tool.
- Add symptoms from your own incidents, with the check that found the cause.
