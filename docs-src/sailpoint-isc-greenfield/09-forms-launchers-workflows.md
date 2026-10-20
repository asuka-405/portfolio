---
title: "Forms, Launchers and Workflows: Limits and Workarounds"
---

Forms, launchers and workflows are how you build anything the standard Request Center cannot do: composite requests, manager questionnaires, lifecycle emails, HR writeback. They are also where the platform's sharpest edges are. Most of what follows was measured in a sandbox tenant while building form-driven flows, and it applies to any flow you build. Re-test before relying on a limit, because the engine changes.

## How the pieces fit

A form on its own is **not reachable by anyone**. The working chain is:

1. A **launcher** (type interactive process) appears in the user's launchpad.
2. It starts a **workflow** whose trigger is "interactive process launched", filtered on that workflow's own ID.
3. The workflow's first step is an **interactive form**.
4. The form's answers come back inline as `$.interactiveForm.formData`.
5. Later steps act: look up identities, call APIs, raise approvals, manage access, send mail.

Launcher visibility: creating a launcher auto-creates an entitlement on the internal ISC source (attribute `assignedLaunchers`), non-requestable. Make it requestable and grant it (or grant it through a role) before anyone sees a Launch button. The button enables only when the launcher is **assigned and its workflow is enabled**. Launchers cannot be patched (405); the `owner` on create is overridden by the API client.

> A `usedBy: MySailPoint` marker on a form is only a usage marker. Writing it launches nothing.

```html
<!-- dgm:form-launcher-chain -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 250" role="img" aria-labelledby="form-launcher-chain-t form-launcher-chain-d" xmlns="http://www.w3.org/2000/svg"><title id="form-launcher-chain-t">From launcher to action</title><desc id="form-launcher-chain-d">A form is reachable only through a launcher that starts a workflow whose first step is the form.</desc><defs><marker id="form-launcher-chain-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box accent" x="6" y="40" width="140" height="96" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="76.0" y="72.0" text-anchor="middle">Launcher</text><text class="s" x="76.0" y="87.0" text-anchor="middle">needs the assigned</text><text class="s" x="76.0" y="100.0" text-anchor="middle">launcher</text><text class="s" x="76.0" y="113.0" text-anchor="middle">entitlement</text><rect class="box violet" x="174" y="40" width="140" height="96" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="244.0" y="65.5" text-anchor="middle">Workflow trigger</text><text class="s" x="244.0" y="80.5" text-anchor="middle">interactive process</text><text class="s" x="244.0" y="93.5" text-anchor="middle">launched, filtered</text><text class="s" x="244.0" y="106.5" text-anchor="middle">on the workflow&#x27;s</text><text class="s" x="244.0" y="119.5" text-anchor="middle">own ID</text><rect class="box blue" x="342" y="40" width="140" height="96" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="412.0" y="78.5" text-anchor="middle">Interactive form</text><text class="s" x="412.0" y="93.5" text-anchor="middle">first step of the</text><text class="s" x="412.0" y="106.5" text-anchor="middle">workflow</text><rect class="box teal" x="510" y="40" width="140" height="96" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="580.0" y="78.5" text-anchor="middle">Form data</text><text class="s" x="580.0" y="93.5" text-anchor="middle">returned inline to</text><text class="s" x="580.0" y="106.5" text-anchor="middle">the workflow</text><rect class="box gold" x="678" y="40" width="140" height="96" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="748.0" y="72.0" text-anchor="middle">Actions</text><text class="s" x="748.0" y="87.0" text-anchor="middle">search, approve,</text><text class="s" x="748.0" y="100.0" text-anchor="middle">grant access, call</text><text class="s" x="748.0" y="113.0" text-anchor="middle">an API, send mail</text><path class="ln   " d="M146,88.0 L174,88.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#form-launcher-chain-ar)"/><path class="ln   " d="M314,88.0 L342,88.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#form-launcher-chain-ar)"/><path class="ln   " d="M482,88.0 L510,88.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#form-launcher-chain-ar)"/><path class="ln   " d="M650,88.0 L678,88.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#form-launcher-chain-ar)"/><text class="h" x="6" y="20" text-anchor="start">WHAT MUST BE TRUE</text><rect class="box ghost" x="6" y="170" width="392" height="62" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="202.0" y="191.5" text-anchor="middle">The launch button appears only when</text><text class="s" x="202.0" y="206.5" text-anchor="middle">the launcher is assigned to the user and its workflow is</text><text class="s" x="202.0" y="219.5" text-anchor="middle">enabled</text><rect class="box ghost" x="424" y="170" width="390" height="62" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="619.0" y="191.5" text-anchor="middle">A form on its own is not reachable</text><text class="s" x="619.0" y="206.5" text-anchor="middle">retire a form, never delete it while a launch may still</text><text class="s" x="619.0" y="219.5" text-anchor="middle">point at it</text></svg></div><figcaption><b>The working chain.</b> Creating a launcher auto-creates a non-requestable entitlement; grant it directly or through a role before anyone sees the button.</figcaption></figure>
```

