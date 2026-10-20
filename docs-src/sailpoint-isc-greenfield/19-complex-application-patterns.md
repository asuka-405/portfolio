---
title: "Complex Applications: Cascading Entitlements and Form-to-Rule Data"
---

Most applications on the program were simple: a group, a person, a grant. A handful were not, and they consumed a disproportionate share of design, build and hypercare effort. This page collects the hard cases, the pattern that finally worked for each, and the traps that came with it. The applications are described by shape (the guide does not name internal systems), and we label them **H**, **K**, **C** and **P** so the cases can be referred to.

| Label | Shape | What made it hard |
|---|---|---|
| H | A SQL Server application. Access is a **role plus a scope** (global, local office or client entity), stored as one row per role and entity | A grant is two dependent values, and ISC grants one entitlement at a time |
| K | A REST application. Access is a **list of composite access rows** (service line, asset manager, client, region, country, entity, role) | No atomic "add one access" call, a cascade of five dependent fields, and entitlements that carry hidden identifiers |
| C | A SQL Server application with **one database per client** | Users and groups live in many databases, so one source cannot aggregate them |
| P | A payroll or HR product with a REST API and **no group concept** (two different products fall under this label) | Nothing to request, but revocation still has to do something, or an extra fact must be fetched before a write |

## Why these cases are hard

Four platform facts combine to make them hard:

1. **An entitlement is one value on one attribute.** A grant that needs a role and an entity is two entitlements, and nothing in the product says they belong together.
2. **A provisioning plan carries attribute requests, not the form.** By the time a connector rule runs, the answers the requester typed are not in the plan unless you carry them there.
3. **Forms cannot cascade through a search over entitlement attributes.** Entitlement attributes are not indexed, and data-source queries do not interpolate other fields (see the forms page).
4. **Rules run on the appliance, one operation at a time.** A rule sees one account request, with no memory of the one before it.

Every pattern below is a way of working around one or more of these.

## Pattern 1: dependent entitlements (role plus scope)

### The shape

Application H stores access as a row of *user, role, entity*. There are three scopes: **global** (a fixed entity), **local office** (an entity from an office table) and **client entity** (an entity from a client table). The same role means different things at each scope, so a grant is meaningless without both parts.

### How it was modelled

| Element | Choice |
|---|---|
| Role | An entitlement on one attribute |
| Entity | An entitlement on a second attribute per scope (one for local office, one for client entity) |
| Removal | A third, composite attribute whose value is a pipe-delimited string carrying scope, entity and role |
| Link between the two grants | Request **comments** holding the role and the entity, read by the provisioning rule |
| Order | The workflow grants the role, waits one minute, then grants the entity |

The composite removal value is a contract. It looked like this (the format is illustrative):

```text
GLOBAL ROLE | <role> | <extra>                      (three parts)
<scope> | <entity> | <role> | <extra>               (four parts)
```

The rule split on the delimiter and trusted the part count. A value with the wrong number of parts made the helper return the literal text `Invalid format` to its caller, a string and not an error. That is the failure mode of every name-encoded contract: **a malformed value is not rejected, it is returned as if it were data.** Make such helpers throw.

### The grant sequence

```text
Request form (scope, requestee, role[s])
   -> branch on scope
        Global:        for each role: grant role
        Local office:  for each role: grant role, wait 1 min, grant office entity
        Client entity: for each role: grant role, wait 1 min, grant client entity
   -> notify requester and requestee
```

Notes on the sequence:

- **The one-minute wait** separates two provisioning events on the same account. The reason is our reading rather than something we measured: without it the second event can arrive while the first is still running on the same row. Treat the wait as a pragmatic concurrency guard and re-test it on your tenant.
- **Multiple roles multiply the loops.** A role list with an entity list becomes a loop within a loop, and every loop body counts against the workflow's step limit. The design worked for a handful of selections and needed splitting beyond that.
- **The rule must prevent duplicates.** The same role and entity can be granted twice by a retry or a second request, so the rule checks for an existing row before inserting.
- **Special roles may trigger side effects.** In application H, three role identifiers also created report assignments. Document side effects in the integration notes, because they are invisible in ISC.

