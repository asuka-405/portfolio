---
title: Hypercare, Operations and Handover
---

Go-live is where the work changes shape: the build team stops writing and starts reading tickets. This page covers what the issue log looked like in the weeks after cutover, the operating routine the runbooks settled on, the monitors worth building, and how knowledge was handed to the team that would run the platform.

## What hypercare looked like

The issue log from hypercare held about 75 rows. They fell into a small number of families, and **almost none were about the core engine failing.** They were about data, notifications and edge cases around people.

| Category | Typical issue | Likely cause (our reading of the log) |
|---|---|---|
| Re-add directory groups | A person lost a group and wanted it back | Role criteria changed, or a mover flow removed access |
| Display name issues | Wrong or inconsistent name in the directory | HR name fields, or a transform that cleaned them |
| Rehire account issues | A returning employee had an old account or a duplicate | Rehire path not fully covered by the joiner logic |
| Contact update | Phone or address stale after an HR change | The attribute feeding the lookup was not refreshed |
| Form and notification issues | The manager never got the form. Credentials mail went to the wrong person. Nobody could see whether a form had been completed | Routing by role, manager changes, no visibility of form state |
| Re-assignment | A form had to be resent to a new manager | The original approver left or changed |
| Email update | Work email needed pushing back to HR | Writeback gaps |
| Disable access | A leaver's end date in HR was wrong | HR data, not ISC |
| New account creation (old process) | Someone asked for an account through the legacy route | Change management and communication |
| Duplicate identifiers in the directory | Duplicate distinguished name or user principal name | Name collision handling |
| Finance consolidation tool | Read-only and legacy groups had no access profiles | Fixed by creating an "Others" application for leftover access |
| General access | A profile was missing or not requestable | Access model gaps |

The log also recorded two program risks that persisted: the approval step for the most sensitive client system had been removed, and integration credentials were held in a vault that administrators download tokens from locally.

### Lessons from the pattern

1. **Most tickets are data or routing, not code.** Staff the first weeks with people who can read HR data and mailbox rules, not only developers.
2. **Notifications are the biggest source of noise.** Seven notification changes were made after go-live. Draw the matrix of template, trigger, recipient and fallback before go-live, and review it with the service desk.
3. **Give people visibility.** "Did my manager complete the form?" is a question the platform does not answer by default. Decide who can see form state and how.
4. **Rehires are a whole flow, not a joiner variant.** Write test cases for them in UAT.
5. **A reassignment path is a requirement.** Approvers leave. A form that cannot be resent to a new manager becomes a manual task for the team.
6. **Leftover access needs a home.** The "Others" application absorbed security groups nobody had modelled.

## Operating routine

The per-integration runbooks converged on the same structure, and it is a good template for your own.

### Schedule calendar

A table of every aggregation, every lifecycle job and every report, with time zone. A global deployment ran across four time zones, so write the zone down.

### Health checks

| Check | How |
|---|---|
| Freshness | The last aggregation date per source, from a search over a `lastAggregationDate` attribute. Alert when older than the schedule plus a margin |
| Disabled count | A search for disabled accounts per source, compared to yesterday |
| Delete threshold | Confirm the configured value did not change |
| Uncorrelated list | Count and review the accounts with no identity |
| Entitlement count | A sudden halving means a truncated aggregation (see the page limit on listing) |
| Sentinel literal | A search for a placeholder such as a computed-by-rule marker that should never appear in a real value |
| Cluster status | Every VA healthy, no cluster down to one appliance |

### Troubleshooting by symptom

Each runbook has a table that maps a symptom to a likely cause, a way to confirm, and a fix. The generalised version is on the last page of this guide.

### Making a change safely

A checklist, in this order: read the current configuration, take a backup or export, change in sandbox first, test one object before many, deploy, verify with a search, record the change. Include "update the lifecycle state source list" for any new source, and "update the runbook".

### Read-only API recipes

A list of GET calls an on-call engineer can run without risk, with the filters to use. They are also on the last page.

## Monitors worth building

The platform will not alert on most of the quiet failures. Build monitors for:

| Monitor | Why |
|---|---|
| Population count per aggregation run | A truncated feed shows as a sudden drop |
| Status counts per source (enabled, disabled, locked) | A broken status comparison makes every account look enabled |
| Age of last aggregation per source | Two production sources ran for months without a schedule |
| Failed and cancelled workflow rates | A rising rate means a downstream system changed |
| Cluster status | A VA down to one appliance is a risk before it is an outage |
| Delete threshold audit | A threshold edited during troubleshooting and left behind |
| Test and copy workflow clean-up | They are live objects |
| Rule inventory | New or changed rules since last review |

## Handover to run

The delivery team will leave, so knowledge transfer was treated as a deliverable with its own acceptance.

### The documentation pack

For every integration, five files and a redacted configuration folder:

| File | Holds |
|---|---|
| README | What it is, who owns it, status, links |
| 01 Integration | How it works end to end: endpoints or queries, rules, workflows, mapping |
| 02 Tenant context | The objects in the tenant that belong to this integration, their names and settings |
| 03 Edge cases and dead ends | What was tried and did not work, so nobody repeats it |
| 04 Runbook | Schedule, health checks, symptoms, change procedure, API recipes |
| config/ | Redacted exports of the source, rules, workflows and forms |

The "dead ends" file is the most valuable and the one teams skip. It saves the next engineer days.

### The closure document

A closure document template covered the handover to the run team: scope delivered, open items, known issues, risks, support model, contacts and acceptance. Treat acceptance as a signature, not as an assumption.

### Acceptance checklist for run

- Run team has read access to the tenant and has used it to run the health checks.
- Every runbook has been exercised once by someone who did not write it.
- Open issues and risks are in a log with owners.
- Credentials are owned and have a rotation plan.
- Support model is written: who is first line, what is second line, when ISC support is called.

## Support model (recommended)

Decide before go-live:

- **First line** answers "how do I" and routes tickets. Give them the FAQ and a short decision tree.
- **Second line** can read the tenant and run the health checks and recipes.
- **Third line** can change rules, workflows and sources. Limit this to a few named people.
- **Vendor support** for platform problems and for rule changes that cannot be made in the tenant.

An ITSM queue, assignment group and mailbox should exist before go-live, along with membership for the integrator, so that the first ticket does not wait on access.

## Actions

- Staff hypercare for data and routing problems, not just defects.
- Build the notification matrix before go-live and review it with the service desk.
- Create the monitors above on day one, especially freshness and status counts.
- Produce the five-file pack per integration, including the dead ends, and have a person who did not write each one run its runbook.
- Define the support model and open the ITSM routes before cutover.
- Keep an issue log with a category column; the pattern in it is your backlog.
