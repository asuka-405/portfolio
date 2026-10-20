---
title: Active Directory and Mailbox Provisioning
---

Active Directory was the first target and the one every user notices. It was also the place where the legacy tool's behaviour had to be reproduced most faithfully, because changing naming, container placement or group membership rules affects mail, VPN, single sign-on and licensing at once.

## What was in scope

| Source | Purpose |
|---|---|
| Main corporate domain | The primary workforce directory; create, move, enable, disable, group membership |
| Administrator accounts in the same domain | Privileged accounts with their own correlation rule |
| Second corporate domain | A separate domain with its own joiner and rehire workflows |
| External-user domain | A third domain for external staff; it shared an Asia-region cluster with the second domain |
| A product governed through AD groups | A fund-accounting product whose access is AD group membership, so it is an AD source in its own right |

Use one AD source per domain, one cluster per estate. Do not stretch one source across forests.

## The create policy

The create policy for the main domain defined about 50 fields. The important ones:

| Field | How it is set |
|---|---|
| `sAMAccountName` | A cloud rule: first 3 of first name + last 3 of last name + a two-digit counter, 8 characters maximum, with a uniqueness check |
| `cn` | The login name, which keeps the distinguished name unique across containers |
| `distinguishedName` | `CN=<cn>,` plus a path built from region, department and work location. Built by a transform on the identity |
| `mail`, `userPrincipalName`, `proxyAddresses` | A cloud rule generates a unique address; UPN equals mail; proxy addresses hold the primary SMTP and the SIP address |
| `manager` | A transform that finds the manager's distinguished name |
| `displayName`, `title`, `department`, `company`, `co`, `c`, `l`, `physicalDeliveryOfficeName`, `employeeType` | Direct identity attribute mappings |
| `employeeID` | The HR identifier |
| `extensionAttribute1`, `extensionAttribute2`, a custom department attribute | Used by sync into the cloud directory and by downstream apps |
| `info` | A note "Created by SailPoint Automation on <date>" |
| `pwdLastSet` | Forces a change at first sign-in |
| `password` | **See the warning below** |

The disable policy moves the object to a disabled container, hides it from the address list and stamps a note. The enable policy moves it back, un-hides it, sets a new password and stamps a note.

> **Do not derive passwords from HR attributes.** The policy built the initial password by concatenating slices of HR attributes. That is deterministic and guessable by anyone who knows the pattern and has the HR record. Use a generated random value or a temporary access pass, deliver it through a controlled channel (to the manager only), and force a change on first sign-in.