```html
<!-- dgm:role-entity-sequence -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 330" role="img" aria-labelledby="role-entity-sequence-t role-entity-sequence-d" xmlns="http://www.w3.org/2000/svg"><title id="role-entity-sequence-t">Granting a role and its entity</title><desc id="role-entity-sequence-d">The workflow branches on scope, grants the role, waits a minute and grants the entity; the rule pairs them through the request comments.</desc><defs><marker id="role-entity-sequence-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="role-entity-sequence-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="role-entity-sequence-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="role-entity-sequence-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box blue" x="6" y="120" width="140" height="70" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="76.0" y="145.5" text-anchor="middle">Request form</text><text class="s" x="76.0" y="160.5" text-anchor="middle">requestee, scope,</text><text class="s" x="76.0" y="173.5" text-anchor="middle">roles</text><polygon class="box gold" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1" points="222,120.0 272.0,155 222,190.0 172.0,155"/><text class="s" style="fill:var(--ink);font-weight:700" x="222" y="158.5" text-anchor="middle">Scope?</text><path class="ln   " d="M146,155.0 L172,155" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar)"/><text class="h" x="300" y="34" text-anchor="start">GLOBAL</text><rect class="box teal" x="300" y="42" width="108" height="48" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="354.0" y="56.5" text-anchor="middle">Grant role</text><text class="s" x="354.0" y="71.5" text-anchor="middle">each selected</text><text class="s" x="354.0" y="84.5" text-anchor="middle">role</text><text class="h" x="300" y="124" text-anchor="start">LOCAL OFFICE</text><rect class="box teal" x="300" y="132" width="108" height="48" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="354.0" y="159.5" text-anchor="middle">Grant role</text><rect class="box " x="426" y="132" width="108" height="48" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="480.0" y="152.0" text-anchor="middle">Wait 1</text><text class="t" x="480.0" y="167.0" text-anchor="middle">minute</text><path class="ln teal  " d="M408,156 L426,156" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-teal)"/><rect class="box teal" x="552" y="132" width="108" height="48" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="606.0" y="152.0" text-anchor="middle">Grant office</text><text class="t" x="606.0" y="167.0" text-anchor="middle">entity</text><path class="ln teal  " d="M534,156 L552,156" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-teal)"/><text class="h" x="300" y="214" text-anchor="start">CLIENT ENTITY</text><rect class="box teal" x="300" y="222" width="108" height="48" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="354.0" y="249.5" text-anchor="middle">Grant role</text><rect class="box " x="426" y="222" width="108" height="48" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="480.0" y="242.0" text-anchor="middle">Wait 1</text><text class="t" x="480.0" y="257.0" text-anchor="middle">minute</text><path class="ln teal  " d="M408,246 L426,246" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-teal)"/><rect class="box teal" x="552" y="222" width="108" height="48" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="606.0" y="242.0" text-anchor="middle">Grant client</text><text class="t" x="606.0" y="257.0" text-anchor="middle">entity</text><path class="ln teal  " d="M534,246 L552,246" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-teal)"/><path class="ln accent  " d="M222,120 L222,54 L300,54" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-accent)"/><text class="l" x="262" y="48" text-anchor="middle">global</text><path class="ln accent  " d="M272,155 L286,155 L286,144 L300,144" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-accent)"/><text class="l" x="268" y="138" text-anchor="end">local</text><path class="ln accent  " d="M222,190 L222,240 L300,240" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-accent)"/><text class="l" x="262" y="234" text-anchor="middle">client</text><rect class="box gold" x="690" y="100" width="124" height="130" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="752.0" y="128.5" text-anchor="middle">Provisioning</text><text class="t" x="752.0" y="143.5" text-anchor="middle">rule</text><text class="s" x="752.0" y="158.5" text-anchor="middle">reads role and</text><text class="s" x="752.0" y="171.5" text-anchor="middle">entity from the</text><text class="s" x="752.0" y="184.5" text-anchor="middle">comments, checks</text><text class="s" x="752.0" y="197.5" text-anchor="middle">for a duplicate,</text><text class="s" x="752.0" y="210.5" text-anchor="middle">inserts one row</text><path class="ln gold  " d="M426,54 L700,54 L700,100" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-gold)"/><path class="ln gold  " d="M678,144 L690,144" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-gold)"/><path class="ln gold  " d="M678,240 L700,240 L700,230" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#role-entity-sequence-ar-gold)"/><text class="l" x="410" y="318" text-anchor="middle">A default branch must fail, never fall through to the broadest scope.</text></svg></div><figcaption><b>Dependent entitlements.</b> Role and entity are separate grants. The one-minute wait separates two provisioning events on the same account.</figcaption></figure>
```

### The bug that taught the lesson

In sandbox testing, **a global-scope grant was added even when the requester asked for a client-entity role.** The program recorded the symptom and a before and after test of the fix, not the root cause, so treat the following as the lesson we drew rather than a diagnosis: the rule decides scope from request text, and any gap in that decision must not default to the broadest scope. Rules:

- Never let the **default branch of a scope decision grant access.** Make it throw.
- Test each scope as its own case, with a negative check that no other scope's row was written.
- Keep the scope inside the data (`Scope:Global`) rather than inferring it.

## Pattern 2: cascading dropdowns that cascade

A request form that offers *scope, then client, then country, then entity* needs each list to depend on the previous choice. A single form cannot do this. The pattern that worked uses **several forms and a workflow, with the search API in between**:

```text
Form 1: choose scope and requestee
   -> workflow: search for valid parents using the chosen value
Form 2: choose from the filtered list (country)
   -> workflow: search for children using the chosen value
Form 3: choose from the next filtered list (entity), single or multiple
   -> workflow: grant
```

