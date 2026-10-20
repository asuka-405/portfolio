---
title: Program Setup, Scope and Governance
---

Most of the schedule risk on an ISC program is decided before anyone logs into a tenant. This page covers how to phase the work, what to write down as out of scope, how to run decisions and sign-offs, and the commercial and licensing questions that are easy to leave until they bite.

## Phase the program by capability, not by application count

The program was planned as two phases and that split held up.

| Phase | Goal | What was in it |
|---|---|---|
| 1 | Prove the platform end to end on the systems that matter most | Authoritative HR source, the main directory domains, about ten crown-jewel applications, joiner and leaver automation, role and criteria-based access, approval-based requests, certification campaigns, standard reports |
| 2 | Scale to the long tail | An application onboarding factory (see the onboarding page), 120 to 135 more applications, mover automation hardening, segregation-of-duties policies, operations and support service |

A few things worth copying:

- **Choose phase 1 applications on two criteria together: business criticality and pattern diversity.** Criticality decides the shortlist (the systems that hold client, financial or privileged data, where an access review or a fast leaver matters most). Diversity decides the final selection within it, so that you do not spend phase 1 on ten near-identical integrations. Ours covered a directory, an HR system, a REST application, several SQL Server applications and a SaaS finance product. By the end of phase 1 every integration pattern you will use in phase 2 has been exercised once, on systems the business cared about, which also bought the program credibility. Criticality alone gives you ten copies of the same hard problem; diversity alone gives you a showcase nobody needs.
- **Use cases are incremental.** The design document itself noted that no use case is "done" in a single phase. Maturity depends on how many applications and which connector types are live.
- **Mover is the hard one.** It was scoped for phase 2 and still arrived early in a limited form (location, country and region changes), because HR data changes on day one whether you are ready or not. Decide what the platform does on a mover event from the first day of production, even if the answer is "notify and do nothing else".

```html
<!-- dgm:phase1-selection -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 250" role="img" aria-labelledby="phase1-selection-t phase1-selection-d" xmlns="http://www.w3.org/2000/svg"><title id="phase1-selection-t">Choosing phase 1 applications</title><desc id="phase1-selection-d">All applications are narrowed by business criticality, then selected for pattern diversity to give the phase 1 set.</desc><defs><marker id="phase1-selection-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box " x="6" y="20.0" width="190" height="150" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="101.0" y="72.5" text-anchor="middle">Application inventory</text><text class="s" x="101.0" y="87.5" text-anchor="middle">every application with an</text><text class="s" x="101.0" y="100.5" text-anchor="middle">owner and a technical</text><text class="s" x="101.0" y="113.5" text-anchor="middle">contact</text><text class="m" x="101.0" y="126.5" text-anchor="middle">about 140</text><path class="ln accent  " d="M196,95 L212,95" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#phase1-selection-ar-accent)"/><rect class="box accent" x="212" y="31.0" width="190" height="128" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="307.0" y="72.5" text-anchor="middle">Criticality shortlist</text><text class="s" x="307.0" y="87.5" text-anchor="middle">client, financial or</text><text class="s" x="307.0" y="100.5" text-anchor="middle">privileged data. Audit and</text><text class="s" x="307.0" y="113.5" text-anchor="middle">access-failure impact</text><text class="m" x="307.0" y="126.5" text-anchor="middle">business criticality</text><path class="ln accent  " d="M402,95 L418,95" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#phase1-selection-ar-accent)"/><rect class="box gold" x="418" y="42.0" width="190" height="106" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="513.0" y="72.5" text-anchor="middle">Diversity pick</text><text class="s" x="513.0" y="87.5" text-anchor="middle">one or more per integration</text><text class="s" x="513.0" y="100.5" text-anchor="middle">pattern, so no pattern is</text><text class="s" x="513.0" y="113.5" text-anchor="middle">first met in phase 2</text><text class="m" x="513.0" y="126.5" text-anchor="middle">pattern diversity</text><path class="ln accent  " d="M608,95 L624,95" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#phase1-selection-ar-accent)"/><rect class="box teal" x="624" y="53.0" width="190" height="84" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="719.0" y="72.5" text-anchor="middle">Phase 1 set</text><text class="s" x="719.0" y="87.5" text-anchor="middle">proves every pattern on</text><text class="s" x="719.0" y="100.5" text-anchor="middle">systems the business cares</text><text class="s" x="719.0" y="113.5" text-anchor="middle">about</text><text class="m" x="719.0" y="126.5" text-anchor="middle">about 10</text><text class="h" x="6" y="206" text-anchor="start">PATTERNS COVERED IN PHASE 1</text><rect class="box blue" x="6" y="216" width="71" height="18" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="l" style="stroke:none;fill:var(--ink)" x="41.5" y="228.5" text-anchor="middle">directory</text><rect class="box blue" x="84.9" y="216" width="71" height="18" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="l" style="stroke:none;fill:var(--ink)" x="120.4" y="228.5" text-anchor="middle">HR system</text><rect class="box violet" x="163.8" y="216" width="114" height="18" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="l" style="stroke:none;fill:var(--ink)" x="220.6" y="228.5" text-anchor="middle">REST application</text><rect class="box violet" x="285.4" y="216" width="156" height="18" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="l" style="stroke:none;fill:var(--ink)" x="363.5" y="228.5" text-anchor="middle">SQL Server applications</text><rect class="box gold" x="449.69999999999993" y="216" width="138" height="18" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="l" style="stroke:none;fill:var(--ink)" x="518.7" y="228.5" text-anchor="middle">SaaS finance product</text></svg></div><figcaption><b>Two criteria, in order.</b> Criticality builds the shortlist; diversity decides the final selection inside it.</figcaption></figure>
```