```html
<!-- dgm:ad-account-build -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 330" role="img" aria-labelledby="ad-account-build-t ad-account-build-d" xmlns="http://www.w3.org/2000/svg"><title id="ad-account-build-t">What the directory create policy builds</title><desc id="ad-account-build-d">Unique login name and email, common name, distinguished name from organisational attributes, baseline groups and country-based licensing.</desc><defs><marker id="ad-account-build-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="ad-account-build-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box teal" x="6" y="20" width="252" height="74" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="132.0" y="47.5" text-anchor="middle">Unique login name</text><text class="s" x="132.0" y="62.5" text-anchor="middle">first 3 letters + last 3 + a counter,</text><text class="s" x="132.0" y="75.5" text-anchor="middle">8 characters</text><rect class="box teal" x="286" y="20" width="252" height="74" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="412.0" y="47.5" text-anchor="middle">Unique email</text><text class="s" x="412.0" y="62.5" text-anchor="middle">name.surname, with a number added</text><text class="s" x="412.0" y="75.5" text-anchor="middle">when taken</text><rect class="box " x="566" y="20" width="252" height="74" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="692.0" y="54.0" text-anchor="middle">Common name</text><text class="s" x="692.0" y="69.0" text-anchor="middle">set from the login name</text><path class="ln   " d="M258,57.0 L286,57.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#ad-account-build-ar)"/><path class="ln   " d="M538,57.0 L566,57.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#ad-account-build-ar)"/><rect class="box blue" x="6" y="150" width="252" height="74" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="132.0" y="177.5" text-anchor="middle">Distinguished name</text><text class="s" x="132.0" y="192.5" text-anchor="middle">region, department and work location,</text><text class="s" x="132.0" y="205.5" text-anchor="middle">in the standard users container</text><rect class="box blue" x="286" y="150" width="252" height="74" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="412.0" y="177.5" text-anchor="middle">Baseline groups</text><text class="s" x="412.0" y="192.5" text-anchor="middle">cloud sign-in, multi-factor,</text><text class="s" x="412.0" y="205.5" text-anchor="middle">self-service reset, all-users</text><rect class="box gold" x="566" y="150" width="252" height="74" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="692.0" y="184.0" text-anchor="middle">Country rule</text><text class="s" x="692.0" y="199.0" text-anchor="middle">licence group chosen by country</text><path class="ln   " d="M258,187.0 L286,187.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#ad-account-build-ar)"/><path class="ln   " d="M538,187.0 L566,187.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#ad-account-build-ar)"/><path class="ln accent  " d="M774,94 L774,122 L132,122 L132,150" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ad-account-build-ar-accent)"/><rect class="box accent" x="6" y="262" width="394" height="54" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="203.0" y="286.0" text-anchor="middle">Create the account in the directory</text><text class="s" x="203.0" y="301.0" text-anchor="middle">agent call, then the account is aggregated back</text><rect class="box ghost" x="426" y="262" width="388" height="54" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="620.0" y="286.0" text-anchor="middle">Cloud directory sync</text><text class="s" x="620.0" y="301.0" text-anchor="middle">attributes reach the cloud directory afterwards</text><path class="ln   " d="M400,289 L426,289" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#ad-account-build-ar)"/><path class="ln accent  " d="M400,224 L400,262" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;"/><path class="ln accent  " d="M132,224 L132,262" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#ad-account-build-ar-accent)"/></svg></div><figcaption><b>Account build.</b> Adapted from the joiner flow in the design: the same rules produce the login, email, location in the tree and baseline access.</figcaption></figure>
```

## Containers, groups and location rules

- **Container (OU) placement depends on location.** The legacy tool had large spreadsheets mapping office location to default groups, country finance and HR contacts, and web-presence contacts. Port the contacts into lookup transforms. Port the default groups into **criteria-based birthright roles, one per office**, each wrapping an access profile of that office's groups (see the access model page). Keep the source spreadsheet under change control.
- **Default groups per location** are part of onboarding. In hypercare the first thing missed for one office was its default security groups for the internet gateway and remote access; without them users could not browse or connect from home. Verify each office's default group set during UAT, not only the global ones.
- **Baseline groups** for every joiner: cloud sync, multi-factor authentication, self-service password reset, an "all IDM users" group, and a licence group. A different licence group applies to one country, so the licence logic is conditional on country.
- **Groups to preserve on leaver.** Domain users plus the cloud-sync group must survive for a week or more after termination so mail and records stay reachable. Implement as an allow-list.
- **Group aggregation timing.** If you read groups into ISC, aggregate them before accounts. Newly created accounts otherwise reference group objects ISC has not seen.

### Standard human-account scope

Directory aggregation should read only the OUs that hold human accounts. A reconciliation file listing the standard human OUs (and the accounts under them) was used to confirm scope. Service accounts and shared mailboxes in those OUs end up uncorrelated or, worse, disabled by lifecycle actions. Decide:

1. Which OUs are in scope for aggregation.
2. How non-human accounts are identified (naming, an attribute, an OU).
3. Whether they get a separate source and profile.

## The before-provisioning rule

A before-provisioning cloud rule on the main domain handled everything the policy could not. Its 16 KB of Java covered:

- **Name-change movers.** Generate a new unique address (first.last, then first.last1...), set mail and UPN, rebuild proxy addresses with the new primary and the old one demoted, and optionally rename the object when the OU changes at the same time.
- **Leaver group cleanup.** Remove every group except an allow-list.
- **Distinguished name targets** read from identity attributes.

Guidance for this kind of rule:

- Keep it as small as you can. It is a sandboxed Beanshell script; you cannot unit test it outside the platform and every change is a production change.
- Log inputs and decisions at a low level and turn logging off after a diagnostic window. The rule logged mover details at error level, which buried genuine errors.
- Handle the *both changed at once* case (name and OU in the same refresh) explicitly. It is easy to forget and it happens.
- A stock "services standard" before-provisioning rule also sat in the tenant. Know whether you use it; do not delete it without checking references.

```html
<!-- dgm:iqservice-lb -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 330" role="img" aria-labelledby="iqservice-lb-t iqservice-lb-d" xmlns="http://www.w3.org/2000/svg"><title id="iqservice-lb-t">Directory agents behind load balancers</title><desc id="iqservice-lb-d">Appliances reach each domain through a load balancer that fronts a pair of directory agent servers.</desc><defs><marker id="iqservice-lb-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="iqservice-lb-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="iqservice-lb-ar-violet" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk violet" style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="grp " x="0" y="6" width="190" height="318" style="fill:none;stroke:var(--text);stroke-opacity:0.28;stroke-dasharray:6 4"/><text class="h" x="10" y="21" text-anchor="start">VA clusters</text><rect class="box blue" x="14" y="34" width="162" height="70" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="95.0" y="59.5" text-anchor="middle">Appliances</text><text class="s" x="95.0" y="74.5" text-anchor="middle">HR and directory</text><text class="s" x="95.0" y="87.5" text-anchor="middle">clusters</text><rect class="box blue" x="14" y="126" width="162" height="70" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="95.0" y="158.0" text-anchor="middle">Appliances</text><text class="s" x="95.0" y="173.0" text-anchor="middle">application clusters</text><rect class="box blue" x="14" y="218" width="162" height="70" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="95.0" y="243.5" text-anchor="middle">Appliances</text><text class="s" x="95.0" y="258.5" text-anchor="middle">clusters in other</text><text class="s" x="95.0" y="271.5" text-anchor="middle">regions</text><rect class="box violet" x="250" y="46" width="90" height="44" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="295.0" y="64.0" text-anchor="middle">Load</text><text class="t" x="295.0" y="79.0" text-anchor="middle">balancer</text><rect class="box teal" x="420" y="28" width="150" height="36" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="495.0" y="43.0" text-anchor="middle">Directory agent 1</text><text class="s" x="495.0" y="58.0" text-anchor="middle">primary</text><rect class="box teal" x="420" y="74" width="150" height="36" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="495.0" y="95.5" text-anchor="middle">Directory agent 2</text><path class="ln violet  " d="M340,68.0 L420,46.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-violet)"/><path class="ln violet  " d="M340,68.0 L420,92.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-violet)"/><rect class="box " x="660" y="46" width="120" height="44" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="720.0" y="65.0" text-anchor="middle">Domain 1</text><text class="s" x="720.0" y="80.0" text-anchor="middle">389 / 636</text><path class="ln teal  " d="M570,46.0 L660,58" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-teal)"/><path class="ln teal  " d="M570,92.0 L660,80" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-teal)"/><rect class="box violet" x="250" y="144" width="90" height="44" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="295.0" y="162.0" text-anchor="middle">Load</text><text class="t" x="295.0" y="177.0" text-anchor="middle">balancer</text><rect class="box teal" x="420" y="126" width="150" height="36" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="495.0" y="141.0" text-anchor="middle">Directory agent 1</text><text class="s" x="495.0" y="156.0" text-anchor="middle">primary</text><rect class="box teal" x="420" y="172" width="150" height="36" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="495.0" y="193.5" text-anchor="middle">Directory agent 2</text><path class="ln violet  " d="M340,166.0 L420,144.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-violet)"/><path class="ln violet  " d="M340,166.0 L420,190.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-violet)"/><rect class="box " x="660" y="144" width="120" height="44" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="720.0" y="163.0" text-anchor="middle">Domain 2</text><text class="s" x="720.0" y="178.0" text-anchor="middle">389 / 636</text><path class="ln teal  " d="M570,144.0 L660,156" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-teal)"/><path class="ln teal  " d="M570,190.0 L660,178" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-teal)"/><rect class="box violet" x="250" y="242" width="90" height="44" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="295.0" y="260.0" text-anchor="middle">Load</text><text class="t" x="295.0" y="275.0" text-anchor="middle">balancer</text><rect class="box teal" x="420" y="224" width="150" height="36" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="495.0" y="239.0" text-anchor="middle">Directory agent 1</text><text class="s" x="495.0" y="254.0" text-anchor="middle">primary</text><rect class="box teal" x="420" y="270" width="150" height="36" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="495.0" y="291.5" text-anchor="middle">Directory agent 2</text><path class="ln violet  " d="M340,264.0 L420,242.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-violet)"/><path class="ln violet  " d="M340,264.0 L420,288.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-violet)"/><rect class="box " x="660" y="242" width="120" height="44" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="720.0" y="261.0" text-anchor="middle">Domain 3</text><text class="s" x="720.0" y="276.0" text-anchor="middle">389 / 636</text><path class="ln teal  " d="M570,242.0 L660,254" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-teal)"/><path class="ln teal  " d="M570,288.0 L660,276" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar-teal)"/><path class="ln   " d="M176,69 L250,46" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar)"/><path class="ln   " d="M176,161 L250,144" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar)"/><path class="ln   " d="M176,253 L250,242" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#iqservice-lb-ar)"/><text class="l" x="410" y="318" text-anchor="middle">Agent port 5050 (5051 for the second channel). Appliance to agent traffic is TLS.</text></svg></div><figcaption><b>Directory agents.</b> The design ran two agent servers per domain behind a load balancer, so an agent can be patched or fail without stopping provisioning. Reads go directly from the appliance; writes go through the agent.</figcaption></figure>
```