```html
<!-- dgm:form-cascade -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 340" role="img" aria-labelledby="form-cascade-t form-cascade-d" xmlns="http://www.w3.org/2000/svg"><title id="form-cascade-t">Cascading selection with several forms</title><desc id="form-cascade-d">Each form feeds a search; the search result fills the next form&#x27;s dropdown.</desc><defs><marker id="form-cascade-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box blue" x="6" y="20" width="140" height="78" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="76.0" y="56.0" text-anchor="middle">Form 1</text><text class="s" x="76.0" y="71.0" text-anchor="middle">scope and requestee</text><rect class="box violet" x="174" y="20" width="140" height="78" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="244.0" y="49.5" text-anchor="middle">Search</text><text class="s" x="244.0" y="64.5" text-anchor="middle">parents of the</text><text class="s" x="244.0" y="77.5" text-anchor="middle">chosen scope</text><rect class="box blue" x="342" y="20" width="140" height="78" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="412.0" y="49.5" text-anchor="middle">Form 2</text><text class="s" x="412.0" y="64.5" text-anchor="middle">country, from the</text><text class="s" x="412.0" y="77.5" text-anchor="middle">result</text><rect class="box violet" x="510" y="20" width="140" height="78" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="580.0" y="49.5" text-anchor="middle">Search</text><text class="s" x="580.0" y="64.5" text-anchor="middle">children of country</text><text class="s" x="580.0" y="77.5" text-anchor="middle">and client</text><rect class="box blue" x="678" y="20" width="140" height="78" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="748.0" y="49.5" text-anchor="middle">Form 3</text><text class="s" x="748.0" y="64.5" text-anchor="middle">entity, single or</text><text class="s" x="748.0" y="77.5" text-anchor="middle">multiple</text><path class="ln accent  " d="M146,59.0 L174,59.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-cascade-ar-accent)"/><path class="ln accent  " d="M314,59.0 L342,59.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-cascade-ar-accent)"/><path class="ln accent  " d="M482,59.0 L510,59.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-cascade-ar-accent)"/><path class="ln accent  " d="M650,59.0 L678,59.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-cascade-ar-accent)"/><path class="box " style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1" d="M150,157 a260.0,7 0 0 1 520,0 v86 a260.0,7 0 0 1 -520,0 z"/><path class="box " d="M150,157 a260.0,7 0 0 0 520,0" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1;fill:none"/><text class="t" x="410.0" y="171" text-anchor="middle">Search index</text><text class="m" x="410" y="204" text-anchor="middle">description = the country an entity belongs to</text><text class="m" x="410" y="218" text-anchor="middle">attribute = the kind of entitlement</text><text class="m" x="410" y="232" text-anchor="middle">tags = the normalised client name</text><path class="ln accent dash " d="M244.0,98 L300,150" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#form-cascade-ar-accent)"/><path class="ln accent dash " d="M580.0,98 L520,150" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#form-cascade-ar-accent)"/><rect class="box ghost" x="6" y="276" width="392" height="52" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="202.0" y="299.0" text-anchor="middle">Why not one form?</text><text class="s" x="202.0" y="314.0" text-anchor="middle">search data sources cannot filter one dropdown by another</text><rect class="box ghost" x="424" y="276" width="390" height="52" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="619.0" y="292.5" text-anchor="middle">Why those three fields?</text><text class="s" x="619.0" y="307.5" text-anchor="middle">entitlement attributes are not indexed, so the parent lives</text><text class="s" x="619.0" y="320.5" text-anchor="middle">in a searchable field</text></svg></div><figcaption><b>Multi-step forms.</b> The only robust cascade on the platform: the workflow calls the search API between forms and builds each option list.</figcaption></figure>
```

### Making entitlements searchable by parent

Because entitlement **attributes are not indexed**, the parent must be stored in a field that is. The program used three:

| Field | What it carried | Why it works |
|---|---|---|
| `description` | The country an entity belongs to | Searchable and shown to users |
| `attribute` | Which kind of entitlement it is (local office entity, client entity, global client) | Distinguishes the sets without parsing names |
| `tags` | A normalised client name | Searchable, and independent of how the name is written |

A search for the entities of a chosen country and client then looks like this (placeholders in angle brackets):

```text
description.exact:"<selected country>"
AND source.name.exact:"<source name>"
AND attribute.exact:"<client entity attribute>"
AND tags:"<normalised client>"
```

### Normalising a value for a tag

Client names contain characters that break a query or a tag (`&`, `-`, spaces, brackets, full stops). The workflow strips them into a variable and uses the result as the tag:

```text
Selected:    ACME & Partners (India).
Normalised:  ACMEPartnersIndia
```

Do this **once, in one place**, and apply the same rule when you create the tags. We found the normalisation repeated in two workflow branches with different capitalisation of the form field names, which is the kind of drift that makes one branch return nothing. Keep the tags and the workflow in step, and add a test that selects each client in each branch.

### What to know before you build it

- **Every form and every loop counts.** A four-level cascade with multi-select at two levels is a large workflow. Check it against the tier limit early.
- **An empty search result blocks a required field.** If the entitlements have not been aggregated yet, the form cannot be submitted. Aggregate before the form goes live.
- **The Lucene list rendering trap applies.** Build the query from strings, not from a list value.
- **Cap the list sizes.** A parallel loop accepts at most 250 items.

## Pattern 3: getting data from the form into the rule

This is the question that came up on every complex application: the requester chose something on a form, and the connector rule needs it. The options, in the order we would try them:

