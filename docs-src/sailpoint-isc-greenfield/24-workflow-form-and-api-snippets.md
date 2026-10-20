---
title: Workflow, Form and API Snippets
---

Reusable fragments for the parts of an ISC build that are not rules: workflow expressions and step patterns, the search queries that drive cascading forms, and the API calls an engineer reaches for. Names in angle brackets are placeholders. API paths and versions change, so confirm them against the current reference. Nothing here should be run against production before you have run it in sandbox.

## Calling the API

### A token

```bash
TENANT=<tenant>
TOKEN=$(curl -s -X POST "https://$TENANT.api.identitynow.com/oauth/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" | jq -r .access_token)
```

Read the client id and secret from your vault or the environment, never from the script. A token is short-lived, so fetch one per run. If you loop over many objects, pace the calls: the default allowance is 100 requests per client and API version per 10 seconds, and a 429 carries a `Retry-After` header.

```bash
api() {   # api GET /v2025/sources
  local m=$1 p=$2; shift 2
  while :; do
    code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X "$m" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      "https://$TENANT.api.identitynow.com$p" "$@")
    if [ "$code" = "429" ]; then sleep 5; continue; fi
    cat /tmp/resp.json; return $([ "$code" -lt 400 ])
  done
}
```

### Read-only calls you will use every week

```bash
api GET "/v2025/sources?limit=250&offset=0"
api GET "/v2025/sources/<id>"
api GET "/beta/sources/<id>/schedules"
api GET "/v2025/entitlements?filters=source.id eq \"<id>\"&limit=250"
api GET "/v2025/access-profiles?limit=250"
api GET "/beta/source-apps/<id>/access-profiles?limit=250"
api GET "/v2025/workflows"
api GET "/v2025/form-definitions"
```

Always page at 250 or below. The source-app sub-resource returns an empty list if `limit` exceeds 250.

### Search

The search API is the verification and monitoring tool. A request names the index and a query:

```json
POST /v2025/search
{
  "indices": ["accounts"],
  "query": { "query": "source.name:\"<source name>\" AND disabled:true" },
  "sort": ["id"],
  "limit": 250
}
```

Counts only, for a monitor:

```json
POST /v2025/search?count=true
{ "indices": ["accounts"], "query": { "query": "source.name:\"<source name>\" AND uncorrelated:true" }, "limit": 1 }
```

Page through a large result by sorting on a stable field and passing the last value of the previous page as `searchAfter`.

| Question | Index | Query idea |
|---|---|---|
| Disabled accounts on a source | accounts | `source.name:"X" AND disabled:true` |
| Uncorrelated accounts | accounts | `source.name:"X" AND uncorrelated:true` |
| Directly requestable entitlements | entitlements | `requestable:true`, compared with your intended list |
| Who joined or left | identities | a created-date or lifecycle-state query |
| Entitlements for a cascade step | entitlements | see below |

Field names vary by index and release. Check them with a one-row query before you build a monitor on them.

### Force a full re-correlation of one source

An optimized aggregation skips unchanged accounts, so fixed correlation logic is not re-run. The API can disable optimization for one run:

```bash
curl -X POST "https://$TENANT.api.identitynow.com/v3/sources/<id>/load-accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -F "disableOptimization=true"
```

It reprocesses every record, keeps manually correlated accounts, and applies to that run only. Check the delete threshold before you run it.

### Patching a source

Sources are changed with a JSON patch:

```text
PATCH /v3/sources/<id>      Content-Type: application/json-patch+json
```

```json
[
  { "op": "replace", "path": "/connectorAttributes/deleteThresholdPercentage", "value": 10 },
  { "op": "add",     "path": "/connectorAttributes/mergeRows", "value": true }
]
```

Take a copy of the source (`GET /v2025/sources/<id>`) before every patch, and store it. Secrets are not returned, and some updates replace a whole attribute, so check the result by reading it back.

### Export cloud rules and configuration

Cloud rules cannot be read with a GET. Use the configuration export:

```json
POST /beta/sp-config/export
{ "description": "rule export", "includeTypes": ["RULE"], "objectOptions": {} }
```

Then poll the export job and download it. The export needs an administrator and creates a job, not a change. Treat the result as sensitive: rules can contain credentials.

## Workflow expressions

Expressions seen in the program's workflows:

| Expression | Meaning |
|---|---|
| `$.trigger.launchedBy.id` | The person who launched an interactive workflow |
| `$.interactiveForm.formData.<field>` | An answer from the first form. The key is the form **element**, with its exact capitalisation |
| `$.interactiveForm4.formData.<field>` | An answer from a later form in the same workflow (numbered by step) |
| `$.loop.loopInput` | The current item inside a loop |
| `$.loop.context.<step>...` | A value from outside the loop, read from inside it |
| `{{...}}` | A template placeholder. If it cannot be resolved it renders as literal text, so a typo corrupts a payload silently |
| `.JSON()` | The only stringify function. Others render literally |

