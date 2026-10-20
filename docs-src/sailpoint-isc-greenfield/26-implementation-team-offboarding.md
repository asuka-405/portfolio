---
title: Implementation Team Offboarding and Ownership Risk
---

Every implementation ends with the people who built it leaving. In ISC that departure is not an HR formality, because the platform ties **objects, credentials, notifications and knowledge to named individuals**. When those individuals are disabled or removed, workflows can stop, approvals can stall, sources can lose their owner, scripts can lose their tokens and the runbook can turn out to live in someone's head. This page describes what the tenant looked like at the end of the program, what breaks and why, and a sequence for leaving a platform that keeps working. Counts are rounded or exact from a read-only tenant dump, and no names appear.

## Why this is a platform risk

An ISC object is rarely independent of a person. Four kinds of tie exist:

| Tie | Example | What it does when the person goes |
|---|---|---|
| **Ownership** | The owner of a source, a workflow, an access profile, a role, a form | The object has no accountable owner. Some objects block the person's deletion. Some lose their notifications |
| **Credential** | A workflow's personal access token, a token a script uses | The credential is disabled or invalid, and whatever uses it fails |
| **Routing** | An approver, a governance group member, a hard-coded email address, a certification reviewer | Work is sent to someone who no longer reads it |
| **Knowledge** | A script, a runbook that exists only locally, a vault entry only one person can open | The next person cannot reproduce or repair what was built |

The implementation team is the worst case, because it created most of the platform and holds a disproportionate share of all four.

```html
<!-- dgm:ownership-blast-radius -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 360" role="img" aria-labelledby="ownership-blast-radius-t ownership-blast-radius-d" xmlns="http://www.w3.org/2000/svg"><title id="ownership-blast-radius-t">What a departing implementer takes with them</title><desc id="ownership-blast-radius-d">Ownership, credentials, routing and knowledge, each with the objects and the impact if left untransferred.</desc><defs><marker id="ownership-blast-radius-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box accent" x="300" y="140" width="220" height="80" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="410.0" y="177.0" text-anchor="middle">Departing implementer</text><text class="s" x="410.0" y="192.0" text-anchor="middle">created most of the platform</text><rect class="box accent" x="6" y="8" width="330" height="118" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="171.0" y="51.0" text-anchor="middle">Ownership</text><text class="s" x="171.0" y="66.0" text-anchor="middle">workflows 25 of 28, sources about 75 percent,</text><text class="s" x="171.0" y="79.0" text-anchor="middle">access profiles over 90 percent, roles 272 of 284</text><text class="m" x="171.0" y="92.0" text-anchor="middle">highest: automation stops</text><rect class="box gold" x="484" y="8" width="330" height="118" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="649.0" y="51.0" text-anchor="middle">Credentials</text><text class="s" x="649.0" y="66.0" text-anchor="middle">workflow tokens, personal tokens used by scripts</text><text class="s" x="649.0" y="79.0" text-anchor="middle">and tools, shared expiry dates</text><text class="m" x="649.0" y="92.0" text-anchor="middle">high: integrations fail</text><rect class="box gold" x="6" y="232" width="330" height="118" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="171.0" y="275.0" text-anchor="middle">Routing</text><text class="s" x="171.0" y="290.0" text-anchor="middle">approvers, governance groups of one, hard-coded</text><text class="s" x="171.0" y="303.0" text-anchor="middle">mail, no fallback approver</text><text class="m" x="171.0" y="316.0" text-anchor="middle">high: work waits forever</text><rect class="box violet" x="484" y="232" width="330" height="118" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="649.0" y="275.0" text-anchor="middle">Knowledge</text><text class="s" x="649.0" y="290.0" text-anchor="middle">scripts, local dumps, secret custody,</text><text class="s" x="649.0" y="303.0" text-anchor="middle">authenticator, support contacts</text><text class="m" x="649.0" y="316.0" text-anchor="middle">high: cannot repair</text><path class="ln accent  " d="M360,140 L330,126" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ownership-blast-radius-ar-accent)"/><path class="ln accent  " d="M460,140 L490,126" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ownership-blast-radius-ar-accent)"/><path class="ln accent  " d="M360,220 L330,232" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ownership-blast-radius-ar-accent)"/><path class="ln accent  " d="M460,220 L490,232" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ownership-blast-radius-ar-accent)"/></svg></div><figcaption><b>Four ties.</b> The same person usually appears in all four, which is why offboarding an implementer is a project and not a ticket. Figures are from the final tenant snapshot.</figcaption></figure>
```