| Option | How | Strengths | Weaknesses |
|---|---|---|---|
| **A. Request comments** | The workflow writes the selections as text or JSON into the comments of the access request. The rule reads them from the attribute request and clears them | Works inside the standard provisioning plan. No extra infrastructure | Only works when the request came through your workflow. Any other route (role, certification, API grant) arrives with no comments |
| **B. Encode it in the entitlement name** | The value the user picks already carries the data, and the rule parses it | Survives every grant route, including certification remediation | The format is a contract. Renaming breaks every grant |
| **C. Write it to a staging table** | The workflow writes a row (request id, user, selections) through a small API or database step, and the rule looks it up | Large or structured payloads, an audit trail | A second system to build and keep consistent |
| **D. Call the target directly from the workflow** | A web-services source operation is invoked by the workflow with the form data as the body | The rule is trivial or absent | Bypasses the plan, so ISC's view of the account lags until the next aggregation |
| **E. Fetch it live in the rule** | The rule asks the target for the missing fact (a start date, a current access list) before building the request | Always current | Adds a network call to every operation and a failure mode to each |

Our practice: **use A for a request-only grant, B for a value that must survive every route, E for facts the target already knows, and C when the payload is bigger than a comment.**

```html
<!-- dgm:form-to-rule -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 340" role="img" aria-labelledby="form-to-rule-t form-to-rule-d" xmlns="http://www.w3.org/2000/svg"><title id="form-to-rule-t">Five ways to get form data into a rule</title><desc id="form-to-rule-d">Comments, entitlement name, staging table, direct call from the workflow, and a live lookup inside the rule.</desc><defs><marker id="form-to-rule-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="form-to-rule-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box blue" x="6" y="130" width="130" height="80" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="71.0" y="153.0" text-anchor="middle">Form and</text><text class="t" x="71.0" y="168.0" text-anchor="middle">workflow</text><text class="s" x="71.0" y="183.0" text-anchor="middle">the requester&#x27;s</text><text class="s" x="71.0" y="196.0" text-anchor="middle">choices</text><rect class="box teal" x="250" y="10" width="250" height="52" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="375.0" y="33.0" text-anchor="middle">Request comments</text><text class="s" x="375.0" y="48.0" text-anchor="middle">text or JSON on the access request</text><path class="ln accent  " d="M136,170.0 L190,170 L190,36 L250,36" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><rect class="box teal" x="250" y="74" width="250" height="52" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="375.0" y="97.0" text-anchor="middle">Entitlement name</text><text class="s" x="375.0" y="112.0" text-anchor="middle">the value carries the data</text><path class="ln accent  " d="M136,170.0 L190,170 L190,100 L250,100" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><rect class="box " x="250" y="138" width="250" height="52" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="375.0" y="161.0" text-anchor="middle">Staging table</text><text class="s" x="375.0" y="176.0" text-anchor="middle">request id with the selections</text><path class="ln accent  " d="M136,170.0 L190,170 L190,164 L250,164" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><rect class="box gold" x="250" y="202" width="250" height="52" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="375.0" y="225.0" text-anchor="middle">Direct call</text><text class="s" x="375.0" y="240.0" text-anchor="middle">workflow calls the target API</text><path class="ln accent  " d="M136,170.0 L190,170 L190,228 L250,228" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><rect class="box violet" x="250" y="266" width="250" height="52" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="375.0" y="289.0" text-anchor="middle">Live lookup in the rule</text><text class="s" x="375.0" y="304.0" text-anchor="middle">ask the target for the missing fact</text><path class="ln accent  " d="M136,170.0 L190,170 L190,292 L250,292" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><rect class="box accent" x="620" y="100" width="190" height="80" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="715.0" y="137.0" text-anchor="middle">Provisioning rule</text><text class="s" x="715.0" y="152.0" text-anchor="middle">parses, checks, and writes</text><path class="ln accent  " d="M500,36.0 L560,36 L560,140 L620,140" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><path class="ln accent  " d="M500,100.0 L560,100 L560,140 L620,140" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><path class="ln accent  " d="M500,164.0 L560,164 L560,140 L620,140" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><path class="ln accent  " d="M500,292.0 L560,292 L560,140 L620,140" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><rect class="box " x="620" y="220" width="190" height="60" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="715.0" y="253.5" text-anchor="middle">Target system</text><path class="ln accent  " d="M715,180 L715,220" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-accent)"/><path class="ln gold  " d="M500,228.0 L560,228 L560,250 L620,250" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#form-to-rule-ar-gold)"/></svg></div><figcaption><b>Choosing a channel.</b> Comments only exist for requests that came through your workflow; an entitlement name survives every route; a direct call skips the plan, so ISC's view lags until the next aggregation.</figcaption></figure>
```

### Option A in detail

The workflow's access-management step grants the access item and attaches the comment. For a role plus entity it holds something like this (format is yours to choose, keep it parseable):

```text
RoleId:<role name>, EntityID:<entity name>, Source:<source name>
```

Or, when several values travel together, JSON:

```json
{"RequestedGroup":"<group>","RequestedClientName":"<client>","dataBaseToBeProvisioned":"<db>"}
```

