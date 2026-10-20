---
title: Checklists and Templates
---

Reusable lists distilled from the program. The phase checklists and the source checklist are the ones we would copy first. Treat the lists as starting points: they combine what the program's plans contained with items the guide's earlier pages say should have been there.

## Phase checklists

### Discovery and scoping

- Scope document with explicit inclusions and exclusions (privileged credentials, service accounts, client-facing identities).
- Application inventory with owner and technical contact per application.
- Authoritative source identified, its owner named, its mandatory fields listed.
- Immutable join key agreed.
- Time zones, languages and regions in scope.
- Environments: how sandbox maps to lower application environments, and production to production.
- Roles and responsibilities: integrator, platform owner, HR, directory, service desk, security.
- Licensing reviewed against planned features (workflow actions, connectors).

### Design

- Architecture: tenants, regions, virtual appliance clusters and their placement, network paths and ports.
- Identity profile: attributes, transforms, lifecycle states, state actions and their source lists.
- Directory design: organisational units, naming rules, group model, mailbox approach.
- Integration pattern per application (native connector, Web Services, JDBC, flat file, aggregation only).
- Access model: profiles, roles, approval scheme, revocation policy, ownership.
- Notification matrix.
- Security: where secrets live, who administers, who can edit rules.

### Build

- Naming conventions applied to sources, rules, workflows, forms, profiles.
- Rules reviewed for credentials, debug helpers and both directions of the disabled flag.
- Every source has a schedule, a delete threshold and an encrypted attribute list.
- Test objects are named as such and removed.
- Documentation pack started for each integration.

### Test

- Unit, system integration, user acceptance, per application, with evidence.
- Joiner, mover, leaver and rehire cases.
- Negative paths: denial, timeout, wrong manager, missing data.
- Performance of long-running calls against the appliance timeout.
- Notifications in the right environment.

### Go-live

See the go-live checklist below.

### Hypercare

- Monitors live, runbooks exercised, support model published.
- Issue log with categories; daily review for the first weeks.
- Nightly joiner and leaver exports reviewed.
- Closure document drafted.

## Per-source onboarding checklist

Run through this for every new source. Several lines exist because skipping them caused an incident.

| Step | Check |
|---|---|
| Owner | Business owner and technical contact named |
| Capability statement | What the integration can and cannot do (read, create, update, disable, delete, group add and remove), verified by running it, not read off the features list |
| Connection | VA cluster chosen, network path confirmed in both environments |
| Credentials | Created for this source and environment, stored encrypted, owner and rotation date recorded |
| Schema | Account and entitlement schemas defined; identifier, display and disabled attributes set |
| Correlation | Attribute chosen by match rate; case behaviour tested |
| Aggregation | Groups before accounts; paging proven with an overflow test; schedule set |
| Delete threshold | Set deliberately and verified |
| Disabled flag | Set in both directions in rules |
| Rules inventory | Each rule listed, reviewed, free of credentials and debug helpers |
| Lifecycle | Source added to the lifecycle actions' source lists |
| Access model | Entitlements non-requestable; profiles, approval and revocation policy decided; tile or naming convention |
| Provisioning | Create, update, disable, group add and remove proven; update policy exists if needed |
| Reviews | Included in a campaign or recorded as exempt |
| Monitoring | Freshness, population and status counts added |
| Documentation | Five-file pack and redacted configuration |

## Application questionnaire template

Use the structure from the factory page. Sections:

1. **Overview.** Hosting; vendor or in-house; API for users and groups; database read access; environments.
2. **User management.** Who gets access and how; joiner, mover, leaver process; mandatory attributes; how access is defined; termination handling; synchronisation frequency; ticket form and team; user source (HR, directory or neither); approvals; review frequency and criteria.
3. **Contacts.** Owner, technical contact, deputy.

Add a status line for the tracker: received, partial, none, redirected.

## Requirements document outline

1. Purpose
2. Application brief: user base, entitlements, environments
3. Current provisioning process
4. In-scope operations
5. Out-of-scope operations
6. Demo plan
7. Sign-off

## Design document outline

1. Introduction
2. Strategy and principles
3. Scope and out of scope
4. Architecture: tenant, appliances, directory agent
5. Integration patterns
6. Authoritative sources
7. Joiner, mover, leaver overview and application-specific flows
8. Appendices

For a single complex application, add: overview, requirements, source configuration, schemas, correlation, queries, schedule, attribute sync, provisioning policies, forms, workflows, rules.

## Go-live checklist

| When | Item |
|---|---|
| Before | Break-glass administrators created and tested |
| Before | Virtual appliances connected; health scan clean |
| Before | HR source, identity profile, transforms configured and compared with sandbox |
| Before | Single sign-on configured and validated |
| Before | Configuration migrated in the planned order; credentials re-entered; environment values changed |
| Before | Notification templates deployed; mail routing set for production |
| Before | Service management queue, mailbox and assignment group exist |
| Before | Governance groups and approval groups exist |
| Before | Data reconciliation closed |
| Before | Change records approved; communications sent |
| Before | Backup taken |
| During | Production aggregation reviewed; correlation reviewed |
| During | One joiner and one leaver end to end |
| During | Go or no-go with named owners |
| After | Nightly joiner and leaver exports; daily review |
| After | Staged attribute sync with validation between steps |

## RAID log template

| Column | Content |
|---|---|
| ID | Unique, with a prefix per type (R, A, I, D) |
| Type | Risk, assumption, issue, dependency |
| Category | The families from the hypercare page |
| Description | One sentence |
| Impact | What breaks and for whom |
| Owner | A person, not a team |
| Raised, due, closed | Dates |
| Status | Open, in progress, closed, accepted |
| Mitigation or fix | What was done |
| Link | Ticket or document |

Two program risks that stayed open to the end and belong in any similar log: removal of an approval step for a sensitive system, and integration credentials held in a vault that administrators download tokens from.

## Notification matrix template

| Template | Trigger | Recipient | Fallback recipient | Environment behaviour | Owner of text |
|---|---|---|---|---|---|

Fill one row for every email the platform can send, including the ones that fire from workflows. Review it with the service desk.

## Weekly status template

- Applications by stage: not started, requirements, build, SIT, UAT, live.
- Issues opened and closed, by category.
- Risks changed.
- Monitors: any breach.
- Decisions needed.

## Actions

- Copy the source checklist into your project and make "complete" a gate for go-live of each source.
- Tailor the other lists, and add a line whenever an incident teaches you one.
- Keep a single notification matrix and a single RAID log, both reviewed weekly.
