---
title: Testing, Migration and Go-Live
---

The cutover was uneventful because most of the risk had been moved earlier into a rollout plan, a staged attribute switch-on and a data reconciliation. This page describes that plan, the order of its steps, what does and does not migrate between tenants, and the data problems that had to be cleared before the HR feed could be trusted in production.

## Shape of the rollout plan

The plan was a spreadsheet of numbered tasks with an owner, a status and a dependency. Its phases, in order:

1. **User acceptance testing.** One cycle per application, with a sign-off. A pre-UAT check was done by someone other than the implementer.
2. **Communications.** An organisation-wide mail, an application-specific mail, an FAQ, a one-sheet and an enablement deck.
3. **Change process.** One change record per application through the change advisory board.
4. **Pre go-live in production.** Deploy the production tenant, create break-glass administrators, connect the virtual appliances, run a health scan, configure the HR source, identity profile and transforms, configure and validate single sign-on.
5. **Migration of configuration.** Transforms and rules, email templates, system configuration, branding, access profiles, roles and applications, governance groups and workflows, then the non-authoritative sources.
6. **Aggregation and correlation analysis in production.**
7. **Cutover day.** A production sanity test of one joiner and one leaver, a go or no-go decision, a rollback decision point and a soft go-live announcement.
8. **Staged mover and attribute sync.** See below.

Two things made this sequence work. Everything that could be verified without users (connectivity, data, correlation) was verified before communications went out, and the rollback decision was written down in advance, with an owner.

## Testing

### What to test, in order

| Layer | Test | Evidence |
|---|---|---|
| Connectivity | Each VA reaches each source; cluster status is healthy | VA health scan |
| Aggregation | Account counts match the source; groups aggregated before accounts | Counts per source |
| Correlation | Correlation rate per source; list of uncorrelated accounts reviewed | Uncorrelated report |
| Lifecycle | One joiner, one mover, one leaver, one rehire per source | Test cases with before and after |
| Provisioning | Create, enable, disable, group add and remove per connector, run for real | Source-side screenshot or query |
| Requests | Each access profile requested, approved, fulfilled, revoked | Request IDs |
| Forms and workflows | Every path, including denial and timeout | Execution log |
| Notifications | Every template to the right recipient in each environment | Mail samples |

### Test environment realities

- **Sandbox maps to the lower application environments, and production to production.** JDBC URLs, database names, API endpoints and literals inside rules all differ. Keep an environment table and review it at promotion time.
- **Mail routing differs per environment.** In sandbox, redirect all notifications to a test mailbox. In production, make sure the redirect is off. A notification matrix (template, trigger, recipient, environment) pays for itself.
- **Pre-UAT checks should not be done by the implementer.** The implementer knows which cases to avoid.
- **Test with data that looks like production.** Joiners with long names, apostrophes, double spaces, missing managers, rehires and employees on two contracts exposed more bugs than clean test data.

### Evidence of a UAT sign-off

Record the application, the version of the design document, the test cases, the result of each, the issues and their disposition, and the name and date of the approver. We kept it per application so the approval was not a single "everything is fine" mail.

## Migration between tenants

Config Hub was used to move configuration, and its limits shaped the plan.

- **Weekly automated backups and manual full backups** were present and are cheap insurance. Take a manual full backup immediately before any cutover step.
- **A draft deploy** was used to move forms.
- **Source secrets do not move.** Expect to re-enter every credential in production. Make it a checklist item per source and treat it as the moment to issue production-specific credentials.
- **VAs and clusters are per tenant.** They must be built and connected in production; they are not migrated.
- **Environment-specific values** (connection strings, host names, database names, rule literals) must be changed after the deploy and before the first aggregation. Search exported rules for sandbox hostnames.
- **Order matters:** transforms and rules first, then templates and system configuration, then access profiles, roles and applications, then governance groups and workflows, then sources that are not authoritative.