## What the tenant looked like

At the end of the program the tenant held the following. The dump is a snapshot from the final weeks.

| Object type | Count | Concentration |
|---|---|---|
| Workflows | 28 | 25 owned by one person, 3 by another |
| Sources | 146 | Two people owned 109 of them (about three quarters) |
| Access profiles | 3,333 | One person owned about 3,050 (over 90 percent) |
| Roles | 284 | Two people owned 272 |
| Campaign templates | 519 | Four people owned 483 |
| Governance groups | 45 | Owned by a handful of individuals. 27 groups had one or two members, 4 had one |
| Saved searches | 87 | Three people owned 84 |
| Scheduled searches | 5 | Two owners. Searches were also the source of the nightly joiner and leaver exports |
| Personal access tokens | 10 | Each tied to an individual. Six shared one expiry date, four had not been used for over three months |
| OAuth clients | 14 | Nine belonged to the appliances. Five served integrations (webhooks, a leaver search, external workflow triggers, a form portal) |
| Workflow email addresses | 54 literal addresses | 43 looked like shared mailboxes or lists, 11 looked personal |
| Org-wide approval settings | | No fallback approver, no reminders, no escalation |

Three things stand out.

1. **Ownership was concentrated.** One identity owned nine in ten access profiles and most workflows. That is typical of a build done by a small team, and it is exactly what makes the departure dangerous.
2. **Credentials were personal.** The tokens were created by individuals, and several were the sort of convenience credential (a script, an editor extension, a REST client) that outlives its purpose.
3. **There was no safety net.** With no fallback approver and no reminders, an approval addressed to a removed person simply waits. The same is true of a certification.

The administrator identities, too, came from a small delimited file with no appliance, not from the HR feed. **Identities loaded that way are not touched by the HR leaver automation.** Offboarding the implementers' own administrator accounts is a manual task unless you plan it.

## What breaks, object by object

| Object | What happens when the owner is disabled or removed | Impact |
|---|---|---|
| **Workflow** | The admin who creates a workflow becomes its owner and gets a personal access token for it. If that owner leaves, SailPoint's documentation calls the workflow **orphaned**: it has no owner and its token becomes invalid, and executions can fail with unauthorised errors. Community reports say steps such as Get Identity and Manage Access run with the owner's permissions, so joiner, mover and leaver flows are the first to suffer | **Highest.** The automation that provisions and disables people stops, usually without an obvious alarm |
| **Source** | A source must have an owner. The owner cannot be deleted while they own it. A source reset is blocked if any source owner holds an account on the source. The owner is also who reviews uncorrelated accounts in source-owner campaigns | High for operations and reviews |
| **Access profile, role, application** | An identity that owns any of these cannot be deleted. Where the profile's approval is "owner", the approval goes to someone who is gone | High where owner approval is used. Silent elsewhere |
| **Entitlement** | The owner is used for review and approval routing. Entitlement owners are often forgotten | Medium |
| **Governance group** | Members vanish from approvals and reviews. A group of one becomes an empty group | High. 4 groups had a single member |
| **Campaign and template** | Notifications go to the template owner. A reviewer who is removed leaves items waiting. An identity that is a reviewer of an active certification cannot be deleted | High around review cycles |
| **Form and launcher** | Forms carry an owner. Forms are tied to workflows by identifier. We did not find a documented rule for what a form does when its owner is removed, so treat it as a risk to test | Medium. Unverified |
| **Saved and scheduled search** | Scheduled searches are owned. Whether they keep running after the owner is disabled depends on release, so test it. The program's nightly joiner and leaver exports were scheduled searches | Medium to high. Monitoring goes quiet |
| **Personal access token** | Belongs to the creating user and cannot exceed their access. Community reports say tokens are disabled when the identity is disabled, revoking bearer tokens immediately, and that re-enabling the identity does not bring them back. **A token that a script, a pipeline or a campaign tool uses stops working** | High for automation |
| **API client (OAuth)** | Documented as not tied to a person. A client used by a workflow's external trigger or a webhook keeps working. Review what each client can do (scopes) and who knows its secret | Medium. The secret and the knowledge of it matter |
| **Appliance clients** | Created for the virtual appliances, independent of people | Low |
| **Notification, approval, escalation settings** | Hard-coded addresses, approvers by identifier, and an empty fallback approver mean mail and work go to inactive recipients | High where addressed to a person |
| **Admin user levels and MFA** | Administrator accounts need MFA. A shared or service administrator whose authenticator lives on one person's phone is a person-dependent credential | High, and discovered at the worst time |