### Step actions used

| Action | Used for |
|---|---|
| Interactive form | Ask the requester. The answers return inline |
| `sp:access:get` | Find an access item by search. Returns id, name and type, not the value |
| `sp:access:manage` | Grant or revoke an access item for an identity, with comments |
| `sp:http` (version 3) | Call an API, including search, returning the raw response |
| `sp:manage-account` | Enable or disable an existing account |
| `sp:forms` | Raise an approval form and wait for the result |
| Wait | Separate dependent provisioning events |
| Send email | Notify the requester and the requestee |
| Loop | Iterate a multi-select. The parallel loop accepts at most 250 items |

### A cascade, step by step

This is the multi-step form pattern described in the complex applications page.

| # | Step | Configuration |
|---|---|---|
| 1 | Interactive form | Scope, requestee, role selection |
| 2 | Get identities | The requestee from the form, the requester from the trigger |
| 3 | Compare | Branch on the scope value |
| 4 | HTTP search | Search entitlements for the next list (see below) |
| 5 | Interactive form | Populate a dropdown from the search result and let the user choose |
| 6 | Loop over the choices | For each: resolve the role, resolve the entity, grant the role |
| 7 | Wait | One minute between the role and the entity grant |
| 8 | Grant the entity | With comments linking it to the role |
| 9 | Email | Requester and requestee |

### Search queries behind the dropdowns

```text
# the entities for a chosen country
description.exact:"<country>" AND source.name.exact:"<source>" AND attribute.exact:"<entity attribute>"

# the entities for a chosen country and client, where the client is stored as a tag
description.exact:"<country>" AND source.name.exact:"<source>" AND attribute.exact:"<client entity attribute>" AND tags:"<normalised client>"

# one exact access item, by name and source
name.exact:"<role name>" AND source.name.exact:"<source>"
```

Rules for building them:

- Quote string values and keep `.exact` where you need an exact match.
- Store whatever the search must filter on in `description`, `attribute` or `tags`. Entitlement **attributes** are not indexed.
- A list passed into the query renders like `[5 2]` and fails. Build `tags:("A" "B")` as an explicit OR from strings.
- Normalise client names once (remove `&`, `-`, spaces, brackets and full stops) and use the same rule when you create the tags.

### The comment that carries data to a rule

Set it on the grant step, and read it in the provisioning rule:

```text
RoleId:<role>, EntityID:<entity>, Source:<source>
```

```json
{"RequestedGroup":"<group>","RequestedClientName":"<client>","TargetDatabase":"<db>"}
```

Keep one format per source. A grant by any other route carries no comment, and the rule should refuse it with a clear message.

### Calling the account-create API from a workflow

```text
POST /v2025/accounts
```

This runs the connector's create operation and its before rules. It is the way to create an account on demand from a workflow, since there is no create-account action. Link to the identity is by correlation, not in the call.

```json
{
  "attributes": {
    "sourceId": "<source id>",
    "<attribute>": "<value>"
  }
}
```

(Confirm the body for your release.) Use a test identity first.

### Secrets in workflows

- Secrets can only be created in the UI. A literal secret written through the API is dropped silently.
- A full PUT of a workflow wipes a UI-set secret. Read the workflow first and preserve the reference.
- One OAuth reference per workflow: avoid two steps with different credentials in one workflow.
- Never put a client secret in an HTTP body.

## Form logic

| Need | Use |
|---|---|
| Show a field only after another is filled | A condition on the parent element, empty or not-empty |
| Show a section | `SHOW` works on a section, not on an element |
| Text the user must see | The field label. Section labels are not rendered |
| Operators | `EQ`, `CO`, `NOT_CO`, `IN`, `NOT_IN`, `SW`, `EW`, on strings and booleans |
| A second dependent list | A second form, fed by the workflow |
| Retire a form | Never delete it while a launch may still point at it |

## Monitoring queries

Build these as scheduled searches or as scripted checks, one per source:

| Monitor | Query | Alert when |
|---|---|---|
| Population | Count of accounts on the source | Drops sharply, or sits exactly on a page size |
| Disabled count | Accounts with `disabled:true` | Moves by more than a small percentage between runs |
| Uncorrelated | Accounts with `uncorrelated:true` | Grows |
| Freshness | The last aggregation date per source | Older than the schedule plus a margin |
| Entitlement count | Entitlements per source | Halves between runs |
| Failed workflow executions | The workflow executions API, by status | The rate rises |

## Actions

- Keep a small script library for the token, paging, backoff and the read-only calls, and have everyone use it.
- Save the configuration before every patch.
- Keep the cascade queries and the normalisation rule in the integration notes.
- Test the comment format with the grant routes you do not expect, so you know how the rule fails.
- Treat every exported rule or workflow as sensitive.