```html
<!-- dgm:confighub-flow -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 300" role="img" aria-labelledby="confighub-flow-t confighub-flow-d" xmlns="http://www.w3.org/2000/svg"><title id="confighub-flow-t">Moving configuration between tenants</title><desc id="confighub-flow-d">Backup the source, build a draft that compares with the target, edit it, then deploy. Secrets, appliances and some objects do not travel.</desc><defs><marker id="confighub-flow-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box blue" x="6" y="20" width="140" height="80" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="76.0" y="44.0" text-anchor="middle">Source tenant</text><text class="s" x="76.0" y="59.0" text-anchor="middle">sandbox,</text><text class="s" x="76.0" y="72.0" text-anchor="middle">configuration as</text><text class="s" x="76.0" y="85.0" text-anchor="middle">built</text><rect class="box " x="174" y="20" width="140" height="80" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="244.0" y="50.5" text-anchor="middle">Backup</text><text class="s" x="244.0" y="65.5" text-anchor="middle">manual, up to 10;</text><text class="s" x="244.0" y="78.5" text-anchor="middle">5,000 objects</text><rect class="box violet" x="342" y="20" width="140" height="80" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="412.0" y="44.0" text-anchor="middle">Draft</text><text class="s" x="412.0" y="59.0" text-anchor="middle">compared with the</text><text class="s" x="412.0" y="72.0" text-anchor="middle">live target,</text><text class="s" x="412.0" y="85.0" text-anchor="middle">editable</text><rect class="box accent" x="510" y="20" width="140" height="80" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="580.0" y="50.5" text-anchor="middle">Deploy</text><text class="s" x="580.0" y="65.5" text-anchor="middle">adds and updates;</text><text class="s" x="580.0" y="78.5" text-anchor="middle">does not delete</text><rect class="box teal" x="678" y="20" width="140" height="80" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="748.0" y="57.0" text-anchor="middle">Target tenant</text><text class="s" x="748.0" y="72.0" text-anchor="middle">production</text><path class="ln   " d="M146,60.0 L174,60.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#confighub-flow-ar)"/><path class="ln   " d="M314,60.0 L342,60.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#confighub-flow-ar)"/><path class="ln   " d="M482,60.0 L510,60.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#confighub-flow-ar)"/><path class="ln   " d="M650,60.0 L678,60.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#confighub-flow-ar)"/><rect class="grp gold" x="0" y="130" width="820" height="160" style="fill:none;stroke:var(--gold);stroke-opacity:0.65;stroke-dasharray:6 4"/><text class="h" x="10" y="145" text-anchor="start">What does not move</text><rect class="box gold" x="14" y="158" width="250" height="114" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="139.0" y="199.0" text-anchor="middle">Secrets and credentials</text><text class="s" x="139.0" y="214.0" text-anchor="middle">never exported. Re-enter them on</text><text class="s" x="139.0" y="227.0" text-anchor="middle">every source, and use the moment to</text><text class="s" x="139.0" y="240.0" text-anchor="middle">issue production credentials</text><rect class="box gold" x="284" y="158" width="250" height="114" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="409.0" y="199.0" text-anchor="middle">Appliances and clusters</text><text class="s" x="409.0" y="214.0" text-anchor="middle">per tenant. Build and connect them in</text><text class="s" x="409.0" y="227.0" text-anchor="middle">the target before the first</text><text class="s" x="409.0" y="240.0" text-anchor="middle">aggregation</text><rect class="box gold" x="554" y="158" width="252" height="114" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="680.0" y="192.5" text-anchor="middle">Silently skipped</text><text class="s" x="680.0" y="207.5" text-anchor="middle">unsupported object types are skipped</text><text class="s" x="680.0" y="220.5" text-anchor="middle">and the import still reports</text><text class="s" x="680.0" y="233.5" text-anchor="middle">COMPLETE. Non-employee sources cannot</text><text class="s" x="680.0" y="246.5" text-anchor="middle">be deployed</text></svg></div><figcaption><b>Promotion path.</b> Take a manual full backup before any cutover step, preview an import first, and diff an export afterwards.</figcaption></figure>
```

## Data reconciliation before the HR feed goes live

The first aggregation of production data is when historical neglect becomes visible. Findings before cutover:

- **More than 1,300 directory accounts had no employee id,** so they could not be correlated. Treat that as a data clean-up to finish before the HR source is switched on, rather than a correlation rule that guesses.
- **The HR system carried years of historical leavers,** which is why the tenant held about 43,000 identities for a workforce of about 13,000. Decide at design time how to treat them (exclude by population filter, or include as inactive). See the identity model page.
- **A data issues workbook and a production data analysis** were kept as living artefacts, listing each issue, its owner and its status. Do not start cutover with items open and unowned.
- **Duplicate, double-space and case-differing names** in the directory surfaced as account creation failures and correlation misses afterwards. Normalise or at least list them.

