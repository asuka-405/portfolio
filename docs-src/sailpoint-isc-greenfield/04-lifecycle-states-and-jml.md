---
title: Lifecycle States and Joiner Mover Leaver Automation
---

Joiner, mover and leaver (JML) is the visible face of the program. This page describes how the automation was built from lifecycle states, event-triggered workflows, manager forms and scheduled jobs, and the places where it needed human help.

## The lifecycle model

The HR-driven identity profile had five lifecycle states, all driven by the computed `cloudLifecycleState` attribute described on the identity model page.

| State | Meaning | Account action |
|---|---|---|
| Pre Joiner | Hired, not yet started | Enable the directory accounts |
| Active | Employed | Enable the directory accounts |
| Intermediate | Anything that fits no other rule | None |
| Inactive | Employment ended (end date reached at 22:00 local) | Disable on a list of sources |
| Emergency Termination | Manual immediate cut-off | Disable on the directory sources |

```html
<!-- dgm:lifecycle-states -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 300" role="img" aria-labelledby="lifecycle-states-t lifecycle-states-d" xmlns="http://www.w3.org/2000/svg"><title id="lifecycle-states-t">Lifecycle states and the actions on each</title><desc id="lifecycle-states-d">Pre joiner, active, inactive, with intermediate for anything else and emergency termination as a manual cut-off.</desc><defs><marker id="lifecycle-states-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="lifecycle-states-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="lifecycle-states-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box blue" x="6" y="40" width="168" height="78" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="90.0" y="69.5" text-anchor="middle">Pre Joiner</text><text class="s" x="90.0" y="84.5" text-anchor="middle">hired, not started</text><text class="m" x="90.0" y="97.5" text-anchor="middle">enable directory accounts</text><rect class="box teal" x="232" y="40" width="168" height="78" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="316.0" y="69.5" text-anchor="middle">Active</text><text class="s" x="316.0" y="84.5" text-anchor="middle">employed</text><text class="m" x="316.0" y="97.5" text-anchor="middle">enable directory accounts</text><rect class="box gold" x="458" y="40" width="168" height="78" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="542.0" y="63.0" text-anchor="middle">Inactive</text><text class="s" x="542.0" y="78.0" text-anchor="middle">end date reached, 22:00</text><text class="s" x="542.0" y="91.0" text-anchor="middle">local</text><text class="m" x="542.0" y="104.0" text-anchor="middle">disable on listed sources</text><path class="ln teal  " d="M174,79.0 L232,79.0" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#lifecycle-states-ar-teal)"/><text class="l" x="203" y="76" text-anchor="middle">start</text><path class="ln gold  " d="M400,79.0 L458,79.0" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#lifecycle-states-ar-gold)"/><text class="l" x="429" y="76" text-anchor="middle">end date</text><path class="ln teal dash " d="M542,40 L542,18 L316,18 L316,40" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#lifecycle-states-ar-teal)"/><text class="l" x="429" y="13" text-anchor="middle">rehire</text><rect class="box " x="232" y="170" width="168" height="70" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="316.0" y="195.5" text-anchor="middle">Intermediate</text><text class="s" x="316.0" y="210.5" text-anchor="middle">fits no other rule</text><text class="m" x="316.0" y="223.5" text-anchor="middle">no account action</text><path class="ln  dash " d="M316,118 L316,170" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#lifecycle-states-ar)"/><rect class="box accent" x="650" y="40" width="164" height="78" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="732.0" y="55.5" text-anchor="middle">Emergency</text><text class="t" x="732.0" y="70.5" text-anchor="middle">termination</text><text class="s" x="732.0" y="85.5" text-anchor="middle">manual cut-off, any</text><text class="s" x="732.0" y="98.5" text-anchor="middle">time</text><text class="m" x="732.0" y="111.5" text-anchor="middle">disable directory sources</text><rect class="box ghost" x="6" y="170" width="168" height="70" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="90.0" y="195.5" text-anchor="middle">Account created</text><text class="s" x="90.0" y="210.5" text-anchor="middle">14 days before start, in</text><text class="s" x="90.0" y="223.5" text-anchor="middle">the user&#x27;s time zone</text><path class="ln  dash " d="M90,118 L90,170" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;stroke-dasharray:5 4;"/><rect class="box ghost" x="458" y="170" width="356" height="70" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="636.0" y="195.5" text-anchor="middle">Lifecycle action source lists are explicit</text><text class="s" x="636.0" y="210.5" text-anchor="middle">a source not on the list is not disabled. Check every</text><text class="s" x="636.0" y="223.5" text-anchor="middle">new source</text><text class="l" x="410" y="280" text-anchor="middle">State is computed by a cloud rule from HR status, end date and the person&#x27;s time zone.</text></svg></div><figcaption><b>Five states.</b> The action attached to each state names its target sources by identifier, so adding a source means adding it to the list.</figcaption></figure>
```