### Disable and delete are different

From SailPoint's identity documentation:

- **Disabling** an identity removes sign-in to the platform immediately. An active session continues until it ends. It **does not disable the person's accounts in source systems** or revoke access there. User levels are kept.
- **Deleting** an identity removes its correlated accounts from the identity (they are not deprovisioned at the source). **Identities that own sources, roles, access profiles or applications cannot be deleted, nor can reviewers of active certifications.** Assign new owners and reassign the reviews first.
- **A deletion is only temporary if the person still exists in an authoritative source**, because the next aggregation can recreate the identity with a new internal identifier. The person then has to be invited again and given back any elevated rights.

So the order is: reassign everything, then disable, then observe, then delete if you must.

## The other issues

- **Credentials the team knows.** Source credentials and client secrets that only the implementers have seen. Workflow secrets can only be created in the UI, so a rotation needs a person who can do it and has the vault.
- **Local material.** Tenant dumps, exported rules and workflows, scripts and workbooks on laptops, some containing credentials. These must be found, handed over or destroyed. The campaign tool's workbook holds an API client and a file server login.
- **Tokens in tools.** Editor extensions, REST clients and scripts each held a token. Unused tokens are not harmless: they are valid until expiry.
- **Several tokens expiring together.** Six tokens carried the same expiry date, which suggests a bulk update. They will all stop on the same day, and whoever remembers them will have left.
- **Support and vendor channels.** Support cases, expert services contacts, community accounts, the ITSM queue the integrator joined, mailing lists and chat channels.
- **Approvals and notifications addressed to individuals.** Eleven personal-looking addresses sat in workflow definitions, and the approval fallback was empty.
- **Hard-coded identifiers.** Workflows reference objects by identifier. Rebuilding or transferring them changes those identifiers.
- **Service desk ownership.** Who now answers "the manager never got the form" at two in the morning.
- **Contract ends but access does not.** Implementation accounts in downstream systems (directories, the ITSM tool, application consoles) are not removed by ISC. Offboard them in those systems.
- **Support access.** SailPoint's own support and services tokens are removed when tenant access expires. Re-grant it deliberately if you will need help.

## A sequence that keeps the platform running

```html
<!-- dgm:offboarding-phases -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 340" role="img" aria-labelledby="offboarding-phases-t offboarding-phases-d" xmlns="http://www.w3.org/2000/svg"><title id="offboarding-phases-t">Offboarding timeline</title><desc id="offboarding-phases-d">Inventory, design, reassign, make repeatable, shadow, then disable, observe and delete after the departure.</desc><defs><marker id="offboarding-phases-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><path class="ln   " d="M30,170 L790,170" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><path class="ln   " d="M30.0,164 L30.0,176" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><text class="l" x="30.0" y="190" text-anchor="middle">T-90</text><path class="ln   " d="M182.0,164 L182.0,176" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><text class="l" x="182.0" y="190" text-anchor="middle">T-60</text><path class="ln   " d="M334.0,164 L334.0,176" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><text class="l" x="334.0" y="190" text-anchor="middle">T-30</text><path class="ln   " d="M486.0,164 L486.0,176" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><text class="l" x="486.0" y="190" text-anchor="middle">departure</text><path class="ln   " d="M638.0,164 L638.0,176" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><text class="l" x="638.0" y="190" text-anchor="middle">T+30</text><path class="ln   " d="M790.0,164 L790.0,176" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><text class="l" x="790.0" y="190" text-anchor="middle">T+60</text><rect class="box blue" x="30.0" y="12" width="72.0" height="64" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="66.0" y="34.5" text-anchor="middle">Inventory</text><text class="s" x="66.0" y="49.5" text-anchor="middle">owner</text><text class="s" x="66.0" y="62.5" text-anchor="middle">register</text><rect class="box blue" x="106.0" y="84" width="72.0" height="64" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="142.0" y="106.5" text-anchor="middle">Design</text><text class="s" x="142.0" y="121.5" text-anchor="middle">target</text><text class="s" x="142.0" y="134.5" text-anchor="middle">owners</text><rect class="box accent" x="182.0" y="12" width="148.0" height="64" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="256.0" y="28.0" text-anchor="middle">Reassign</text><text class="s" x="256.0" y="43.0" text-anchor="middle">groups, items,</text><text class="s" x="256.0" y="56.0" text-anchor="middle">sources, workflows,</text><text class="s" x="256.0" y="69.0" text-anchor="middle">forms, tokens</text><rect class="box gold" x="334.0" y="84" width="148.0" height="64" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="408.0" y="106.5" text-anchor="middle">Shadow</text><text class="s" x="408.0" y="121.5" text-anchor="middle">receiving team runs</text><text class="s" x="408.0" y="134.5" text-anchor="middle">it</text><rect class="box teal" x="334.0" y="12" width="148.0" height="64" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="408.0" y="41.0" text-anchor="middle">Repeatable</text><text class="s" x="408.0" y="56.0" text-anchor="middle">register and monitors</text><rect class="box gold" x="486.0" y="206" width="148.0" height="70" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="560.0" y="231.5" text-anchor="middle">Disable, observe</text><text class="s" x="560.0" y="246.5" text-anchor="middle">failures, exports,</text><text class="s" x="560.0" y="259.5" text-anchor="middle">approvals</text><rect class="box violet" x="638.0" y="270" width="148.0" height="56" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="712.0" y="295.0" text-anchor="middle">Delete</text><text class="s" x="712.0" y="310.0" text-anchor="middle">when nothing is owned</text><path class="ln accent  " d="M486.0,176 L486.0,206" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#offboarding-phases-ar-accent)"/><text class="l" x="410" y="336" text-anchor="middle">Disable first, delete last. Offboard downstream accounts in the directories and applications yourself.</text></svg></div><figcaption><b>A sequence, not an event.</b> Dates are relative to the departure. Start the inventory three months out; the reassignments are the long pole.</figcaption></figure>
```