## Forms: what works and what does not

### Dependent dropdowns cannot cascade

A search data source on a form cannot filter one dropdown by another dropdown's selection. Two independent reasons:

- Entitlement **attributes are not indexed**. The search index returns null for them; only name, value, attribute, schema and source are queryable. A flag stored as an entitlement attribute (for example a Read or Write marker) cannot drive a filter.
- Values containing hyphens tokenise, so wildcard prefix queries on them do not work.

Also: data-source queries **do not interpolate** form values. Six reference syntaxes against four body shapes returned zero options while a literal returned one.

Workarounds that worked:

| Workaround | How |
|---|---|
| Put the context in the display name | `Asia · Client · A&T`, or `(Read Only)` and `(Write)` suffixes on profile names |
| Put the context in entitlement tags | Query tags with a Lucene OR such as `tags:("A" "B")` |
| **Multi-step interactive forms** | The solution that delivered true cascading: the first form collects a value, the workflow calls the Search API with that value, builds the option list, and presents it in the *next* form. Repeat for each dependent level. A group, then role, then client selection on one SQL application used this |
| Progressive disclosure | Hide a child field until the parent is chosen (using empty or not-empty conditions), without filtering its options |
| Hard-code a short list | If only two groups are ever requestable, say so in the query and accept that adding one is a query edit |

Multi-step forms are slower and heavier on the workflow tier limit but they are the only robust way to cascade.

### Conditions and effects

- A condition or effect whose rule reads a form **input** did nothing (show, hide, default value, require). Rules on form **elements** work. Rebuilding with 26 inputs instead of 130 changed nothing, so it is not a size limit. One approval form fed by a workflow form step did honour input-sourced conditions, so verify in a browser before relying on it for a new field.
- `SHOW` works on a **section**, not an element, so invert show rules into hides.
- Section labels are not rendered by the launcher. Put anything the user must see in a field **label**.
- Operators `EQ`, `CO`, `NOT_CO`, `IN`, `NOT_IN`, `SW`, `EW` accept string or boolean only. A string list works only with empty and not-empty. `NOT_EQ`, `GT`, `LT`, `INCLUDES`, `ANY`, `ALL` are rejected.
- A string rule reading a multi-select is rejected at submit (`must be a string`).
- There is **no native repeatable group**. Use fixed blocks revealed by conditions, or loop over a multi-select in the workflow.
- Conditions address elements by **numeric element ID**, not key. Preserve the IDs when editing a form or the prefill and lock silently stop working.
- A casing trap: the form *input* may be `userSailpointId` and the *element* `userSailPointId`. Submitted data is keyed by **element**. Anything downstream must read the element's casing.

### Reading what someone submitted

Launcher-driven forms leave `formData: {}` in the execution history. The answers live only on the form **instance**, and only the instance **list** returns `formData`; a GET by ID does not. Use the list when you need to see what a user entered.

### Do not delete a form a launch may still point at

Retire it. A launch in flight that holds a deleted form definition fails with HTTP 404 at submit time, and the submission cannot be recovered. This was learned by breaking a colleague's open request.