### The lifecycle action source list is explicit

This is the most expensive caveat in this section. Each lifecycle state action names its **target sources by ID**. At the end of the program the `Inactive` disable action covered **13 of 146 sources**: the directories and the earliest crown-jewel applications. Sources added later were **not** on the list, including some with no other disable path.

That is not necessarily wrong. Several later applications were handled by compensating mechanisms, for example a scheduled workflow that disables accounts in a payroll SaaS on a half-month calendar, or a manual leaver process. But it has to be a decision, not an accident.

Make this a standing checklist item for every new source:

1. Is the source account-managed by ISC (it can disable accounts)?
2. If yes, is it on the Inactive and Emergency Termination action lists?
3. If no, what disables or reviews access for a leaver, and who owns it?

There is also an organisation setting that controls whether a lifecycle change honours a source's own "can enable" feature flag. It was off. Know its value before you assume lifecycle actions are skipped for sources that cannot enable accounts.

```html
<!-- dgm:jml-general -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 430" role="img" aria-labelledby="jml-general-t jml-general-d" xmlns="http://www.w3.org/2000/svg"><title id="jml-general-t">Joiner, mover and leaver data flow</title><desc id="jml-general-d">HR changes are imported hourly, evaluated by rules, and drive directory and application changes; the login and email are written back to HR.</desc><defs><marker id="jml-general-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="jml-general-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="jml-general-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="jml-general-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="grp " x="0" y="6" width="820" height="76" style="fill:none;stroke:var(--text);stroke-opacity:0.28;stroke-dasharray:6 4"/><text class="h" x="10" y="21" text-anchor="start">HR system</text><rect class="grp accent" x="0" y="98" width="820" height="218" style="fill:none;stroke:var(--accent);stroke-opacity:0.6;stroke-dasharray:6 4"/><text class="h" x="10" y="113" text-anchor="start">ISC</text><rect class="grp " x="0" y="334" width="820" height="90" style="fill:none;stroke:var(--text);stroke-opacity:0.28;stroke-dasharray:6 4"/><text class="h" x="10" y="349" text-anchor="start">Directories and applications</text><rect class="box " x="30" y="28" width="240" height="44" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="150.0" y="47.0" text-anchor="middle">HR records the event</text><text class="s" x="150.0" y="62.0" text-anchor="middle">hire, change or termination</text><rect class="box blue" x="30" y="126" width="150" height="52" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="105.0" y="142.5" text-anchor="middle">Scheduled import</text><text class="s" x="105.0" y="157.5" text-anchor="middle">pulled every 60</text><text class="s" x="105.0" y="170.5" text-anchor="middle">minutes</text><path class="ln   " d="M105,72 L105,126" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#jml-general-ar)"/><polygon class="box gold" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1" points="262,115.0 327.0,152 262,189.0 197.0,152"/><text class="s" style="fill:var(--ink);font-weight:700" x="262" y="149.5" text-anchor="middle">Employee ID</text><text class="s" style="fill:var(--ink);font-weight:700" x="262" y="161.5" text-anchor="middle">known?</text><path class="ln   " d="M180,152.0 L197,152" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#jml-general-ar)"/><rect class="box accent" x="360" y="112" width="160" height="46" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="440.0" y="132.0" text-anchor="middle">Create identity</text><text class="s" x="440.0" y="147.0" text-anchor="middle">joiner</text><rect class="box gold" x="360" y="182" width="160" height="46" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="440.0" y="202.0" text-anchor="middle">Update identity</text><text class="s" x="440.0" y="217.0" text-anchor="middle">mover or leaver</text><path class="ln accent  " d="M327,152 L343,152 L343,135 L360,135" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#jml-general-ar-accent)"/><text class="l" x="340" y="128" text-anchor="end">no</text><path class="ln gold  " d="M262,189 L262,205 L360,205" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#jml-general-ar-gold)"/><text class="l" x="310" y="200" text-anchor="middle">yes</text><rect class="box blue" x="590" y="140" width="200" height="70" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="690.0" y="165.5" text-anchor="middle">Rules engine</text><text class="s" x="690.0" y="180.5" text-anchor="middle">lifecycle state, birthright</text><text class="s" x="690.0" y="193.5" text-anchor="middle">roles, attribute sync</text><path class="ln accent  " d="M520,135.0 L560,135 L560,165 L590,165" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#jml-general-ar-accent)"/><path class="ln gold  " d="M520,205.0 L560,205 L560,185 L590,185" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#jml-general-ar-gold)"/><rect class="box ghost" x="30" y="236" width="320" height="56" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="190.0" y="254.5" text-anchor="middle">Joiner only</text><text class="s" x="190.0" y="269.5" text-anchor="middle">temporary credentials, welcome mail, credentials</text><text class="s" x="190.0" y="282.5" text-anchor="middle">to manager, IT requirements form</text><path class="ln   " d="M440,158 L440,170" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;"/><rect class="box teal" x="590" y="360" width="200" height="52" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="690.0" y="376.5" text-anchor="middle">Create, update, disable</text><text class="s" x="690.0" y="391.5" text-anchor="middle">directory and application</text><text class="s" x="690.0" y="404.5" text-anchor="middle">connectors</text><path class="ln teal  " d="M690,210 L690,360" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#jml-general-ar-teal)"/><text class="l" x="698" y="290" text-anchor="start">trigger connectors</text><rect class="box " x="290" y="360" width="230" height="52" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="405.0" y="383.0" text-anchor="middle">Unique login and email</text><text class="s" x="405.0" y="398.0" text-anchor="middle">aggregated back into ISC</text><path class="ln  dash " d="M590,386 L520,386" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#jml-general-ar)"/><path class="ln  dash " d="M290,386 L10,386 L10,50 L30,50" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#jml-general-ar)"/><text class="l" x="150" y="380" text-anchor="middle">write back login and email</text></svg></div><figcaption><b>General JML.</b> Redrawn from the design's process figures for joiner, mover and leaver. Movers and leavers take the update branch; the rules engine decides what changes on each target.</figcaption></figure>
```