## Write out of scope as carefully as in scope

The approved design listed exclusions explicitly. Each one came back as a question during the program, so having them in writing saved real arguments.

| Excluded | What happened later |
|---|---|
| Service, functional and bot account governance | A separate service-account governance proposal followed (inventory, ownership, dashboard) once the core platform was stable |
| External identities and client-facing systems | Requests arrived for client users on several applications; the answer was "not in this program" and one requirements document recorded it explicitly |
| Authentication and single sign-on tooling | Handled by the client's own teams; SSO to the ISC tenant itself still had to be configured and tested |
| Privileged credentials | Left with the vault product; one risk entry concerned who stores integration credentials in it |
| Password management and sync | Out of scope, which mattered because initial passwords still had to be generated for joiners |
| Custom connector development, UI customisation, code-level branding | Only out-of-the-box connectors and features; everything custom is a rule, workflow or form |
| Data cleansing, migration and reconciliation | The client owns data fixes, but the program still had to quantify the problem (see the identity model page) |
| User acceptance test management | The client runs UAT; the integrator supports it |
| Non-functional testing | Not performed |
| Custom reports | Only out-of-the-box reports and search exports |
| Sandbox and UAT identities | No governance of non-production identities |

For each exclusion, also write down the **intake route**. "Out of scope" is not an answer for the requester; "raise it here and it goes to the backlog" is.

## Decide the approach: lift and shift or redesign

The client's existing process for several applications was ticket-driven: a manager raised an ITSM ticket and an application team provisioned manually. For some applications the program deliberately **lifted and shifted** that process, keeping the ITSM ticket as the trigger and using ISC only to execute the access.

That is a legitimate choice, but it moves risk rather than removing it:

- Two approvals existed (the ITSM ticket and the ISC request). By agreement the ISC approval was removed for one application. Because the request center is visible to the whole company, the risk register recorded that an illegitimate user could in principle request elevated access. The mitigation has to be designed, for example by making the request entry point a launcher form visible only to the operations team (see the forms page).
- Lift and shift keeps the human bottleneck. It is fine for phase 1 and should be a conscious backlog item to remove later.

Record the decision, the residual risk and the mitigation in the RAID log at the time you make it.

## Governance cadence that worked

| Mechanism | Use |
|---|---|
| Weekly delivery follow-up | Tasks, blockers, next steps per application |
| Monthly high-level status | Progress, change requests, decisions needed |
| RACI | Who is responsible, accountable, consulted, informed, per deliverable |
| Decision matrix (PACE style) | Who proposes, approves, consults and executes a decision, so decisions do not stall |
| RAID log | Risks, assumptions, issues, dependencies. Reused as the hypercare issue log |
| Technical design authority review | A gate on the design before build |
| Change advisory board per application | Opened ahead of cutover, one change record per application |

Practical notes:

- **Stakeholder register early.** Business owner, technical owner, infrastructure contact and functional contact are four different people per application. Missing any of them stalls onboarding.
- **Sign-off discipline.** Every application had a requirements document that needed sign-off, then a demo, then a design document. Sign-off threads needed repeated chasing and "urgent approval required" subject lines. Put a sign-off deadline in the plan and name a deputy who may sign.
- **Scope changes belong in the document.** When a stakeholder said client-user provisioning was not in scope, the requirement document was updated in the same thread. That sentence prevented a later dispute.
- **Keep the integrator out of UAT ownership.** The go-live checklist itself said the person who runs the pre-UAT check should not be the implementer.

## Roles you need