## Native rules on the directory source

An **AfterModify** native rule ran on the main domain source. IQService can run before and after scripts around operations. Use them sparingly: they run on the Windows host, outside the cloud rule sandbox, and they are the place where mailbox and licence side effects live if you keep them as scripts.

## Mailbox and licence side effects

The legacy IDM ran PowerShell for several cloud mail operations. Decide where each lands:

| Legacy step | Options in the new design |
|---|---|
| Add baseline and licence groups on create | Directory group membership in the create policy, or an IQService after-script |
| Convert to shared mailbox on leave | A script, or a group-based policy on the mail side |
| Set out-of-office with the manager's text | A script run from a workflow or an after-script, using the leaver form answer |
| Hide from the address list | A directory attribute set in the disable policy (what we used) |
| Assign a leaver licence | A licence group added on disable |
| Log which licence was assigned | An audit trail somewhere; the legacy scripts wrote files |

Authentication for mail scripts moved from basic authentication to certificate-based authentication during the legacy period. Do not build new automation on basic authentication.

## Aggregation and sync schedule

- The main domain aggregated every two hours across the night and day; the HR source every hour. Offset the two so a joiner's HR record, the directory create, the mail round-trip and the next directory aggregation line up.
- Allow about **an hour for a directory change to replicate** across domain controllers before assuming a failure.
- Set the **delete threshold to 10%** on every directory source. A bad LDAP search or a lost domain controller can return nothing.

## Known sharp edges

| Symptom | Cause |
|---|---|
| Account missing in AD although a "credentials sent" email went out | Duplicate distinguished name or non-unique UPN rejected the create; fix the data, then re-provision from ISC |
| User name shows as login ID in the admin console | CN equals login name by design |
| Display name has two spaces | CN-derived name with no middle name; use a collapse-spaces transform |
| Group membership gone after leaver date | No allow-list or no delay; see the lifecycle page |
| Wrong HR or finance contact on a joiner | The contact lookup table is stale |
| Rehire has the wrong mailbox state | The old mailbox was converted to shared; reactivation needs the reverse |
| User cannot get online or on VPN | The location's default groups are missing |
| Old and new accounts for the same person | The rehire rule was not followed in HR |

## Actions

- Port legacy contact mappings into lookup transforms with defaults and location-to-group mappings into per-office birthright roles.
- Define the human-account OU scope and how you recognise non-human accounts.
- Write the group allow-list for leavers and the delay.
- Replace derived initial passwords with generated ones.
- Decide the new home for every mailbox and licence script.
- Set TLS and delete-threshold values on every directory source.