## Workflows: engine limits and behaviour

### Secrets and credentials

- **Literal secrets written through the API are silently dropped.** Writing an OAuth client secret as a plain value stores empty and the runtime receives an empty string. Read-back of an empty string looks identical to masking, so you only find out by executing.
- The secret reference convention is produced **only by the UI**. There is no secrets API. Any workflow that needs credentials has a mandatory human step.
- A full-object PUT **wipes a UI-set secret** unless you read back and preserve the reference. This is the easiest way to break a working workflow through the API: edit it, lose both secrets, and the HTTP steps fail authentication.
- ISC pins **one OAuth parameter reference per workflow**. A new step strips the reference; an update overwrites all references with one shared value; a shared reference fails with `failed to retrieve Parameters for authentication type 'oauth'`. If a workflow has two HTTP steps with different credentials, it is fragile.
- Our HR writeback workflows put the client secret and grant in plaintext in the HTTP body. Do not copy that. Create the secret in the UI and reference it.

### Templating and data

| Behaviour | Consequence |
|---|---|
| An unresolvable template path renders as literal `{{...}}` text | Never an error, never empty. A truncated field name corrupted a payload silently |
| `.JSON()` is the only stringify function | `.String()`, `.Quote()`, `.ToString()`, `.JSONEscape()` render literally |
| A list renders like `[5 2]` | `tags:([236 201])` is an HTTP 400 Lucene error. `tags:("A" "B")` works as OR |
| Define Variable and Update Variable allow at most 50 operations per variable (documented) | Plan grouping |
| `sp:access:get` returns `{id, name, type}` only, no value | Use an HTTP search step when you need the value |
| `sp:http` **v3** returns the raw API response including value | v2 hung forever |
| There is no "create account" action | `sp:manage-account` only touches existing accounts. Creation goes through `POST /accounts`, which runs the connector's create operation and its before-rules. Linkage to an identity is by correlation only |

### Loops

- Inside a loop the current item is `$.loop.loopInput`; things outside the loop are `$.loop.context...`; a sibling step *inside* the loop sits at the root.
- A loop over an empty or absent input completes cleanly with zero iterations, so no guard step is needed.
- Inner loop steps **do not appear in the parent execution history**. An approval step inside a loop cannot be debugged from the parent execution.

### Limits and validation

- **Tier limits count loop bodies, not top-level steps.** A workflow with 36 steps across 24 loops enabled; one with 49 steps across 35 loops was rejected with `Tier Limit Violation: Your workflow must have 50 or fewer steps after the trigger`.
- **Validation runs on enable, not on save.** A PUT returns 200 with invalid content; the error appears when you enable. Step display names must be under 65 characters.
- **You cannot PUT an enabled workflow.** Disable it, PUT, enable it again.
- `sp:generic-approval` was **not licensed**. It saved and then failed on enable. Approval had to be form-based: an `sp:forms` step blocks and returns the form data inline.
- `sp:interactive-form` does not reliably raise `sp:form-submitted`. Do not build a second workflow on that event for a request form. Trigger the execution workflow on the **approval** form instead.

### Triggers

| Trigger | Notes |
|---|---|
| Identity attributes changed | Filter by attribute name and new value with JSONPath. Fires per change |
| Post-provisioning | Filter on committed result, target source and operation |
| Form submitted | Filter by form definition ID; keep the ID in sync if you recreate the form |
| Schedule | Has its own time zone |
| External HTTP | Used for welcome emails; authenticates with a client ID |

Useful property: workflow **executions are kept**, and the dump of 250 executions per workflow gave a quick health read (completed, failed, canceled, executing).

### Operational traps found the hard way

- A **63-second VA timeout wedges the requester** for about an hour. Every later request from the same identity returns `CANCELLED`. It affects only that person and looks exactly like a rule fault. **Two submissions in a row by one requester will show the second as cancelled.**
- A workflow with a Wait step leaves executions in `Executing` for as long as it waits. A large count is normal; a growing count of `Canceled` needs explaining.
- The same workflow in sandbox and production must have different recipients. Mail steps with hard-coded addresses are the commonest promotion defect.
- **Email recipients:** fix them to identities from the flow, not one named person. Our request workflow sent approvals and rejections to one fixed address, so the requester and the beneficiary were never told.