### 1. Inventory (about 90 days before)

Build an **owner register**: every object, its type, its owner, a deputy and a review date. Produce it from the API, not from memory. The script below groups by owner and writes a file you can review.

```python
import csv, json, os, time, urllib.request

TENANT = os.environ["ISC_TENANT"]
TOKEN = os.environ["ISC_TOKEN"]
BASE = f"https://{TENANT}.api.identitynow.com"

# path, name of the owner field in the response (names differ by object type; check each)
ENDPOINTS = [
    ("/v2025/sources", "owner"),
    ("/v2025/access-profiles", "owner"),
    ("/v2025/roles", "owner"),
    ("/v2025/workflows", "owner"),
    ("/v2025/form-definitions", "owner"),
    ("/v2025/governance-groups", "owner"),
    ("/v2025/campaign-templates", "ownerRef"),
    ("/v2025/saved-searches", "ownerId"),
    ("/v2025/scheduled-searches", "ownerId"),
]

def get(path, offset=0, limit=250):
    req = urllib.request.Request(f"{BASE}{path}?limit={limit}&offset={offset}",
                                 headers={"Authorization": f"Bearer {TOKEN}"})
    for _ in range(5):
        try:
            with urllib.request.urlopen(req) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(int(e.headers.get("Retry-After", "5")))
            else:
                raise
    raise RuntimeError("rate limited")

def owner_of(obj, field):
    v = obj.get(field)
    if isinstance(v, dict):
        return v.get("id"), v.get("name")
    return v, None

with open("owner_register.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["type", "object id", "object name", "owner id", "owner name"])
    for path, field in ENDPOINTS:
        offset = 0
        while True:
            page = get(path, offset)
            if not page:
                break
            for o in page:
                oid, oname = owner_of(o, field)
                w.writerow([path.rsplit("/", 1)[-1], o.get("id"), o.get("name"), oid, oname])
            if len(page) < 250:
                break
            offset += 250
```

Notes: some endpoints do not take `limit` and `offset`, and some are in the beta namespace, so check each against the current API reference. Add the personal access tokens (listed per owner by an administrator), the OAuth clients and the scheduled searches' recipients. Sort the result by owner and **count objects per departing person**: that count is your effort estimate.

Also search the definitions for hard-coded addresses and identifiers:

```bash
grep -rnoE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" exported-workflows/ | sort | uniq -c | sort -rn
grep -rnoE "\b[0-9a-f]{32}\b" exported-workflows/ | cut -d: -f3 | sort | uniq -c | sort -rn
```

### 2. Design the target ownership model (about 75 days before)