| Role | Notes |
|---|---|
| Sponsor and accountable owner | Removes organisational blockers |
| Project manager | Plan, RAID, comms, change records |
| Solution architect | Owns the design document and pattern choices |
| ISC engineers | Source, rule, workflow and form build |
| Directory and mail specialist | AD, Exchange and licensing side effects of lifecycle events |
| HR system owner | Data quality, new fields, the termination date process |
| Application owners and technical SPOCs | Requirements, lower environments, test, sign-off |
| ITSM owner | Queues, mailboxes and templates that ISC mails into |
| Security and risk | Reviews secrets handling, access model, campaign design |
| Local IT contacts per country | Receive joiner and leaver notifications; need data upkeep |

## Assumptions to write down on day one

Every one of these became a real problem when left implicit:

1. Lower environments exist for each in-scope application and the integrator can reach them.
2. A service account with sufficient but not excessive rights can be created for ISC on each target.
3. Network paths from the VA clusters to every target are open, including ports and DNS.
4. HR can change its process (mandatory fields, termination date handling, rehire rule) and will.
5. Application owners are the right people to approve access, and they know it.
6. Notification mailboxes, ITSM assignment queues and distribution lists are created before testing, not during.
7. Joiner lead time is long enough (the design used 14 days before start) for managers to act.
8. Vendors of SaaS applications will expose APIs for user management, or the fall-back is a flat file.

## Licensing and counts

- **Identity count versus licensed users.** The authoritative feed brought in about 43,000 identities for a workforce of roughly 13,000 because historical leavers lived in the HR system. Ask SailPoint exactly how identities are counted for licensing, and decide whether to filter old leavers in the HR query rather than carry them forever. Both the identity profile count and the licensed registered-user cap are in the tenant API, and they were far apart.
- **Product modules.** Confirm which modules are licensed before designing around them. In our tenant the generic approval workflow action was not licensed (it saved but failed to enable), segregation of duties policies were empty, and several admin APIs returned not-available responses. Treat unlicensed capabilities as out of scope in the design rather than discovering them during build.
- **Sandbox is not production.** Plan for the sandbox tenant to be used for build and the production tenant for operations only. Identities in the sandbox are out of scope for governance.

## Estimating effort per application

For a JDBC application with a clear schema the integration team used this shape, which turned out to be realistic:

| Stage | Effort shape |
|---|---|
| Requirement gathering | 3 to 5 working sessions, plus access and DB connection details up front |
| Build and configuration | Integrator-led, light dependency on the application team |
| System integration testing | 3 to 5 sessions to validate data |
| User acceptance testing and sign-off | Client-led, with test results shared for sign-off |
| Production deployment | 1 to 2 sessions, repeating the same steps as lower environments |

REST integrations with token handling, pagination or custom endpoints are heavier; budget the first of each pattern at several times the repeat cost.

## How this compares with SailPoint's own phased path