The rule reads, parses and **clears** the comment so it is not applied twice, and **fails loudly** when it is missing:

```java
AttributeRequest attrReq = accountRequest.getAttributeRequest("<attribute>");
String comments = (attrReq == null) ? null : attrReq.getComments();
if (comments == null || comments.trim().isEmpty()) {
    throw new RuntimeException("Request does not carry the required metadata");
}
Map meta = JsonUtil.toMap(comments);          // or split a key:value string
attrReq.setComments(null);                     // consume it
if (meta == null) throw new RuntimeException("METADATA IS NULL");
```

Four things to remember about the comment channel:

1. **It is request-scoped.** Certification remediation, an access profile grant or an API grant of the same entitlement carries no comment, so the rule throws and the operation fails. Decide whether that is acceptable and document it.
2. **Comments are text.** Escape quotes in names, and keep to one format across all rules in a source.
3. **The symptom of a missing comment** is a failed provisioning with `METADATA IS NULL` or similar. Put that string in your runbook.
4. **Parsing a key:value string** is fragile if a value contains a comma. JSON is safer.

### Option E in detail: enrich in the rule

A before-operation rule can make its own call to fetch what the form did not collect. In one payroll product integration, the request body for an add-entitlement needed the employee's start date, which the plan did not carry. The rule fetched the employee record, read the start date, and built the body from the entitlement value plus that date. The same idea derived a hidden field in application K from the client and service line. Two cautions:

- Fail clearly when the lookup returns nothing. Submitting an empty array, or a null date, creates a silent bad write.
- Never put credentials in the rule to make the call. An early version did, and it is one of the findings on the security page. Use the source's own connection.

## Pattern 4: composite access, read-modify-write

Application K stores access as a **list of rows**, and its API offered no "add one row". The only safe write is: read the current list, merge the new rows, write the whole list back. ```html
<!-- dgm:k-field-cascade -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 300" role="img" aria-labelledby="k-field-cascade-t k-field-cascade-d" xmlns="http://www.w3.org/2000/svg"><title id="k-field-cascade-t">Field dependencies in a composite access block</title><desc id="k-field-cascade-d">Service line, asset manager, client, then region, country and entity depend on earlier choices; a level 2 service is derived in a rule.</desc><defs><marker id="k-field-cascade-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="k-field-cascade-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box blue" x="6" y="30" width="140" height="60" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="76.0" y="57.0" text-anchor="middle">Service line</text><text class="s" x="76.0" y="72.0" text-anchor="middle">reference list</text><rect class="box blue" x="176" y="30" width="140" height="60" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="246.0" y="57.0" text-anchor="middle">Asset manager</text><text class="s" x="246.0" y="72.0" text-anchor="middle">by service line</text><rect class="box blue" x="346" y="30" width="140" height="60" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="416.0" y="50.5" text-anchor="middle">Client</text><text class="s" x="416.0" y="65.5" text-anchor="middle">by asset manager</text><text class="s" x="416.0" y="78.5" text-anchor="middle">and service line</text><rect class="box blue" x="516" y="30" width="140" height="60" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="586.0" y="50.5" text-anchor="middle">Region(s)</text><text class="s" x="586.0" y="65.5" text-anchor="middle">by client and</text><text class="s" x="586.0" y="78.5" text-anchor="middle">service line</text><path class="ln accent  " d="M146,60.0 L176,60.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-field-cascade-ar-accent)"/><path class="ln accent  " d="M316,60.0 L346,60.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-field-cascade-ar-accent)"/><path class="ln accent  " d="M486,60.0 L516,60.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-field-cascade-ar-accent)"/><rect class="box " x="6" y="170" width="140" height="60" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="76.0" y="190.5" text-anchor="middle">Role(s)</text><text class="s" x="76.0" y="205.5" text-anchor="middle">not scoped by</text><text class="s" x="76.0" y="218.5" text-anchor="middle">client</text><rect class="box teal" x="516" y="170" width="140" height="60" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="586.0" y="190.5" text-anchor="middle">Country(s)</text><text class="s" x="586.0" y="205.5" text-anchor="middle">by client, service</text><text class="s" x="586.0" y="218.5" text-anchor="middle">line, regions</text><rect class="box teal" x="346" y="170" width="140" height="60" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="416.0" y="190.5" text-anchor="middle">Entity(s)</text><text class="s" x="416.0" y="205.5" text-anchor="middle">by client and</text><text class="s" x="416.0" y="218.5" text-anchor="middle">service line</text><rect class="box gold" x="676" y="170" width="138" height="60" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="745.0" y="190.5" text-anchor="middle">Level 2 services</text><text class="s" x="745.0" y="205.5" text-anchor="middle">rule only, not a</text><text class="s" x="745.0" y="218.5" text-anchor="middle">form field</text><path class="ln accent  " d="M586.0,90 L586.0,170" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-field-cascade-ar-accent)"/><path class="ln accent  " d="M416.0,90 L416.0,170" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-field-cascade-ar-accent)"/><path class="ln gold dash " d="M416,90 L416,130 L745,130 L745,170" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#k-field-cascade-ar-gold)"/><text class="l" x="410" y="270" text-anchor="middle">One block repeats as often as needed. The union of a person&#x27;s blocks is what they can reach.</text></svg></div><figcaption><b>Cascade of five dependent fields.</b> Redrawn from the application's confirmed reference calls; each box is one lookup the form or the rule must make.</figcaption></figure>
```

