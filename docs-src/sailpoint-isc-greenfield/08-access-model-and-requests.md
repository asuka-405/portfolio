---
title: Access Model, Request Center and Approvals
---

The access model decides what people can have, how they get it, and who says yes. On this program it grew to about 3,300 access profiles and 280 roles, almost all of them generated or bulk-created. This page covers the building blocks, the four ways access reached users, and the decisions about approval, ownership and revocation that are easy to leave at the defaults.

## The building blocks

| Object | What it is | How we used it |
|---|---|---|
| Entitlement | One permission on a source (group, role, assignment) | Aggregated from the source. Mostly **not requestable** directly |
| Access profile | A bundle of entitlements from **one** source, with an approval scheme | The unit users request. Nearly always one entitlement each |
| Role | A bundle of access profiles, assigned by criteria or requested | Criteria-based **birthright** roles; one requestable role |
| Source app | The Request Center / App Center **tile** for a source | Groups access profiles so users can browse them |
| Launcher + workflow + form | A custom request experience | For access that cannot be modelled as a profile |
| Governance group | A set of people who act as reviewers or approvers | Reviewers for campaigns, second-level approvers |

## Four ways access reaches a user

1. **Access profile in the Request Center.** The standard path. A profile wraps an entitlement, carries the approval scheme and belongs to a source app (the tile). If a profile belongs to no app it is still requestable by search but has no tile.
2. **Launcher plus workflow.** A form-driven request that ends in a workflow granting access directly. Used when selections are composite (client, group, office) and need dynamic option lists.
3. **Criteria-based role.** Membership defined by identity attributes; assignment is automatic and silent. Used for per-location baseline groups and for entitlements that follow someone's directory presence.
4. **Aggregation only.** The source is read and reviewed, nothing is granted from ISC. Many sources, and one live integration, sat here.

Which mechanism you choose per application is a design decision with consequences:

| Mechanism | Pros | Cons |
|---|---|---|
| Profile + tile | Familiar, supports approval chains, browsable | Becomes unbrowsable at scale. One integration had 1,700 profiles and **no tile**: users had to search by name, following a naming convention |
| Launcher + workflow | Dynamic forms, composite grants | Platform limits on forms and workflows (next page). Only works if every grant goes through the launcher |
| Criteria role | No request needed | No record explains why someone gained or lost it; membership flips on identity refresh |
| Aggregation only | Cheap, immediate review | No provisioning; revocation may be the only write |

## Roles: birthright by location

About 280 roles existed, 282 of them criteria-based and none of them requestable but one. The overwhelming pattern was a **birthright role per office**, each wrapping an access profile of the AD groups that office needs. This is how the location-to-default-groups mapping from the legacy tool was reproduced.

Notes:

- Name them predictably (`<Office>_BirthRight`). A second family of per-country roles existed for another group set.
- **Some roles held no access profile.** They were placeholders created in bulk. Empty roles are noise in every campaign and report; either fill or remove them.
- Role criteria are evaluated on refresh. A change in location or lifecycle state changes membership, which provisions or removes access, with no request. Document that in your SOP so service desks know the access came from a role.
- **Role propagation was disabled** in the tenant. Know the setting; it governs whether role changes cascade as expected.
- Criteria built on the lifecycle state attribute (`active`, or not `inactive`) keep leavers from retaining visibility of request forms.

## Access profiles at scale

| Topic | What we saw |
|---|---|
| Count | About 3,300, of which about 3,100 requestable |
| Naming | `<App> - <Scope>: <Role>` for generated ones; the description mirrored the name. A search by name is the discovery route for untiled profiles |
| Entitlement coverage | 2,071 entitlements produced 1,738 profiles on one source, so about 330 were governed but not requestable. Decide whether that is intentional |
| Ownership | **One person owned 2,700 of the 3,000 profiles we sampled.** Every profile change, certification review and escalation routed through them. Use a governance group |
| Revocation approval | Mostly none. About 20 percent of profiles in the sample had a manager approval on revocation. See below |
| Denial comments | Required on one application, not on the rest. Pick a policy |
| Duration and re-authorisation | No profile set a maximum duration or a required end date. Re-authorisation was off tenant-wide |

### Approval schemes seen

| Scheme | Used for |
|---|---|
| Manager only | The default for most applications |
| Manager then a governance group | High-risk applications such as the finance consolidation tool; the second stage is an application owner group |
| Owner only | A handful |
| None (empty list) | A lift-and-shift application where the ITSM ticket already had approval |

### Revocation approval is a decision

On most profiles granting required manager approval and revoking required nothing. That asymmetry is often right (removing access should be easy) but it must be chosen, documented and defended. It also means anyone with a way to raise a revoke can remove access with no check. Record the decision per application.

### Tenant-wide request settings

These settings were read from the tenant and are worth reviewing on day one:

- **Request on behalf of:** anyone could request for anyone. Tighten if your policy requires managers or owners only.
- **Auto-approval:** off.
- **Reauthorisation:** off.
- **Approval reminders and escalation:** no days, no maximum, no fallback approver. Approvals can sit forever, and the "approval expired" case in a workflow looks identical to "never arrived" (see the forms page). Set reminders and a fallback.
- **Entitlement requests:** allowed, comments optional.
- **Governance group visibility:** off.

## The source app tile

- A source app's profile list is only visible through its own sub-resource. The list payload returned an empty `accessProfiles` array for apps that clearly had profiles. And that sub-resource **returns an empty list silently when `limit` exceeds 250.** Always page at 250.
- One application had its profiles split across several tiles by scope (local, market, region, global). Splitting by scope made 200 profiles browsable. It cost four apps to maintain.
- When access exists that has no profile (for example security groups held by a colleague that you are asked to replicate), a new "other" tile was created for the leftovers. Plan for an "everything else" tile instead of building profiles on demand.

## Entitlement requestability

- Make entitlements **non-requestable by default** and expose access only through profiles. Exceptions bypass approval schemes. One integration had a single directly requestable entitlement that bypassed two-stage approval; find these with a search and close them.
- If the entitlement catalogue is huge and mostly unneeded for requests (tens of thousands of role assignments), do not wrap them all in profiles. Review them; request only what is asked for.

## Tags and metadata

- **Tags on entitlements** (about 4,000 tagged) were used to scope reviews and searches, for example one tag per client entity. Tags are queryable in search and in form data sources, and they can replace what attributes cannot do (see the forms page).
- Governance metadata attributes (privacy, classification, risk, environment, requires training and similar) exist in the platform. They were present but barely used. If audit wants classification on access, populate them at onboarding, not later.

## Access request experience: cautions

- **Two interfaces for one app is a UX failure.** A joiner form plus the Request Center produced two ways to request access for a single product. Choose one entry point per application.
- **Visibility of the launcher is itself an entitlement.** See the forms page. A criteria role can control who sees the tile.
- **Third-party identities.** If any applications serve clients, keep them out of the request center for employees.
- **Search-based discovery.** Where an application has no tile, give users the naming convention, not a hope.

## Governance groups

- 45 groups, mostly "<Application> Access Reviewers" of one to four people. They double as campaign reviewers and second-stage approvers.
- Create them **before** campaigns and before approval schemes reference them. The rollout checklist had a dedicated task for source and approval groups.
- Groups of one are an outage waiting for a holiday. Aim for at least two people per group.

## Actions

- Choose the access mechanism per application and record the reason.
- Make entitlements non-requestable and wrap them in profiles.
- Move profile ownership to governance groups before the count passes a few hundred.
- Decide approval and revocation policy per application, with reminders and a fallback approver.
- Define what happens to untiled access (an "others" app or an explicit no).