## Cutover day

### Before

This checklist combines what the rollout plan contained with what we would add; the plan itself listed break-glass administrators, VA connection and health scan, HR source configuration, single sign-on validation, the service-management mailbox and the approval groups.

- Break-glass administrators exist, are tested and are documented.
- VA health scan is green on every cluster.
- HR source, identity profile and transforms are configured and validated against a sample.
- Single sign-on is validated.
- Notification templates are deployed and mail routing is set for production.
- An IT service management mailbox and assignment group exist, and the integrator has queue access.
- Governance groups and approval groups exist.

### During

1. Aggregate the HR source and review counts.
2. Aggregate the directories and review correlation and uncorrelated lists.
3. Run the sanity test: one joiner, one leaver, end to end in production.
4. Go or no-go with named decision makers.
5. If go, announce a soft go-live.
6. If no-go, execute the rollback written into the plan. Our plan named the decision point and its owner; the mechanics (what to disable, what to restore from the pre-cutover backup) are yours to define and rehearse.

### After

- Nightly search exports of joiners and leavers for the first weeks, reviewed by the team. These were the earliest signal of data problems and were also the evidence base for hypercare.
- Recommended, not observed: a daily check-in with the service desk and a change freeze except for fixes.

## Staged attribute sync

Switching on attribute sync from HR to the directory and applications was the highest-risk step because it writes to live accounts for thousands of people. We did it in stages:

1. The plan covered **ten attributes only.**
2. **Location and country first,** since location drives birthright access.
3. **The remaining attributes in groups of at most two,** over about ten days.
4. **Validate between steps** with a before and after sample.
5. **Switch off on data issues** and roll back the last step.

This is the cheapest rollback available. A staged switch-on turns a mass update into a series of small ones with a known last step.

```html
<!-- dgm:attr-sync-stages -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 290" role="img" aria-labelledby="attr-sync-stages-t attr-sync-stages-d" xmlns="http://www.w3.org/2000/svg"><title id="attr-sync-stages-t">Staged switch-on of attribute sync</title><desc id="attr-sync-stages-d">Ten attributes enabled in five steps over about ten days, with validation between steps and a rollback to the last step.</desc><defs><marker id="attr-sync-stages-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="attr-sync-stages-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box teal" x="20" y="150" width="120" height="40" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="80" y="168" text-anchor="middle">2 attributes</text><text class="s" x="80" y="184" text-anchor="middle">location, country</text><text class="h" x="80" y="208" text-anchor="middle">step 1</text><path class="ln accent  " d="M140,160 L170,160" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#attr-sync-stages-ar-accent)"/><circle class="badge" cx="155" cy="140" r="9"/><text class="badge-t" x="155" y="143.6" text-anchor="middle">✓</text><rect class="box teal" x="170" y="122" width="120" height="68" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="230" y="140" text-anchor="middle">4 attributes</text><text class="s" x="230" y="156" text-anchor="middle">two more</text><text class="h" x="230" y="208" text-anchor="middle">step 2</text><path class="ln accent  " d="M290,160 L320,160" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#attr-sync-stages-ar-accent)"/><circle class="badge" cx="305" cy="140" r="9"/><text class="badge-t" x="305" y="143.6" text-anchor="middle">✓</text><rect class="box teal" x="320" y="94" width="120" height="96" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="380" y="112" text-anchor="middle">6 attributes</text><text class="s" x="380" y="128" text-anchor="middle">two more</text><text class="h" x="380" y="208" text-anchor="middle">step 3</text><path class="ln accent  " d="M440,160 L470,160" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#attr-sync-stages-ar-accent)"/><circle class="badge" cx="455" cy="140" r="9"/><text class="badge-t" x="455" y="143.6" text-anchor="middle">✓</text><rect class="box teal" x="470" y="66" width="120" height="124" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="530" y="84" text-anchor="middle">8 attributes</text><text class="s" x="530" y="100" text-anchor="middle">two more</text><text class="h" x="530" y="208" text-anchor="middle">step 4</text><path class="ln accent  " d="M590,160 L620,160" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#attr-sync-stages-ar-accent)"/><circle class="badge" cx="605" cy="140" r="9"/><text class="badge-t" x="605" y="143.6" text-anchor="middle">✓</text><rect class="box accent" x="620" y="38" width="120" height="152" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="680" y="56" text-anchor="middle">10 attributes</text><text class="s" x="680" y="72" text-anchor="middle">last two</text><text class="h" x="680" y="208" text-anchor="middle">step 5</text><text class="s" x="60" y="236" text-anchor="start">after each step: compare a before and after sample, and switch off on data issues</text><path class="ln gold dash " d="M780,230 L780,266 L60,266" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#attr-sync-stages-ar-gold)"/><text class="l" x="420" y="260" text-anchor="middle">rollback to the last good step</text><text class="l" x="790" y="26" text-anchor="end">about ten days</text></svg></div><figcaption><b>Cheapest rollback.</b> Location and country first, because location drives birthright access; the rest in groups of at most two.</figcaption></figure>
```