| Object | Owner after the handover | Why |
|---|---|---|
| Workflows and their tokens | A **dedicated, non-expiring administrator identity** (a service identity), with its authenticator held by named people | SailPoint's guidance is to create workflows with an administrator account that will not expire, and community practice is a service identity |
| Sources | The platform team lead as technical owner, with the application owner as business contact | Source ownership drives operational notices and uncorrelated-account reviews |
| Access profiles and roles | The **application owner or a governance group**, never a person on a project | Ownership of thousands of objects must not sit with one person |
| Governance groups | At least three named members, from different teams | A group of one is an outage waiting for a holiday |
| Campaign templates | A governance group or the compliance function | Reviews outlive the project |
| Forms and launchers | The service identity | They are tied to workflows |
| Saved and scheduled searches | The service identity, with recipients as a shared mailbox | They are monitors |
| Tokens and clients | One per integration, owned by the service identity, with the least scope that works, an expiry, and a named human owner in the register | Credentials need an accountable owner that is not the creator |
| Notifications | Shared mailboxes and lists, never individuals | Mail should survive a departure |
| Approvals | A fallback approver, reminders and an escalation | A missing person should delay a request, not strand it |

The service identity must be governed: record who holds its credentials and its multi-factor authenticator, keep break-glass credentials with named people, and review it quarterly. Some of the community material suggests the platform's service-account approach is being superseded by newer machine identity features, so confirm what your release recommends.

### 3. Reassign (about 60 to 30 days before)

Transfer in this order, testing after each group:

1. **Governance groups:** add members first, then change owners.
2. **Access profiles, roles, entitlements, applications.** Use the list endpoints filtered by owner and update the owner. Do it in bulk, scripted, with a before and after count.
3. **Sources.** Change the owner on each. Check that none of the owners is also an account holder on a source you will reset.
4. **Workflows.** A workflow must be **disabled before its owner is changed**. Assigning it to another administrator generates a new personal access token and a new owner. Do one at a time, run it, check an execution.
5. **Forms, launchers, saved and scheduled searches.** Transfer, then verify that a scheduled search still produces its output and its recipients still receive it.
6. **Campaign templates and active certifications.** Reassign reviews and templates. Complete or reassign active campaigns before disabling a reviewer.
7. **Tokens and clients.** Create replacements under the service identity, switch each consumer, confirm it works, then revoke the old one. Record the new expiry.

The community has built workflows that react to a leaver by finding what the person owned and asking the manager for a new owner. Useful ideas, but note their limits (loop caps, search index lag) and that workflow reassignment may reassign requests, not ownership. Test them. There is also a product connector designed for governance reassignments, which may fit if you want this to be permanent.

### 4. Make it repeatable (about 30 days before)

- Keep the owner register current, with a quarterly review.
- Add a monitor for **objects whose owner is inactive, disabled or missing**. A search for identities with an inactive lifecycle state that still own things is the simplest one.
- Add a monitor for workflow execution failures with authorisation errors.
- Add a monitor for tokens approaching expiry or not used for a long time.
- Schedule the reassign automation if you use it.

### 5. Shadow period (about 30 days before)

Have the receiving team run the platform while the implementers are still there. They should exercise every runbook (the hypercare page lists them) and make one real change safely each. Use the findings to correct the documentation.

### 6. Disable, observe, then delete (cutover and the 30 days after)

- **Disable** the identities, do not delete them. Disabling stops sign-in and (according to community reports) their tokens, but it does not touch their accounts at source systems, so offboard those in the directories and applications themselves.
- **Observe for 30 days.** Watch the workflow failure rate, scheduled search output, joiner and leaver volumes, aggregation freshness, and approvals waiting.
- **Delete** only when nothing owns anything, no active certifications name them, and the owner register shows no references. Remember a person who is still in an authoritative source can reappear as a new identity.
- **Remove vendor access:** support cases, expert services, community and chat memberships, the ITSM queue.

## Handover acceptance

Treat the handover as a deliverable with a signature, not an assumption.

| Check | Evidence |
|---|---|
| Owner register delivered and reconciled with the tenant | The register matches a fresh export |
| No object owned by a departing person | A zero-row owner query |
| Workflows run under the service identity | An execution after reassignment succeeds |
| Tokens and clients rotated | Old ones revoked, new expiry dates recorded |
| Secrets and authenticator custody documented | Who holds them, and a tested recovery |
| Runbooks exercised by the receiving team | A signed log of each exercise |
| Local material accounted for | A list of dumps, scripts and workbooks, handed over or destroyed |
| Support and vendor contacts updated | The new named contacts |
| Downstream accounts offboarded | Checks in the directories and application consoles |
| Open issues and risks transferred | A log with owners |