## Design patterns that worked

### A launcher flow with per-item approval

For a request that names several clients: a loop over the multi-select raises **one approval form instance per client** (with a deadline), and each submission fires an execution workflow separately. Properties to document for users:

- There is **no bundling**. Three approvals and one rejection yields three grants.
- A deadline that expires is **silent**. "Never appeared" and "expired" look the same to the requester.
- The group dropdown was a hard-coded query for two names. Adding a third is a query edit.
- Form visibility came from a criteria role, so the tile appears and disappears on identity refresh with no record explaining why.

### Event plus sweep

Pair every event-triggered workflow that must not miss work with a scheduled sweep (HR writeback, GreytHR disable, leaver off-boarding). Events are lost; a sweep repairs them.

### Execution workflow triggered by an approval form

Because `sp:interactive-form` is unreliable for raising a submitted event, split the work: the request workflow collects and raises approval forms; a second workflow triggers on the **approval** form's submission and does the provisioning. Keep the execution workflow and the provisioning rule as one unit (they share the comments-channel contract; see the connector deep dive).

### Dead steps and duplicate searches

A review of one production workflow found: two near-identical search steps (one matching an analysed field, one an exact field) feeding different values, so the database name and the entitlement ID could come from different entitlements; a variable step nobody read; and a replace pattern with a truncated field name. Use the **exact** match, delete the other, and review the workflow end to end after every edit.

## Workflow health: what to monitor

- Failed execution count and rate, per workflow, per week.
- Executions stuck in `Executing` past the expected wait.
- Enabled flag on every workflow that should be enabled (the tenant had 28, 21 enabled, with several test and copy workflows).
- Test and copy workflows should be **deleted**, not left disabled. Ours included copies of the joiner flows, a manually triggered joiner and leaver, and two test workflows.

## What SailPoint's documentation adds

Checked against the [workflows documentation](https://documentation.sailpoint.com/saas/help/workflows/index.html), the [operators page](https://documentation.sailpoint.com/saas/help/workflows/workflow-operators.html) and the community announcement of serial loops, October 2026.

| Topic | Documented position |
|---|---|
| Volume | Up to 400,000 executions per day run at full speed. Beyond that they still run, at about 5 per second. The quota resets every 24 hours |
| First use | After workflows are first enabled in a tenant, allow **up to two hours** before the feature is fully working. Errors during that time are expected |
| Structure | Exactly one trigger per workflow and at least one action |
| Permissions | Org Admin configures workflows. Two read-only roles exist: one cannot see execution history, the other can |
| Parallel loop | Input array of at most **250 items.** More fails the workflow |
| Serial loop | A newer operator with input of at most **1,000 items.** An iteration that fails stops the loop. A Break Loop operator exists. In test mode the loop is limited to 50 iterations |
| Define Variable | At most 50 operations per variable |
| Add Time | The result cannot be more than a year from the original date |

Notes for the design:

- **The 50-step tier limit we hit is plan-dependent.** Community posts quote different step allowances by licence level, so read the limit off your own tenant error rather than from this guide, and re-check after a plan change.
- **Older community threads describe loop limits of 100 items.** That predates the current operators. Check the date on any limit you find.
- A serial loop is the right choice when order matters, when one failure should stop the rest, or when you need more than 250 items. A parallel loop completes every iteration and lists successes and failures separately, which suits independent items. Our observation that inner loop steps do not appear in the parent execution history was measured on the parallel loop; check whether serial loops differ.
- There is no documented per-execution timeout or workflow-level retry. Community designs build retries by hand with a counter in a serial loop.

## Actions

- Design the request experience around the cascade limit before you build forms.
- Create workflow secrets in the UI, by a named person, and document where.
- Count loop steps against the tier limit during design.
- Keep an inventory of workflows, forms, launchers and the IDs that tie them together.
- Retire, never delete, forms with launches in flight.