## Application waves

Applications went live in waves, not on one day:

1. Directory and HR first.
2. Then the service management and client-facing tools.
3. Then the finance and investor systems.
4. The most sensitive client system last, about three weeks after the others.

The ordering rule was **dependencies first, risk last.** Each wave had its own change record, communication, UAT sign-off and rollback.

## Communications

- Org-wide mail ahead of cutover, application-specific mails per wave.
- An FAQ and a one-sheet for managers, because managers carry the load of the new forms.
- An enablement deck for the service desk.
- A named mailbox for questions that is staffed.

Notifications deserve their own review. After go-live the team made seven changes to email notifications, all to fix who received what. See the hypercare page.

## What SailPoint's documentation adds

From the [SaaS configuration reference](https://developer.sailpoint.com/docs/extensibility/configuration-management/saas-configuration/) and the [Config Hub backup documentation](https://documentation.sailpoint.com/saas/help/confighub/config_hub_backup.html), October 2026.

### Config Hub facts

- **Backups.** SailPoint backs up the production tenant weekly and keeps up to five. You can keep **up to ten manual backups** (delete one to add another), and a backup or draft holds **up to 5,000 objects** unless support raises it. Only manual backups can be deleted.
- **Secrets are never included.** After a restore or deploy of sources, re-enter every secret and credential.
- **Restore means draft then deploy.** You create a draft comparing a backup with the live tenant, optionally edit it, then deploy. Check the green dot that marks the live target before deploying, because the list can show several tenants.
- **Deploy does not delete.** Objects that exist in the target but not in the draft stay.
- **Supported objects** include access profiles, roles, access request configuration, attribute sync source configuration, campaign filters, connector rules and rules, form definitions, governance groups, identity profiles, lifecycle states, notification templates, password policies, segments, separation of duties policies, service desk integrations, sources, tags, transforms, trigger subscriptions and workflows. **Import through the API is narrower than deploy:** only sources, identity profiles, rules, connector rules, transforms, trigger subscriptions and identity object configuration can be imported.
- **Unsupported types are skipped silently.** An import containing them still ends `COMPLETE`, with no warning naming what was skipped. Do not read `COMPLETE` as "everything moved". Use `preview=true` on the import to see reference and resolution errors first.
- **Non-employee sources cannot be imported or deployed.** Deploying one creates a standard source in the target, which can cause trouble.
- **Cloud rules cannot be modified in migration,** because they are signed. Connector rules need no review.
- **Objects that reference others by ID** may not resolve in the target tenant. Edit the draft before deploying.

### Replacing the HR system

If the HR platform changes around your go-live, follow SailPoint's sequence on the identity model page: move the HR system first, onboard the new source separately, create a mirrored identity profile, and migrate lifecycle state and other access-driving attributes last.

### Readiness before the first working session

SailPoint asks for the network team at the connectivity kick-off and for the HR and directory owners. Have the VA count, placement and network method decided before the call. See the architecture page.

## Actions

- Write the rollout plan as numbered tasks with owners, dependencies and a rollback decision point.
- Keep sandbox and production environment tables, and review them at every promotion.
- Re-enter source credentials in production as new credentials.
- Clear identity data problems (no employee id, duplicates, historical leavers) before the first production aggregation.
- Switch on attribute sync in stages of one or two attributes, with validation and a rollback between steps.
- Take a full backup before cutover, and run nightly joiner and leaver exports for the first weeks.
- Go live in waves, dependencies first and the most sensitive system last.