## Symptoms after an owner leaves

| Symptom | Likely cause | Fix |
|---|---|---|
| Joiner, mover or leaver workflow starts failing with unauthorised errors | The workflow's owner was disabled or removed, so its token is invalid | Disable the workflow, assign a new owner, enable it. Check the next execution |
| A script that used to work returns 401 | The token belonged to the departed person | Issue a token under the service identity and update the script |
| Nightly exports or reports stopped arriving | A scheduled search's owner or recipient is gone | Reassign the search and confirm recipients |
| Approvals or reviews sit untouched | The approver or reviewer is gone and there is no fallback | Reassign, set a fallback approver and reminders |
| Cannot delete an identity | It still owns a source, role, profile or application, or is a reviewer | Reassign those, then retry |
| Cannot reset a source | A source owner holds an account on it | Remove that account or change the owner temporarily |
| A token stopped working after re-enabling an identity | Disabling disabled the token and re-enabling did not restore it (community report) | Create a new token |
| Many tokens stopped on the same day | They shared an expiry date | Renew, and stagger expiry dates |
| A form or launcher misbehaves | The owner or an identifier changed | Test it, and recreate or retarget it |
| Mail goes nowhere | A personal address in a workflow or template | Move to a shared mailbox |
| A returned identity has no admin rights | It was deleted and recreated by aggregation | Re-invite and re-grant levels |

## What to do from day one

Offboarding is cheap if you start the project with the end in mind.

- Create workflows, forms and sources under the **service identity** from the start, not under a personal account that you later have to transfer.
- Keep a live owner register from the first sprint.
- Use governance groups for ownership of access items.
- Prefer shared mailboxes in every template and workflow.
- Give every token a purpose, an owner, an expiry and a review date, and stagger expiry dates.
- Keep secrets in the vault with two people able to retrieve them.
- Write the runbook as if the author were already gone.
- Plan the offboarding date at kickoff and put the 90 day inventory in the project plan.


## Sources and how far to trust them

- [Building a workflow](https://documentation.sailpoint.com/saas/help/workflows/workflow-build.html): owner, personal access token, orphaned workflows, reassigning to another administrator, using an account that will not expire. Official.
- [Working with identities](https://documentation.sailpoint.com/saas/help/identities/identity_mgmt.html): what disabling and deleting an identity do, and the ownership and reviewer restrictions on deletion. Official.
- [Managing API keys and personal access tokens](https://documentation.sailpoint.com/saas/help/common/api_keys.html): tokens belong to their creator, cannot exceed the owner's access, ten per user, default six month expiry, API clients are not tied to a person. Official. It does not say what happens to a token when its owner is disabled.
- Community threads, which are **not official**: a reply that disabled identities' tokens are disabled too and are not restored on re-enable ([PAT behaviour](https://developer.sailpoint.com/discuss/t/no-indicator-for-disabled-personal-access-tokens/75530)); workflow-owner 401 errors and the owner-switch workaround ([workflow owners](https://developer.sailpoint.com/discuss/t/identitynow-workflows-managing-pat-based-api-calls-when-workflow-owners-are-deactivated/191465)); reassigning owned objects with workflows or the governance connector ([reassign owners](https://developer.sailpoint.com/discuss/t/reassign-object-owners-using-identitynow-workflows/22371), [owner termination](https://developer.sailpoint.com/discuss/t/handling-acces-item-owner-termination-in-isc/211696)); and service identities as owners ([service accounts](https://developer.sailpoint.com/discuss/t/best-practice-for-authenticating-external-application-with-isc-apis/204687)).

What we could not confirm: what a form does when its owner is removed, whether scheduled searches keep running for a disabled owner, and what happens to a token when its owner is **deleted**. Test these on a sandbox identity before you rely on an answer.

## Actions

- Produce the owner register now and count objects per implementer.
- Name the service identity, its credential and authenticator custodians, and the break-glass holders.
- Reassign in the order above, workflow by workflow, with a test after each.
- Replace personal tokens and addresses with service-owned, shared ones.
- Add the owner-inactive, workflow-failure and token-expiry monitors.
- Run a 30 day shadow period and a 30 day observe period.
- Disable first, delete last, and offboard accounts in the downstream systems yourself.
- Sign the handover against the acceptance table.