Consequences for the design:

| Concern | Design response |
|---|---|
| Two requests for the same user at once | The second write can overwrite the first. Serialise requests per user, or re-read and compare before writing |
| A row for several identities | An outer loop over identities, the same rows for each |
| A failure for one identity | Record it, continue the loop, and report partial failure in the final notification |
| Proof it worked | A read-back step compares what the application now holds with what was asked |
| A hidden dependency (a level-2 service list) | Derived in a before-operation rule from the client and service line, never asked of the requester |
| Atomic removal | The one atomic call the API did offer (remove a single role from a row) was used for revoke, with a live read first |

```html
<!-- dgm:k-provisioning-flow -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 300" role="img" aria-labelledby="k-provisioning-flow-t k-provisioning-flow-d" xmlns="http://www.w3.org/2000/svg"><title id="k-provisioning-flow-t">Read, merge, write, verify</title><desc id="k-provisioning-flow-d">Approval, then for each identity build the payload, create the account, activate, wait and verify; then notify.</desc><defs><marker id="k-provisioning-flow-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="k-provisioning-flow-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="k-provisioning-flow-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="k-provisioning-flow-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box blue" x="230" y="8" width="170" height="44" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="315.0" y="27.0" text-anchor="middle">Trigger</text><text class="s" x="315.0" y="42.0" text-anchor="middle">form submitted</text><rect class="box gold" x="430" y="6" width="170" height="48" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="515.0" y="20.5" text-anchor="middle">Approval</text><text class="s" x="515.0" y="35.5" text-anchor="middle">all identities and</text><text class="s" x="515.0" y="48.5" text-anchor="middle">accesses shown</text><path class="ln   " d="M400,30.0 L430,30.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#k-provisioning-flow-ar)"/><rect class="grp accent" x="0" y="80" width="820" height="130" style="fill:none;stroke:var(--accent);stroke-opacity:0.6;stroke-dasharray:6 4"/><text class="h" x="10" y="95" text-anchor="start">For each identity</text><rect class="box " x="14" y="108" width="130" height="74" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="79.0" y="142.0" text-anchor="middle">Build payload</text><text class="s" x="79.0" y="157.0" text-anchor="middle">blocks to row list</text><rect class="box blue" x="174" y="108" width="130" height="74" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="239.0" y="142.0" text-anchor="middle">Create account</text><text class="s" x="239.0" y="157.0" text-anchor="middle">API call</text><path class="ln accent  " d="M144,145.0 L174,145.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-provisioning-flow-ar-accent)"/><rect class="box blue" x="334" y="108" width="130" height="74" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="399.0" y="142.0" text-anchor="middle">Activate</text><text class="s" x="399.0" y="157.0" text-anchor="middle">send link</text><path class="ln accent  " d="M304,145.0 L334,145.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-provisioning-flow-ar-accent)"/><rect class="box " x="494" y="108" width="130" height="74" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="559.0" y="142.0" text-anchor="middle">Wait</text><text class="s" x="559.0" y="157.0" text-anchor="middle">fixed pause</text><path class="ln accent  " d="M464,145.0 L494,145.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-provisioning-flow-ar-accent)"/><rect class="box teal" x="654" y="108" width="130" height="74" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="719.0" y="135.5" text-anchor="middle">Verify</text><text class="s" x="719.0" y="150.5" text-anchor="middle">read back the</text><text class="s" x="719.0" y="163.5" text-anchor="middle">grants</text><path class="ln accent  " d="M624,145.0 L654,145.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-provisioning-flow-ar-accent)"/><path class="ln gold  " d="M515,52 L515,80" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-provisioning-flow-ar-gold)"/><path class="ln accent dash " d="M790,182 L790,198 L80,198 L80,182" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#k-provisioning-flow-ar-accent)"/><text class="l" x="430" y="192" text-anchor="middle">next identity; a failure is recorded and the loop continues</text><rect class="box green" x="290" y="238" width="240" height="48" style="fill:var(--sd-fn);stroke:var(--green);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="410.0" y="252.5" text-anchor="middle">Notify</text><text class="s" x="410.0" y="267.5" text-anchor="middle">every identity, its grants, any</text><text class="s" x="410.0" y="280.5" text-anchor="middle">failures</text><path class="ln teal  " d="M410,210 L410,238" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#k-provisioning-flow-ar-teal)"/></svg></div><figcaption><b>Why read-back matters.</b> The target had no atomic add, so additions merge into the current list and save it whole, and the verify step catches a success response that changed nothing.</figcaption></figure>
```

### Granularity: one row, one level

Application K keeps **one granularity per row**: a row holds regions, or countries, or entities, never a mix. Coarser lists are *derived* from finer ones. Sending a coarse list on a row that already holds a finer one is silently discarded with a success response. Therefore:

- A country-scoped grant cannot be merged into a row that holds an entity. It needs its own row.
- Key the rows by service line, client **and level**, not by service line and client alone.
- Several rows per service line and client is correct. The union of a person's rows is what they can reach.

This is a general rule worth remembering: **when an API accepts a value and returns success, read it back before you believe it.**

## Pattern 5: entitlement values that carry identifiers

Application K needed two internal identifiers to revoke a grant, and ISC's entitlement had only a name. The program packed them into the display name:

```text
<role> [>> <client>] >> <service line> ((<access row id>::<role id>))
```

The revoke rules parse the two ids back out. Consequences:

- **Changing the format renames every entitlement** and detaches every grant, so revoke must be changed in the same release.
- **A malformed or missing segment** means the grant cannot be resolved. It is the first thing to check when a revoke reports success and the target did not change.
- **The target may re-mint the id** when a grant is edited. The old entitlement value vanishes and a new one appears, so entitlement counts move between aggregations. That is the target's behaviour, not an ISC fault.
- **Entitlements nobody holds do not exist,** if the source has no group aggregation. ISC cannot list the catalogue.
- The revoke rule should read the **live** state of the target first, because the aggregated view may be months old. That makes revoke correct even when aggregation is stale.

## Pattern 6: one database per client

Application C holds users and groups in a separate database per client, and a JDBC source reaches one database. The solution was a **centralised integration database**:

| Piece | Role |
|---|---|
| A central database | Receives users and entitlements consolidated from every client database |
| A client-to-database mapping table | Holds which database belongs to which client |
| One ISC source | Aggregates accounts and groups from the central database only |
| The mapping, aggregated as entitlement | So the request form can offer a client and ISC knows its database |
| A stored procedure | Accepts the user, the group and the target database name, and writes to the right client database |
| The provisioning rule | Reads group and client from the request comment, looks up the database name, calls the procedure |

Why this was better than one source per database: it needed one source, one schedule and one runbook instead of dozens. The costs are a job that keeps the central database in step with the client databases, and a stored procedure the application team must own.

```html
<!-- dgm:multi-db-central -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 330" role="img" aria-labelledby="multi-db-central-t multi-db-central-d" xmlns="http://www.w3.org/2000/svg"><title id="multi-db-central-t">One source in front of many client databases</title><desc id="multi-db-central-d">Client databases are consolidated into a central database that ISC reads; provisioning calls a procedure that writes to the right client database.</desc><defs><marker id="multi-db-central-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="multi-db-central-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="multi-db-central-ar-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk blue" style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="multi-db-central-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><path class="box " style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1" d="M6,27 a75.0,7 0 0 1 150,0 v50 a75.0,7 0 0 1 -150,0 z"/><path class="box " d="M6,27 a75.0,7 0 0 0 150,0" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1;fill:none"/><text class="t" x="81.0" y="41" text-anchor="middle">Client database 1</text><path class="box " style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1" d="M6,107 a75.0,7 0 0 1 150,0 v50 a75.0,7 0 0 1 -150,0 z"/><path class="box " d="M6,107 a75.0,7 0 0 0 150,0" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1;fill:none"/><text class="t" x="81.0" y="121" text-anchor="middle">Client database 2</text><path class="box " style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1" d="M6,187 a75.0,7 0 0 1 150,0 v50 a75.0,7 0 0 1 -150,0 z"/><path class="box " d="M6,187 a75.0,7 0 0 0 150,0" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1;fill:none"/><text class="t" x="81.0" y="201" text-anchor="middle">Client database 3</text><rect class="box " x="210" y="100" width="120" height="60" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="270.0" y="120.5" text-anchor="middle">Sync job</text><text class="s" x="270.0" y="135.5" text-anchor="middle">kept by the</text><text class="s" x="270.0" y="148.5" text-anchor="middle">application team</text><path class="ln   " d="M156,52 L210,130" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#multi-db-central-ar)"/><path class="ln   " d="M156,132 L210,130" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#multi-db-central-ar)"/><path class="ln   " d="M156,212 L210,130" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#multi-db-central-ar)"/><path class="box " style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1" d="M380,77 a100.0,7 0 0 1 200,0 v136 a100.0,7 0 0 1 -200,0 z"/><path class="box " d="M380,77 a100.0,7 0 0 0 200,0" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1;fill:none"/><text class="t" x="480.0" y="91" text-anchor="middle">Central database</text><text class="s" x="480.0" y="106" text-anchor="middle">users, entitlements and a</text><text class="s" x="480.0" y="119" text-anchor="middle">client-to-database map</text><path class="ln   " d="M330,130 L380,130" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#multi-db-central-ar)"/><rect class="box accent" x="650" y="70" width="160" height="60" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="730.0" y="90.5" text-anchor="middle">ISC source</text><text class="s" x="730.0" y="105.5" text-anchor="middle">aggregates accounts</text><text class="s" x="730.0" y="118.5" text-anchor="middle">and groups</text><path class="ln accent  " d="M580,100 L650,100" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#multi-db-central-ar-accent)"/><text class="l" x="614" y="94" text-anchor="middle">aggregate</text><rect class="box blue" x="650" y="160" width="160" height="60" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="730.0" y="187.0" text-anchor="middle">Request form</text><text class="s" x="730.0" y="202.0" text-anchor="middle">group and client</text><path class="ln blue dash " d="M730,160 L730,130" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#multi-db-central-ar-blue)"/><text class="l" x="722" y="150" text-anchor="end">client map, as entitlement</text><rect class="box gold" x="380" y="262" width="200" height="52" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="480.0" y="278.5" text-anchor="middle">Provisioning rule</text><text class="s" x="480.0" y="293.5" text-anchor="middle">reads group and client, looks</text><text class="s" x="480.0" y="306.5" text-anchor="middle">up the database</text><path class="ln gold  " d="M730,220 L730,288 L580,288" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#multi-db-central-ar-gold)"/><rect class="box violet" x="110" y="262" width="200" height="52" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="210.0" y="285.0" text-anchor="middle">Stored procedure</text><text class="s" x="210.0" y="300.0" text-anchor="middle">user, group, target database</text><path class="ln gold  " d="M380,288.0 L310,288" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#multi-db-central-ar-gold)"/><path class="ln gold dash " d="M210,262 L82,262 L82,230" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#multi-db-central-ar-gold)"/><text class="l" x="150" y="256" text-anchor="middle">writes to the right database</text></svg></div><figcaption><b>Central integration database.</b> One source, one schedule and one runbook instead of one source per database. The cost is the sync job and a procedure the application team must own.</figcaption></figure>
```