## The automation layer: events, schedules and forms

All JML behaviour sat in workflows reacting to platform events. The trigger types used:

| Trigger | Fired by | Used for |
|---|---|---|
| Identity attributes changed | A filtered change to one or more attributes | Leaver off-boarding when an end date is set, mover on location change, HR writeback, email-change sync to an app |
| Post-provisioning | A completed provisioning plan, filtered by target source and operation (create, enable) | Joiner onboarding and rehire after the directory account exists |
| Form submitted | A specific form definition | Manager completes the joiner, mover or leaver form |
| Scheduled (cron) | A time | Writeback sweep, a SaaS disable job, the daily leaver job, an "update the identity system" notice |
| External HTTP | An authenticated call | A welcome email after account creation in a database application |
| Interactive process launched | A launcher in the user portal | Custom access-request forms (see the forms page) |

Filters use JSONPath over the event payload. A leaver trigger watches for `cloudLifecycleState` changing to `inactive`; a rehire trigger watches the same attribute going from `inactive` to `active` or `preJoiner`. These filters are exact, so keep the attribute names and values stable.

## Joiner

1. HR creates the person. The design asked for at least **14 calendar days** between request and start date.
2. The HR source aggregates hourly. ISC creates the identity, computes lifecycle state, login name and email, and moves the lifecycle to `preJoiner` once the start date is within the processing window.
3. The lifecycle action enables the directory account. Creation happens in the user's **local time zone**, 14 days before start.
4. Directory provisioning sets the identity-derived attributes, places the account in the right organisational unit, adds baseline groups and generates an initial password.
5. A **post-provisioning** workflow fires on the committed directory create. It waits (a sleep step) so downstream sync can settle, then:
   - emails the line manager the credentials and a link to the **IT requirements form**,
   - notifies local IT, the HR contact, the finance contact and the central team,
   - writes the email and login name back to HR (see the identity page).
