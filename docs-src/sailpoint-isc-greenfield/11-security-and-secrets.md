---
title: Security, Secrets and Tenant Hygiene
---

An identity platform holds the keys to everything else, so its own hygiene matters more than most systems. This page lists what we found when we audited the tenant after build, the habits that would have prevented each finding, and how to handle the sensitive material a project like this generates. Everything here is generalised; none of it names the client.

## What the audit found

| Finding | Where | Why it matters |
|---|---|---|
| A hard-coded `Authorization: Basic` header | Two operations on one Web Services source | The credential lives in the source definition and is returned by the source API to anyone who can read it |
| An OAuth `client_secret` and a password grant in plaintext HTTP bodies | Two HR writeback workflows, while other workflows used `$.secrets.*` | Workflow definitions are readable and exportable, so the secret travels with them |
| A client id stored in clear text | A REST source. It was not on the `encrypted` list, and `GET /sources/{id}` returns it | Half of a credential pair is still a credential |
| A service credential embedded as URL query parameters | Two connector rules. `GET /connector-rules/{id}` returns the script in clear text | The credential is in the rule body, in logs, and in any proxy that records URLs |
| A debug webhook helper | Four production rules | Sends rule data to an external listener. Provisioning fails whenever the listener is down |
| A predictable initial password | The directory create policy, built from slices of HR attributes | Anyone who knows an employee's record can compute it |
| 14 OAuth clients and 10 personal access tokens | Tenant-wide | None had a documented owner or rotation date |

None of these were exotic. Each was a shortcut taken during build, in a sandbox, that was promoted unchanged.

## Habits that prevent them

### Secrets

1. **Credentials belong in the platform's secret store or in the source's `encrypted` attributes,** never in a rule, a workflow body, an HTTP header field or a query string.
2. **Know what your read APIs return.** The source, connector-rule and workflow APIs return their definitions. Anything not marked encrypted is visible to every administrator and every token that can read them.
3. **Use per-environment credentials.** The sandbox and production integrations should not share a service account. Config Hub does not carry source secrets across tenants, so expect to re-enter them in production (see the go-live page); use that moment to issue new ones.
4. **Never pass credentials as URL parameters.** Move them to a header or a body, supplied from a secret.
5. **Prefer the secret reference over a pasted value in workflows.** Secrets can only be created in the UI, which is a nuisance, but it is the only safe route. Plan for it in the deployment checklist.
6. **Rotate when in doubt.** A credential pasted into a chat, a ticket or a shared document is exposed. Rotate it in the source and in every rule or workflow that repeats it. Find the repeats with a search over exported configuration before you rotate, not after.

### Rules and debugging

- If a rule needs diagnostics, log through the platform's logging, not through an external webhook.
- If you must keep a debug helper, gate it behind a flag that defaults to false and make the helper swallow its own failures so a dead listener cannot break provisioning. Review every production rule for the flag's value as part of go-live.
- Inventory connector rules and cloud rules as code. Cloud rules cannot be read with `GET`; export them through the configuration export with type `RULE`.
- Changes to some rules may need SailPoint to deploy them. Allow for that in release planning.

### Passwords

- Generate initial passwords from a random source, not from attributes. If the first-login flow is the only use, expire it.
- Deliver credentials to the right person. A recurring hypercare ticket was a credentials mail reaching the wrong recipient after a manager change.

### Tokens and clients

| Practice | Why |
|---|---|
| Inventory every OAuth client and PAT with an owner and purpose | Unowned credentials are never rotated |
| One client per integration, with the least scope that works | A leak is then bounded |
| Set an expiry or a review date | Stale tokens outlive the people who made them |
| Do not share one administrator token across scripts and people | There is no audit trail otherwise |
| Rotate on staff departure | A PAT is tied to its creator's rights |

## Sensitive material your project produces

A tenant dump, an exported configuration and a set of troubleshooting notes are all **sensitive data**. We took a full JSON dump of the tenant to support analysis, and it contained source configuration, rules, workflow definitions and, where an attribute was not marked encrypted, credentials.

- Store dumps in access-controlled locations and delete them when the analysis is done.
- Do not email them. Do not paste them into a chat or a ticket.
- Redact before sharing. Replace anything credential-shaped. Strip query-string credentials and long hex literals. A helper that replaces values for named keys and masks long random strings catches most of it.
- Keep a clean redacted copy of each integration's configuration with its documentation pack. It is the evidence that the handover is complete, without being a liability.

## Configuration hygiene

- **The `encrypted` list on a source is data,** and it can drift. We found duplicates and entries added by hand. A key that should be encrypted but is not on the list is stored and returned in clear.
- **The `features` list can overstate capability.** A source that declares it can create and enable accounts does not mean those operations are wired up. Check by running one, then record the real capability statement in the documentation.
- **Test and copy objects accumulate.** Workflows and forms created for tests were left in place. Delete them or mark them clearly; each one is a potential path for a mistake.
- **Do not leave the delete threshold at a permissive value.** See the connectors page; it is a security control as much as a safety one.

## Privileged access and scope exclusions

The program deliberately excluded:

- **Privileged credentials,** which stay in a vault and are not managed by ISC.
- **Service accounts.** Their governance was recorded as a separate proposal rather than stretched into the HR-driven lifecycle. The proposal was an inventory database fed by the vault, the directory and an ISC extract, with a reporting layer on top, delivered in phases. The database was recommended over a direct dashboard connection because it keeps correlation, history and resilience, and avoids exposing credentials to the reporting tool.

State your exclusions in the scope document. An auditor will ask where service accounts and break-glass access are governed, and "later, here is the plan" is a better answer than silence.

## Break-glass and administrator access

- Create break-glass administrators in each tenant before go-live, store their credentials in the vault, and test them.
- Keep the number of full administrators small. The tenant held 14 clients and 10 tokens; the same discipline applies to people.
- Record who can edit rules, workflows and sources. Treat the ability to change a connector rule as the ability to read or change anything that source touches.

## A short security review you can run in a day

1. List every source and check which attributes are on the `encrypted` list against the attributes that look like secrets.
2. Search exported rules, workflows and forms for `Authorization`, `password`, `secret`, `token`, `client_secret` and for URLs with `?` and `=`.
3. Read the 5 most privileged rules end to end.
4. Inventory OAuth clients and PATs, with owner and last use.
5. Check that every enabled workflow's secrets are references.
6. Check initial password generation.
7. Confirm the delete threshold of every source.
8. Look for debug helpers and test objects.

## Actions

- Ban credentials in rules, workflow bodies and URLs from the first build. Review for it at every promotion.
- Inventory OAuth clients and tokens with owners, and rotate them on a schedule.
- Treat tenant dumps and exports as sensitive; redact before sharing; delete when finished.
- Rotate any credential that has been pasted anywhere it should not have been.
- Write the scope exclusions (privileged accounts, service accounts) down with the plan for them.
- Run the one-day security review before go-live and again at the end of hypercare.
