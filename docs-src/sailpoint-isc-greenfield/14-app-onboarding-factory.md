---
title: Phase 2 Application Onboarding Factory
---

Phase 1 brought in the directory, the HR system and about ten critical applications by hand. Phase 2 had a target of 120 to 135 more applications over five to six quarters, which cannot be done as a series of bespoke projects. This page describes the factory that was set up: how applications were tracked and chased, what the questionnaire asked, the repeatable artefacts for each one, and what the response data taught us about the realistic pace.

## The tracker

A single workbook tracked every application. It had one sheet per phase, a backlog and a response tracker. For the 57 applications in the active list, the columns were:

| Group | Columns |
|---|---|
| Outreach | initial communication date, reminder, latest response, call scheduled |
| Questionnaire | status (received, partial, none) |
| People | application owner, technical single point of contact, country, office |
| Backlog sheet | status, minutes of meeting, escalated, priority (P1 or P2), call-schedule mail, environment access, region, when the technical contact is available, replaced by |

Keep the owner and the **technical contact** as separate columns. The business owner answers "who needs access"; the technical contact answers "how is it stored and can we connect". Often they are different people, and about a dozen applications were first "redirected to the technical contact".

### The response tracker

From early December to February, about two months of chasing:

| Measure | Start | End |
|---|---|---|
| Full responses | 21 | 32 |
| Redirected to a technical contact | about 12 | about 15 |
| No response | 7 | 0 |
| Calls scheduled | | 25 |

Reading it: **chasing works, but slowly.** No-response fell to zero, yet full responses (32) stayed well below the number of applications in the active list (57), with the rest redirected or scheduled for a call. Plan for a long tail of applications that never answer, and agree in advance what happens to them (retire, defer, or review as a flat file).

## The questionnaire

About 50 filled questionnaires exist. Each is a short workbook in three sections.

### 1. Overview

- Where it is hosted and who manages it (vendor or in-house).
- Whether it has an API for users and groups, and whether the database can be read.
- Which environments exist (development, test, production).

### 2. User management

- Who gets access and how it is requested today.
- The joiner, mover and leaver process.
- Mandatory attributes for an account.
- How access is defined (roles, groups, a table) and how changes are made.
- How termination is handled.
- How often the user list can be synchronised.
- The ticket form used, and the team that handles it.
- Whether the user list comes from HR or the directory, and whether the directory is mandatory.
- Approvals in use.
- Access review frequency and criteria.

### 3. Single point of contact details

Names and contact details for the owner, the technical contact and a deputy.

### What the answers looked like

Many answers were "don't know" or a row of question marks. Several applications turned out to be retired or about to be replaced, one payroll product was terminated, and others had no technical owner at all. This is not a failure of the questionnaire. It is the first useful output of the factory: **an honest inventory of what is in use and who knows about it.** Record the "don't know" answers, since they drive what you do next.

An outreach mail template (initial request, reminder, escalation) was kept with the tracker. Write it once and reuse it for every application.

## Per-application artefacts

Every application followed the same document trail:

| Artefact | Purpose |
|---|---|
| Requirements document | Purpose, application brief (user base, entitlements, environments), current provisioning process, in-scope and out-of-scope operations, demo notes |
| Sign-off on requirements | The application owner agrees what will and will not be automated |
| Demo | Show the integration working in the sandbox |
| Design document | Integration approach, source configuration, schemas, correlation, schedule, provisioning policies, forms, workflows, rules |
| System integration test results | Pass or fail per case, with evidence |
| User acceptance test | Business sign-off |
| Implementation and rollback plan | Ordered steps with a named rollback for each |
| End-user manual (SOP) | For the service desk and the approvers |
| Documentation pack | The five-file handover (see hypercare page) |

### Effort heuristic

The planning heuristic that held up: **three to five sessions for requirements, three to five for system integration testing, one to two for production.** An integration that needs a custom rule or a database schema takes the upper end or more. Budget the sessions as calendar time with the business, not as build hours; the waiting is what dominates.

## Worked examples

Two applications that shared a vendor product but differed in structure became the templates:

- **A SQL Server application with one database per client.** The integration discovers client databases, reads users and groups from each, and provisions into the right one. It needed a multi-database schema document, a JDBC provisioning rule, an access request execution description and a test-evidence document, on top of the usual artefacts.
- **The single-instance version of the same product.** One database, no client dimension. It followed the simple pattern: requirements, an approval process slide, an end-user manual, SIT results, and an implementation and rollback plan.

The multi-database one is the harder case, and its documents are the more detailed. The lesson we would draw (a recommendation, not a measurement) is to pick the hardest representative application first, so its entitlement naming, approval routing, request form and evidence format can be reused by the simpler ones.

## Prioritisation

Rank the backlog on three axes and make the ranking visible:

1. **Risk.** Finance, client data and privileged systems first.
2. **Integration readiness.** An application with an API or a readable database ahead of one that needs a project.
3. **Responsiveness.** An owner who answers quickly goes before one who does not, because it keeps the factory busy. This is a recommendation, not something the tracker enforced.

Use P1 and P2 rather than a score. Anything that is not P1 or P2 is not in the plan.

## Patterns that kept the factory moving

- **A fixed onboarding checklist per source** (see the checklists page), including the lifecycle source list and the delete threshold.
- **Standard entitlement and profile naming,** so rules and reports work across applications.
- **A standard request form and approval chain** so each application only supplies its list of options.
- **Templates for every document,** pre-populated with the answers from the questionnaire.
- **Flat-file review as the fallback** for applications that cannot be integrated (see the campaigns page). It satisfies audit while the harder integration waits.
- **Weekly status** with counts by stage, driven from the tracker, not from memory.

## What SailPoint's guidance adds

- **Discovery before onboarding.** SailPoint's guidance is to gain visibility of as many applications as you can, governed or not, before choosing. Our questionnaire and tracker did this by hand. If you license an application discovery capability, use it to seed the tracker.
- **Self-registration.** A SailPoint blog describes a portal where application owners register their own systems and answer a few questions, from which prioritisation suggestions are made. A shared form feeding the tracker achieves the same effect with less effort for your team.
- **Reuse patterns.** The same blog recommends starting from templates for systems already seen elsewhere and collecting only customer-specific details (URLs, connection strings) at registration, instead of long technical discovery.
- **Readiness assessments.** The connectivity guidance warns that unknown ownership and missing information are the main causes of stalled onboarding. Run a readiness check before engineering time is spent.
- **Require an IAM review for every new application,** system development or vendor purchase, so the long tail does not grow back after phase 2.
- **Document the onboarding steps** for compliance and for the next application.
- **Evaluate after onboarding.** Review applications against new platform features periodically; a connector you built in phase 2 may have a standard replacement by phase 3.

Sources: [application management blog](https://www.sailpoint.com/blog/accelerating-application-onboarding-with-application-management) and [the connectivity workstream](https://community.sailpoint.com/knowledge/The-Connectivity-Workstream). Both are vendor material; the blog describes SailPoint's own services and tooling, so apply the ideas, not the sales pitch.

## Actions

- Build the tracker before the first outreach mail, with separate owner and technical contact columns.
- Send a questionnaire that asks about the mechanics (API, database, environments, JML, mandatory attributes), and record "don't know" answers as data.
- Agree what happens to applications that never answer.
- Use the same artefact trail for every application and write the effort heuristic into the plan.
- Do the hardest representative application first and turn it into the template.
- Keep a visible P1 and P2 backlog with a reason for each.