6. When the manager submits the form, a **form-submitted** workflow branches on the answers (for example which applications are needed) and sends mails to the ITSM mailbox that opens tickets. Each branch is a comparison step, so the workflow grows with every application option.

### Joiner caveats

| Issue | Detail | Mitigation |
|---|---|---|
| No visibility of form completion | ISC could not tell whether the pre-joiner form had been filled in, so it could not re-trigger when the manager changed before the start date | Build a re-send path: an externally triggered workflow or a manually run job. We resent forms by hand dozens of times |
| Wrong manager in HR | HR tags the wrong manager when creating the record; the form goes to the wrong person | Fix the data in HR first, then re-send. Do not paper over it in ISC |
| Manager does not know the process | Managers on leave, or never told, never complete the form, so the equipment is not released and access is not requested | Communication and training before go-live; reminders; delegate approval |
| Duplicate display names | The directory create failed on a duplicate distinguished name or UPN | Unique login names, unique UPN, a retry path (re-provision from ISC after fixing) |
| Pre-existing accounts | People who joined before go-live had accounts created by the old tool and needed groups re-pushed | A "new joiner" flag in the identity (hire date compared to today) so legacy cases are handled separately |
| Audit evidence | The audit process needed an ITSM ticket per joiner; no manager response meant no ticket | Create the ticket when the form is **launched**, update it when the form is **submitted** |

## Leaver

The leaver design had three coordinated parts.

1. **Reminders and the manager form.** When an end date is set or changes, a workflow compares it to now and starts a reminder sequence: weekly reminders to the manager until a week before separation, then daily, with the country HR contact copied. The manager completes a **leaver form** (asset recovery, out-of-office text, who gets the mailbox).
2. **The termination moment.** At 22:00 local on the end date the lifecycle becomes `inactive`. The `Inactive` action disables the account on the listed sources. The directory disable policy moves the account to a disabled container, hides it from the address list and stamps a note.
3. **Aftercare.** A daily scheduled workflow finds leavers by their next-processing date through a search call and loops over them to finish off-boarding. Notifications go to the central team, HR, the finance contact, local IT and the manager.

### Leaver caveats

- **Timing and time zones.** Automated tasks run in the user's local time after midnight; the cut-off is 22:00 local on the end date. A last day entered wrongly in HR (or an earlier "IDM disable date" than the stated end date) disables the person early. Several tickets were exactly this.
- **Group removal is abrupt.** On the first day of production the disable removed **all** groups, including the one that must always remain (the cloud-sync group), cutting a user off from mail who was still active in HR. Fix: keep a list of groups that are never removed, and delay removal of the rest for a number of days after the end date. The design said "seven days after termination only the base groups remain"; build it that way.
- **Re-adding groups on rehire is not automatic.** Previously removed groups do not come back; users must request them again. State this in comms.
- **Mailbox side effects need a home.** Converting the mailbox to shared, setting an out-of-office message, assigning a leaver licence and hiding from the address list were scripted steps in the legacy tool. Inventory them, decide which remain scripts, which become group-driven, and which become workflow steps. Do not assume ISC does them.
- **Contractors and vendors.** Vendor contract expiry arrives as a disable request, not an HR event. Provide an intake and an approval path.
- **Extended access.** HR sometimes asks to extend access after a recorded end date (handover, garden leave). The only clean path is to change the disable date in HR before it passes. Tell HR.

## Mover

A mover is any change in a mapped attribute, but only some changes need action.