SailPoint publishes a [phased approach to identity security](https://community.sailpoint.com/knowledge/A-phased-approach-to-identity-security) that is a useful sanity check on any plan. Checked against our program in October 2026:

| SailPoint's phase | Their guidance | What we did |
|---|---|---|
| 1. Foundational governance | Connect the authoritative HR system, model identities, connect core directories, **verify and correct data before relying on it**, run targeted certifications | Same order. The data correction step was where we under-planned (see the identity model and go-live pages) |
| 2. Expansion and lifecycle | Contractors and other non-employees next, then critical applications, then joiner, mover, leaver automation | We folded joiner and leaver into phase 1 and left movers for phase 2. Contractors were part of the HR feed; we did not evaluate a separate non-employee product |
| 3. Activity and machines | Activity data, machine and service-account discovery | Out of scope. Service accounts became a separate governance proposal |
| 4. Access modelling and requests | Role-based access, request workflows, service desk and collaboration integrations | Overlapped phase 1 and 2 |
| 5. Cloud, data and privileged | Cloud infrastructure entitlements, data access, privileged integration | Out of scope by design |
| 6. Maturity | On-premises servers and databases, separation of duties, periodic strategy review | Separation of duties was a phase 2 item |

Two things to take from the comparison. First, SailPoint's own advice agrees that **data verification precedes certifications**, which matches our experience. Second, it names contractors and non-employees as an explicit early step. If your workforce includes many, decide on day one whether they come through the HR feed, a non-employee lifecycle product or a flat file.

```html
<!-- dgm:phase-path -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 330" role="img" aria-labelledby="phase-path-t phase-path-d" xmlns="http://www.w3.org/2000/svg"><title id="phase-path-t">SailPoint&#x27;s phased path against the program</title><desc id="phase-path-d">Six recommended phases and where the program covered each one.</desc><defs><marker id="phase-path-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="phase-path-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box accent" x="6" y="10" width="252" height="112" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="132.0" y="43.5" text-anchor="middle">1  Foundational governance</text><text class="s" x="132.0" y="58.5" text-anchor="middle">HR source, identity model, core</text><text class="s" x="132.0" y="71.5" text-anchor="middle">directories, verify data, first</text><text class="s" x="132.0" y="84.5" text-anchor="middle">reviews</text><text class="m" x="132.0" y="97.5" text-anchor="middle">program: phase 1</text><path class="ln accent  " d="M258,66.0 L286,66.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#phase-path-ar-accent)"/><rect class="box accent" x="286" y="10" width="252" height="112" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="412.0" y="50.0" text-anchor="middle">2  Expansion and lifecycle</text><text class="s" x="412.0" y="65.0" text-anchor="middle">Contractors, critical applications,</text><text class="s" x="412.0" y="78.0" text-anchor="middle">joiner, mover, leaver automation</text><text class="m" x="412.0" y="91.0" text-anchor="middle">program: phases 1 and 2</text><path class="ln accent  " d="M538,66.0 L566,66.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#phase-path-ar-accent)"/><rect class="box ghost" x="566" y="10" width="252" height="112" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="692.0" y="50.0" text-anchor="middle">3  Activity and machines</text><text class="s" x="692.0" y="65.0" text-anchor="middle">Activity data, machine and service</text><text class="s" x="692.0" y="78.0" text-anchor="middle">accounts</text><text class="m" x="692.0" y="91.0" text-anchor="middle">program: out of scope</text><rect class="box gold" x="6" y="162" width="252" height="112" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="132.0" y="194.5" text-anchor="middle">4  Access modelling and</text><text class="t" x="132.0" y="209.5" text-anchor="middle">requests</text><text class="s" x="132.0" y="224.5" text-anchor="middle">Roles, request workflows, service</text><text class="s" x="132.0" y="237.5" text-anchor="middle">desk integration</text><text class="m" x="132.0" y="250.5" text-anchor="middle">program: phases 1 and 2</text><path class="ln accent  " d="M258,218.0 L286,218.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#phase-path-ar-accent)"/><rect class="box ghost" x="286" y="162" width="252" height="112" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="412.0" y="202.0" text-anchor="middle">5  Cloud, data and privileged</text><text class="s" x="412.0" y="217.0" text-anchor="middle">Cloud entitlements, data access,</text><text class="s" x="412.0" y="230.0" text-anchor="middle">privileged integration</text><text class="m" x="412.0" y="243.0" text-anchor="middle">program: out of scope</text><path class="ln   " d="M538,218.0 L566,218.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#phase-path-ar)"/><rect class="box gold" x="566" y="162" width="252" height="112" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="692.0" y="202.0" text-anchor="middle">6  Maturity</text><text class="s" x="692.0" y="217.0" text-anchor="middle">On-premises servers and databases,</text><text class="s" x="692.0" y="230.0" text-anchor="middle">separation of duties, strategy review</text><text class="m" x="692.0" y="243.0" text-anchor="middle">program: phase 2</text><path class="ln accent  " d="M692.0,122 L692.0,140 L132.0,140 L132.0,162" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#phase-path-ar-accent)"/><text class="l" x="410" y="318" text-anchor="middle">Filled boxes were in the program. Dashed boxes were deliberately left out.</text></svg></div><figcaption><b>The six phases.</b> Structure follows SailPoint's published phased approach; the tags show where the program sat against it.</figcaption></figure>
```

### Prioritisation criteria from SailPoint

The [connectivity workstream guidance](https://community.sailpoint.com/knowledge/The-Connectivity-Workstream) says to evaluate each application on three things: its **priority to the business**, its **impact** (how critical it is to operations and how much access control it holds) and its **readiness for integration**. It also advises integrating directories and single sign-on first, then applications in manageable phases, and it warns that unknown ownership and missing information are the main reasons onboarding stalls. That is the same two-criteria shape we used, with readiness made explicit. A vendor blog on [application management](https://www.sailpoint.com/blog/accelerating-application-onboarding-with-application-management) adds that teams often choose by resource availability or ease, and argues for choosing by sensitivity and criticality instead, because **all applications need governance but not all need the same level of it**.

A practical scoring sheet, combining the three criteria with ours:

| Criterion | Question | Weight it when... |
|---|---|---|
| Business criticality | Would an access failure here hurt revenue, clients or compliance? | Always. It sets the shortlist |
| Data sensitivity | Does it hold client, financial or personal data? | Audit or regulators are watching |
| Pattern diversity | Does it exercise a connector pattern the program has not yet proven? | Phase 1, and the first wave of any phase |
| Readiness | Is there an API or readable database, an owner and a technical contact? | You need early wins |

## Actions

- Agree phase scope by capability and write the out-of-scope list with intake routes.
- Create the stakeholder register with four contacts per application.
- Open the RAID log in week one and keep it as the hypercare log.
- Record every lift-and-shift decision with its residual risk.
- Ask SailPoint how licensing counts identities and which modules are included.