## Pattern 7: no groups, still revocable

Application P had no group concept, but leavers still had to be handled and access reviews needed something to certify. Two techniques:

- **A dummy entitlement.** An after-operation rule on group aggregation injects one synthetic entitlement (an id and a name such as "Access") into the response. Every account then holds one thing to review.
- **Revocation as an action.** A before-remove-entitlement rule replaces the request body with a "mark as left" payload (leaving flags and a date). Revoking the dummy entitlement then performs the offboarding in the application.

Cautions: label the dummy clearly so reviewers know what revoking it does, put the behaviour in the runbook, and make the date logic explicit about **which time zone it uses**. A rule that formats "today" in one fixed zone is wrong for people in another.

```java
// After-operation rule on group aggregation: inject a single synthetic entitlement.
Map role = new HashMap();
role.put("Id", "<stable id>");
role.put("Name", "<Application> Access");
List data = new ArrayList();
data.add(role);
Map out = new HashMap();
out.put("data", data);
return out;
```

## Pattern 8: multi-valued updates and operation rewriting

Two smaller rules recur:

- **Replace-only connectors.** Some connectors have no native add or remove for a multi-valued attribute and no single-account read, so they only support replace. A before-provisioning cloud rule can turn each "add" or "remove" into a "set": read the account's current values from ISC, add or remove the requested values, and send the whole list. Skip create and delete requests, check the schema says the attribute is multi-valued, and return quietly when there is nothing to do. This is the same read-modify-write idea as pattern 4, done in a rule.
- **Operation rewriting.** A before-provisioning rule can change a disable into a move, an enable into a re-enable with attributes, or strip entitlements before a leaver move. Keep the logic table-driven if you can, so the next change is a configuration edit and not a code edit.

## Choosing a pattern

| Your situation | Start with |
|---|---|
| A grant needs two dependent values | Pattern 1, with an explicit scope and a composite value for removal |
| The form needs lists that depend on earlier choices | Pattern 2 (multi-step forms), with the parent stored in a searchable field |
| A rule needs something the requester chose | Pattern 3, option A, then B or C if it must survive other routes |
| The API only offers "replace the whole list" | Pattern 4, with read-back and per-user serialisation |
| You must parse an identifier out of an entitlement | Pattern 5, and freeze the format |
| Data lives in many databases | Pattern 6 |
| The application has no groups | Pattern 7 |

## A test matrix for complex requests

Build this before the first UAT. Each row is one test with a before and after check on the target:

| Case | Check |
|---|---|
| Each scope, single role, single entity | The right rows and no others |
| Each scope, several roles, several entities | The full cross product, once |
| Duplicate request | No duplicate row |
| Request through a route that carries no comment | A clear failure, not a wrong write |
| Revoke each scope | The right row removed, nothing else |
| Format change smoke test | Add, request, complete, revoke and certify before and after |
| One identity failing in a multi-identity request | Others succeed, failure reported |
| Two concurrent requests for one user | No lost update |
| Entitlement not yet aggregated | The form states a useful message |
| Target returns success but changes nothing | The read-back catches it |

## Actions

- Describe each complex application as a pattern (this page), not as a one-off, so the next one starts from a known design.
- Decide how form data reaches the rule before you build the form, and write down which routes will not carry it.
- Store the parent of every dependent value in a searchable field, and test each branch of a cascade.
- Treat every parsed name format as an API: freeze it, test it and version it.
- Make the default branch of any scope decision an error.
- Read back after every write to an API that can return success without acting.
- Put the failure strings (`METADATA IS NULL`, `Invalid format`) in the runbook.