| Change | What happens |
|---|---|
| Location, region or country | A mover workflow fires, the manager gets a form (asset return, new move date), the directory moves the object to the new container, and the parties are notified |
| First or last name | HR changes it; the directory logic generates a new email, UPN and aliases, keeps the old address as an alias, and notifies. Users may need to sign in again because the UPN changed |
| Title, department, function | Synced to the directory only if the attribute sync for that attribute is on |
| Move to or from a regional delivery centre | Kept as a **manual** process inherited from the old tool: new account, new mailbox, old account disabled. The user deliberately gets no access to previous mail or profile |
| Return from maternity leave to a new role | Not detected as a mover by location logic, so no notification or access change reached local IT. Decide whether role changes should raise a mover form |

### Attribute sync is the mover engine

ISC pushes only the attributes you enable in the source's **attribute sync** configuration. In the directory source about 8 attributes were on and 9 were off (names, display name, phone, employee ID, country code, user type, department were off at the end). This is by design: sync what the application team asked for, nothing else.

## Rehire

Rehire is a lifecycle transition from `inactive` back to `active` or `preJoiner` for an identity that already exists.

- The directory account is re-enabled and moved out of the disabled container.
- A new initial password is generated and sent to the manager.
- Baseline groups return; business groups do not (see above).
- The workflow variant for a second directory domain triggers on **enable** rather than create.
- Rehire workflows showed many **canceled** executions. Investigate cancellations before accepting them as normal; ours were a mix of expected branches and unfinished waits.

## Notifications and ITSM routing

Mail was the glue between ISC and everything else. Treat notification design as its own workstream.

| Concern | Guidance |
|---|---|
| Sender identity | Production mail came from an internal no-reply address; sandbox came from the vendor's default. Tests in sandbox must never go to production distribution lists |
| Ticket creation | ISC created ITSM tickets by sending mail to a mailbox with a **fixed subject convention**. The ITSM side parsed the subject to route to the right queue. Changing the subject breaks routing |
| Routing by location | After go-live the subject gained the location so tickets could be assigned to the right local team. Add routing keys early |
| Who gets what | Keep a matrix of event by audience (manager, initiator, HR, finance, local IT, central team, ITSM). After go-live the matrix changed: local IT and HR also received the filled form details; central support got a "user account disabled" notice; credentials were restricted to the manager only |
| Credentials in mail | Sending credentials to several parties was removed. Send to the manager only, force a reset on first sign-in, and note it in the SOP |
| Templates | The tenant ended with about 60 notification templates. Name them by event and audience |

> Hypercare showed that most "SailPoint is broken" tickets from regions were notification gaps: a distribution list not updated, a contact wrong in the lookup table, a manager who never received the form, or an ITSM queue not receiving mail. Test every mail path end to end with real recipients before go-live.

## Nightly validation during rollout

For the first weeks of production the team exported a **joiner list** and a **leaver list** each night from search (display name, email, created date, lifecycle state, source account count, start or end date, manager) and compared them to HR. Source account count was a cheap health signal: a joiner with fewer accounts than the baseline had a provisioning gap. This took an hour a day and caught problems before users did.

## Design cautions

- Wait steps and form steps leave many executions in `Executing` or `Canceled`. Monitor the count, and know what a normal ratio looks like.
- A mover or joiner workflow branching on a dozen application flags becomes unmaintainable. Prefer data-driven branches (a form that lists requested access items) over one comparison step per application.
- Do not trigger a workflow from an attribute you also edit for testing. We kept "manual trigger" workflows keyed to a department change; they are a hack and should be disabled once real triggers work.
- Put the **scheduled** catch-up next to every event trigger. Events are lost, and the sweep repairs them.

## Actions

- Enumerate lifecycle states and write down each state's account actions and source list.
- Add "update the lifecycle source list" to every source onboarding checklist.
- Build the re-send mechanism for forms before go-live.
- Define groups that are never removed and delay the removal of the rest.
- Inventory legacy mailbox and licensing scripts and assign each a new owner.
- Build the notification matrix and test every path end to end.
