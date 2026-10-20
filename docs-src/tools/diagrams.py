#!/usr/bin/env python3
"""Generates the field guide's SVG diagrams and writes them into the markdown pages.

Usage:   python3 docs-src/tools/diagrams.py
Pages hold either a placeholder line  @@dgm:name@@  or a previously generated block
(a ```html fence whose first line is  <!-- dgm:name -->). Both are replaced by the current output.
Diagrams are original redrawings. Several follow the structure of figures in the program's own
design documents and in SailPoint's public documentation, adapted to the site's style, with
names, hosts and addresses removed.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dgmlib import D, L, R, T, B, row, col  # noqa: E402

ROOT = Path(__file__).resolve().parents[1] / "sailpoint-isc-greenfield"
REG = {}


def dgm(name, page):
    def deco(fn):
        REG[name] = (page, fn)
        return fn

    return deco


# ------------------------------------------------------------------ 02 architecture
@dgm("va-paths", "02-architecture.md")
def va_paths():
    d = D("va-paths", 820, 300, "Three ways a virtual appliance reaches ISC",
          "Standard direct outbound, HTTP proxy, and DMZ placement. Only the administrator connection on port 22 is inbound.")

    def common(x0, title, kind):
        d.group(x0, 8, 260, 284, title, kind)

    def side(x0, vay):
        d.box(x0 + 14, vay + 62, 90, 38, "Admin", "SSH only", "teal")
        d.arrow([(x0 + 59, vay + 62), (x0 + 82, vay + 46)], "teal", label="22 in", lpos=(x0 + 44, vay + 50), lanchor="end")
        d.box(x0 + 156, vay + 62, 90, 38, "NTP", "internal", "")
        d.arrow([(x0 + 178, vay + 46), (x0 + 196, vay + 62)], dot=True, label="123", lpos=(x0 + 196, vay + 50), lanchor="start")

    # standard
    x0 = 6
    common(x0, "Standard (recommended)", "")
    d.box(x0 + 45, 34, 170, 40, "SailPoint tenant", "and update services", "accent")
    d.group(x0 + 10, 112, 240, 168, "Your network")
    d.box(x0 + 55, 142, 150, 50, "Virtual appliance", "cluster member", "blue")
    d.arrow([(x0 + 130, 142), (x0 + 130, 76)], "accent", label="443 out", lpos=(x0 + 136, 112), lanchor="start")
    side(x0, 142)
    # proxy
    x1 = 280
    common(x1, "HTTP proxy", "")
    d.box(x1 + 45, 34, 170, 40, "SailPoint tenant", "and update services", "accent")
    d.group(x1 + 10, 88, 240, 192, "Your network")
    d.box(x1 + 75, 104, 110, 34, "Proxy", "", "violet")
    d.arrow([(x1 + 130, 104), (x1 + 130, 76)], "accent", label="443", lpos=(x1 + 136, 94), lanchor="start")
    d.box(x1 + 55, 168, 150, 50, "Virtual appliance", "cluster member", "blue")
    d.arrow([(x1 + 130, 168), (x1 + 130, 140)], "accent", label="all HTTP(S)", lpos=(x1 + 136, 158), lanchor="start")
    side(x1, 168)
    # DMZ
    x2 = 554
    common(x2, "DMZ (not recommended)", "gold")
    d.box(x2 + 45, 34, 170, 40, "SailPoint tenant", "and update services", "accent")
    d.group(x2 + 10, 92, 240, 62, "DMZ", "gold")
    d.box(x2 + 60, 108, 140, 38, "Virtual appliance", "", "blue")
    d.arrow([(x2 + 130, 108), (x2 + 130, 76)], "accent", label="443 out", lpos=(x2 + 136, 98), lanchor="start")
    d.group(x2 + 10, 176, 240, 106, "Your network")
    d.box(x2 + 50, 214, 160, 50, "Sources", "directories, databases, apps", "")
    d.arrow([(x2 + 130, 146), (x2 + 130, 214)], "gold", dash=True, label="a hole per source", lpos=(x2 + 136, 190), lanchor="start")
    return d.html("<b>Network methods.</b> The appliance only ever calls out; the one inbound connection is optional administrator SSH. A proxy carries all web traffic while time sync still goes direct. SailPoint advises against the DMZ for security, proximity and connectivity reasons.")


@dgm("va-clusters-prod", "02-architecture.md")
def va_clusters_prod():
    d = D("va-clusters-prod", 820, 396, "Production virtual appliance clusters",
          "Five clusters by purpose: HR, two directory estates with directory agents, and two application batches. Each has two appliances except one.")
    d.box(10, 8, 120, 40, "NTP", "time source", "")
    d.box(330, 8, 160, 44, "ISC tenant", "outbound TLS only", "accent")
    d.line([(86, 72), (734, 72)], "accent")
    d.arrow([(410, 72), (410, 52)], "accent")
    d.text(560, 66, "TLS, encrypted payloads", "l", "middle")
    d.arrow([(130, 28), (330, 28)], dot=True, label="123", lpos=(230, 22))
    cl = [
        (10, "HR cluster", ["cloud, region 1", "cloud, region 1"], "blue"),
        (172, "Directory cluster A", ["on-prem, site 1", "cloud, region 2"], "teal"),
        (334, "Directory cluster B", ["on-prem, site 2", "cloud, region 3"], "teal"),
        (496, "Application batch 1", ["on-prem, site 3", "cloud, region 1"], "violet"),
        (658, "Application batch 2", ["cloud, other geography", None], "gold"),
    ]
    for x, name, vas, kind in cl:
        d.line([(x + 76, 72), (x + 76, 92)], "accent")
        d.rect(x, 92, 152, 184, kind)
        d.text(x + 76, 110, name, "t")
        for i, v in enumerate(vas):
            y = 124 + i * 66
            if v:
                d.box(x + 14, y, 124, 54, f"VA {i + 1}", v, "")
            else:
                d.box(x + 14, y, 124, 54, "No second VA", "single point of failure", "ghost")
    d.text(10, 288, "", "s")
    d.box(10, 298, 152, 40, "HR system", "OAuth 2.0 over HTTPS", "")
    d.arrow([(86, 276), (86, 298)], label="", plain=False)
    d.box(172, 298, 152, 40, "Directory agent", "TLS to the forest", "gold")
    d.box(334, 298, 152, 40, "Directory agent", "TLS to the forest", "gold")
    d.arrow([(248, 276), (248, 298)], "teal")
    d.arrow([(410, 276), (410, 298)], "teal")
    d.box(172, 352, 152, 34, "Internal forest", "389 / 636", "")
    d.box(334, 352, 152, 34, "External forest", "389 / 636", "")
    d.arrow([(248, 338), (248, 352)], "teal")
    d.arrow([(410, 338), (410, 352)], "teal")
    d.box(496, 298, 152, 40, "Applications", "REST, SaaS, SQL", "")
    d.box(658, 298, 152, 40, "Applications", "region-specific", "")
    d.arrow([(572, 276), (572, 298)], "")
    d.arrow([(734, 276), (734, 298)], "")
    return d.html("<b>Cluster layout.</b> Redrawn from the design's cluster segregation figure: one cluster for the HR system, one per directory estate (reading directly and writing through a directory agent) and two for applications. The cluster in another geography has a single appliance, a risk the design should have closed.")


# ------------------------------------------------------------------ 01 program
@dgm("phase-path", "01-program-and-scoping.md")
def phase_path():
    d = D("phase-path", 820, 330, "SailPoint's phased path against the program",
          "Six recommended phases and where the program covered each one.")
    ph = [
        ("1  Foundational governance", "HR source, identity model, core directories, verify data, first reviews", "accent", "program: phase 1"),
        ("2  Expansion and lifecycle", "Contractors, critical applications, joiner, mover, leaver automation", "accent", "program: phases 1 and 2"),
        ("3  Activity and machines", "Activity data, machine and service accounts", "ghost", "program: out of scope"),
        ("4  Access modelling and requests", "Roles, request workflows, service desk integration", "gold", "program: phases 1 and 2"),
        ("5  Cloud, data and privileged", "Cloud entitlements, data access, privileged integration", "ghost", "program: out of scope"),
        ("6  Maturity", "On-premises servers and databases, separation of duties, strategy review", "gold", "program: phase 2"),
    ]
    w, h = 252, 112
    for i, (t, sub, kind, tag) in enumerate(ph):
        x = 6 + (i % 3) * (w + 28)
        y = 10 + (i // 3) * (h + 40)
        d.box(x, y, w, h, t, sub, kind, tag)
        if i % 3 < 2:
            d.arrow([(x + w, y + h / 2), (x + w + 28, y + h / 2)], "accent" if kind != "ghost" else "")
    d.arrow([(6 + 2 * (w + 28) + w / 2, 10 + h), (6 + 2 * (w + 28) + w / 2, 10 + h + 18), (6 + w / 2, 10 + h + 18), (6 + w / 2, 10 + h + 40)], "accent")
    d.text(410, 318, "Filled boxes were in the program. Dashed boxes were deliberately left out.", "l")
    return d.html("<b>The six phases.</b> Structure follows SailPoint's published phased approach; the tags show where the program sat against it.")


@dgm("phase1-selection", "01-program-and-scoping.md")
def phase1_selection():
    d = D("phase1-selection", 820, 250, "Choosing phase 1 applications",
          "All applications are narrowed by business criticality, then selected for pattern diversity to give the phase 1 set.")
    s = [
        ("Application inventory", "every application with an owner and a technical contact", "", "about 140"),
        ("Criticality shortlist", "client, financial or privileged data. Audit and access-failure impact", "accent", "business criticality"),
        ("Diversity pick", "one or more per integration pattern, so no pattern is first met in phase 2", "gold", "pattern diversity"),
        ("Phase 1 set", "proves every pattern on systems the business cares about", "teal", "about 10"),
    ]
    xs = [6, 212, 418, 624]
    hs = [150, 128, 106, 84]
    for i, (t, sub, kind, tag) in enumerate(s):
        y = 20 + (150 - hs[i]) / 2
        d.box(xs[i], y, 190, hs[i], t, sub, kind, tag)
        if i < 3:
            d.arrow([(xs[i] + 190, 95), (xs[i + 1], 95)], "accent")
    chips = [("directory", "blue"), ("HR system", "blue"), ("REST application", "violet"), ("SQL Server applications", "violet"), ("SaaS finance product", "gold")]
    x = 6
    d.text(6, 206, "PATTERNS COVERED IN PHASE 1", "h", "start")
    for lab, k in chips:
        x += d.chip(x, 216, lab, k) + 8
    return d.html("<b>Two criteria, in order.</b> Criticality builds the shortlist; diversity decides the final selection inside it.")


# ------------------------------------------------------------------ 03 identity model
@dgm("optimized-agg", "03-authoritative-source-and-identity-model.md")
def optimized_agg():
    d = D("optimized-agg", 820, 290, "Optimized and unoptimized aggregation",
          "An optimized run skips unchanged accounts and does not re-run correlation. An unoptimized run reprocesses everything.")
    d.group(6, 8, 520, 274, "Optimized (default, UI and schedules)", "accent")
    a = d.box(24, 110, 120, 52, "Read every record", "from the source", "")
    d.diamond(236, 136, 150, 84, "Changed since last run?")
    d.arrow([R(a), (161, 136)], "")
    s1 = d.box(364, 48, 148, 52, "Skip the account", "no correlation, no manager correlation", "ghost")
    s2 = d.box(364, 168, 148, 64, "Update attributes", "evaluate correlation and manager correlation", "accent")
    d.arrow([(236, 94), (236, 74), (364, 74)], "", label="no", lpos=(300, 68))
    d.arrow([(236, 178), (236, 200), (364, 200)], "accent", label="yes", lpos=(300, 194))
    d.group(546, 8, 268, 274, "Unoptimized (API only)", "gold")
    d.box(562, 40, 236, 62, "load-accounts with disableOptimization=true", "that one run only", "gold")
    d.box(562, 120, 236, 52, "Every record is processed", "correlation re-run for all", "")
    d.box(562, 190, 236, 70, "Manually correlated accounts are kept", "check them before you start", "teal")
    d.arrow([(680, 102), (680, 120)], "gold")
    d.arrow([(680, 172), (680, 190)], "gold")
    return d.html("<b>Why a fixed correlation rule can do nothing.</b> Accounts that did not change are skipped, so they are never re-matched. Use the unoptimized run after correcting correlation logic or the data it matches.")


@dgm("profile-priority", "03-authoritative-source-and-identity-model.md")
def profile_priority():
    d = D("profile-priority", 820, 270, "One identity belongs to one identity profile",
          "An identity joins the highest priority profile whose authoritative source holds one of its accounts.")
    d.box(6, 20, 200, 60, "Person A", "account on the HR source only", "")
    d.box(6, 170, 200, 70, "Person B", "accounts on the HR source and on the admin source", "")
    pb = d.box(330, 20, 210, 70, "HR profile, priority 20", "authoritative source: HR system", "blue")
    pa = d.box(330, 150, 210, 70, "Admin profile, priority 10", "authoritative source: small admin file", "violet")
    d.arrow([(206, 50), (330, 55)], "accent")
    d.arrow([(206, 195), (330, 190)], "accent", label="highest priority wins", lpos=(268, 176))
    d.arrow([(206, 185), (260, 120), (330, 75)], "", dash=True)
    d.box(630, 20, 180, 70, "Identity in the HR profile", "mappings and lifecycle of the HR profile", "blue")
    d.box(630, 150, 180, 70, "Identity in the admin profile", "mappings of the admin profile", "violet")
    d.arrow([(540, 55), (630, 55)], "blue")
    d.arrow([(540, 185), (630, 185)], "violet")
    d.text(410, 258, "Priority follows creation order by default (10, 20, ...). Lower number wins. Change it with the update profile API.", "l")
    return d.html("<b>Priority matters for second sources.</b> Plan the order before you create overlapping profiles; you cannot create or delete a profile while an account aggregation is running.")


@dgm("hr-migration", "03-authoritative-source-and-identity-model.md")
def hr_migration():
    d = D("hr-migration", 820, 420, "Replacing the HR system without a big bang",
          "Nine steps: move the HR system first, onboard it separately, mirror the identity profile, migrate access-driving attributes last.")
    steps = [
        ("Go live with the new HR system first", "not the same day as the ISC switch. Watch the data for days, pause orchestrations", "gold"),
        ("Onboard the new HR source", "let several aggregations run, configure manager correlation", ""),
        ("Correlate to existing identities", "on the agreed unique attribute. Review the uncorrelated report", ""),
        ("Create a mirrored identity profile", "same mappings and transforms. Confirm identity counts", ""),
        ("Raise its priority", "check identities moved: counts, search, spot checks", "accent"),
        ("Update role criteria", "add OR clauses so people qualify on old or new HR data", ""),
        ("Migrate attributes gradually", "firstValid transforms. Lifecycle state and other access-driving attributes last", "accent"),
        ("Re-point owners and groups", "governance groups, source owners, application owners", ""),
        ("Clean up", "delete the old profile, optionally the old source", "teal"),
    ]
    for i, (t, sub, kind) in enumerate(steps):
        y = 6 + i * 45
        d.box(34, y, 770, 38, t, sub, kind, align="start")
        d.badge(16, y + 19, i + 1)
    return d.html("<b>Sequence from SailPoint's authoritative-source migration guide.</b> Choose a low-impact window and keep a rollback plan with time to execute it.")


# ------------------------------------------------------------------ 04 lifecycle
@dgm("jml-general", "04-lifecycle-states-and-jml.md")
def jml_general():
    d = D("jml-general", 820, 430, "Joiner, mover and leaver data flow",
          "HR changes are imported hourly, evaluated by rules, and drive directory and application changes; the login and email are written back to HR.")
    d.group(0, 6, 820, 76, "HR system")
    d.group(0, 98, 820, 218, "ISC", "accent")
    d.group(0, 334, 820, 90, "Directories and applications")
    hr = d.box(30, 28, 240, 44, "HR records the event", "hire, change or termination", "")
    si = d.box(30, 126, 150, 52, "Scheduled import", "pulled every 60 minutes", "blue")
    d.arrow([(105, 72), (105, 126)], "")
    d.diamond(262, 152, 130, 74, "Employee ID known?")
    d.arrow([R(si), (197, 152)], "")
    j = d.box(360, 112, 160, 46, "Create identity", "joiner", "accent")
    m = d.box(360, 182, 160, 46, "Update identity", "mover or leaver", "gold")
    d.arrow([(327, 152), (343, 152), (343, 135), (360, 135)], "accent", label="no", lpos=(340, 128), lanchor="end")
    d.arrow([(262, 189), (262, 205), (360, 205)], "gold", label="yes", lpos=(310, 200))
    r = d.box(590, 140, 200, 70, "Rules engine", "lifecycle state, birthright roles, attribute sync", "blue")
    d.arrow([R(j), (560, 135), (560, 165), (590, 165)], "accent")
    d.arrow([R(m), (560, 205), (560, 185), (590, 185)], "gold")
    d.box(30, 236, 320, 56, "Joiner only", "temporary credentials, welcome mail, credentials to manager, IT requirements form", "ghost")
    d.arrow([(440, 158), (440, 170)], "", plain=True)
    t = d.box(590, 360, 200, 52, "Create, update, disable", "directory and application connectors", "teal")
    d.arrow([(690, 210), (690, 360)], "teal", label="trigger connectors", lpos=(698, 290), lanchor="start")
    ag = d.box(290, 360, 230, 52, "Unique login and email", "aggregated back into ISC", "")
    d.arrow([(590, 386), (520, 386)], "", dash=True)
    d.arrow([(290, 386), (10, 386), (10, 50), (30, 50)], "", dash=True, label="write back login and email", lpos=(150, 380))
    return d.html("<b>General JML.</b> Redrawn from the design's process figures for joiner, mover and leaver. Movers and leavers take the update branch; the rules engine decides what changes on each target.")


@dgm("lifecycle-states", "04-lifecycle-states-and-jml.md")
def lifecycle_states():
    d = D("lifecycle-states", 820, 300, "Lifecycle states and the actions on each",
          "Pre joiner, active, inactive, with intermediate for anything else and emergency termination as a manual cut-off.")
    pj = d.box(6, 40, 168, 78, "Pre Joiner", "hired, not started", "blue", "enable directory accounts")
    ac = d.box(232, 40, 168, 78, "Active", "employed", "teal", "enable directory accounts")
    ia = d.box(458, 40, 168, 78, "Inactive", "end date reached, 22:00 local", "gold", "disable on listed sources")
    d.arrow([R(pj), L(ac)], "teal", label="start", lpos=(203, 76))
    d.arrow([R(ac), L(ia)], "gold", label="end date", lpos=(429, 76))
    d.arrow([(542, 40), (542, 18), (316, 18), (316, 40)], "teal", dash=True, label="rehire", lpos=(429, 13))
    im = d.box(232, 170, 168, 70, "Intermediate", "fits no other rule", "", "no account action")
    d.arrow([(316, 118), (316, 170)], "", dash=True)
    em = d.box(650, 40, 164, 78, "Emergency termination", "manual cut-off, any time", "accent", "disable directory sources")
    d.box(6, 170, 168, 70, "Account created", "14 days before start, in the user's time zone", "ghost")
    d.arrow([(90, 118), (90, 170)], "", dash=True, plain=True)
    d.box(458, 170, 356, 70, "Lifecycle action source lists are explicit", "a source not on the list is not disabled. Check every new source", "ghost")
    d.text(410, 280, "State is computed by a cloud rule from HR status, end date and the person's time zone.", "l")
    return d.html("<b>Five states.</b> The action attached to each state names its target sources by identifier, so adding a source means adding it to the list.")


# ------------------------------------------------------------------ 05 active directory
@dgm("iqservice-lb", "05-active-directory.md")
def iqservice_lb():
    d = D("iqservice-lb", 820, 330, "Directory agents behind load balancers",
          "Appliances reach each domain through a load balancer that fronts a pair of directory agent servers.")
    d.group(0, 6, 190, 318, "VA clusters")
    for i, lab in enumerate(["HR and directory clusters", "application clusters", "clusters in other regions"]):
        d.box(14, 34 + i * 92, 162, 70, "Appliances", lab, "blue")
    lbs = []
    for i, dom in enumerate(["Domain 1", "Domain 2", "Domain 3"]):
        y = 28 + i * 98
        lb = d.box(250, y + 18, 90, 44, "Load balancer", "", "violet")
        lbs.append(lb)
        a = d.box(420, y, 150, 36, "Directory agent 1", "primary", "teal")
        b = d.box(420, y + 46, 150, 36, "Directory agent 2", "", "teal")
        d.arrow([R(lb), L(a)], "violet")
        d.arrow([R(lb), L(b)], "violet")
        d.box(660, y + 18, 120, 44, dom, "389 / 636", "")
        d.arrow([R(a), (660, y + 30)], "teal")
        d.arrow([R(b), (660, y + 52)], "teal")
    for i in range(3):
        d.arrow([(176, 69 + i * 92), (250, 46 + i * 98)], "")
    d.text(410, 318, "Agent port 5050 (5051 for the second channel). Appliance to agent traffic is TLS.", "l")
    return d.html("<b>Directory agents.</b> The design ran two agent servers per domain behind a load balancer, so an agent can be patched or fail without stopping provisioning. Reads go directly from the appliance; writes go through the agent.")


@dgm("ad-account-build", "05-active-directory.md")
def ad_account_build():
    d = D("ad-account-build", 820, 330, "What the directory create policy builds",
          "Unique login name and email, common name, distinguished name from organisational attributes, baseline groups and country-based licensing.")
    st = [
        ("Unique login name", "first 3 letters + last 3 + a counter, 8 characters", "teal"),
        ("Unique email", "name.surname, with a number added when taken", "teal"),
        ("Common name", "set from the login name", ""),
        ("Distinguished name", "region, department and work location, in the standard users container", "blue"),
        ("Baseline groups", "cloud sign-in, multi-factor, self-service reset, all-users", "blue"),
        ("Country rule", "licence group chosen by country", "gold"),
    ]
    row(d, 6, 20, st[:3], 252, 74, 28)
    row(d, 6, 150, st[3:], 252, 74, 28)
    d.arrow([(774, 94), (774, 122), (132, 122), (132, 150)], "accent")
    d.box(6, 262, 394, 54, "Create the account in the directory", "agent call, then the account is aggregated back", "accent")
    d.box(426, 262, 388, 54, "Cloud directory sync", "attributes reach the cloud directory afterwards", "ghost")
    d.arrow([(400, 289), (426, 289)], "")
    d.arrow([(400, 224), (400, 262)], "accent", plain=True)
    d.arrow([(132, 224), (132, 262)], "accent")
    return d.html("<b>Account build.</b> Adapted from the joiner flow in the design: the same rules produce the login, email, location in the tree and baseline access.")


# ------------------------------------------------------------------ 07 web services
@dgm("ws-pipeline", "07-web-services-and-jdbc-deep-dive.md")
def ws_pipeline():
    d = D("ws-pipeline", 820, 262, "Where rules run around a web services operation",
          "Each operation can run a before rule, then the HTTP call, then an after rule that reshapes the response.")
    d.group(0, 8, 820, 112, "Aggregation", "teal")
    st = [("Operation", "account or group aggregation", "", None), ("Before rule", "token, paging, parameters", "violet", "requestEndPoint"),
          ("HTTP call", "connector client on the appliance", "blue", None), ("After rule", "reshape, disabled flag, allowlist", "violet", "rawResponseObject"),
          ("Accounts", "mapped into ISC", "teal", None)]
    b = []
    for i, (t, sub, k, tag) in enumerate(st):
        b.append(d.box(14 + i * 160, 34, 130, 76, t, sub, k, tag))
        if i:
            d.arrow([R(b[i - 1]), L(b[i])], "teal")
    d.group(0, 136, 820, 112, "Provisioning", "gold")
    st2 = [("Plan", "from a request or lifecycle action", "", None), ("Before rule", "build body, read comments, live lookup", "violet", "provisioningPlan"),
           ("HTTP call", "create, modify, enable, disable", "blue", None), ("After rule", "check the response body", "violet", None),
           ("Result", "committed or failed", "gold", None)]
    c = []
    for i, (t, sub, k, tag) in enumerate(st2):
        c.append(d.box(14 + i * 160, 160, 130, 76, t, sub, k, tag))
        if i:
            d.arrow([R(c[i - 1]), L(c[i])], "gold")
    return d.html("<b>Rule hook points.</b> Rules run on the appliance, around the connector's own call. Logic that looks missing from the endpoint configuration is usually in the before rule.")


# ------------------------------------------------------------------ 09 forms
@dgm("form-launcher-chain", "09-forms-launchers-workflows.md")
def form_launcher_chain():
    d = D("form-launcher-chain", 820, 250, "From launcher to action",
          "A form is reachable only through a launcher that starts a workflow whose first step is the form.")
    st = [("Launcher", "needs the assigned launcher entitlement", "accent"), ("Workflow trigger", "interactive process launched, filtered on the workflow's own ID", "violet"),
          ("Interactive form", "first step of the workflow", "blue"), ("Form data", "returned inline to the workflow", "teal"),
          ("Actions", "search, approve, grant access, call an API, send mail", "gold")]
    bs = row(d, 6, 40, st, 140, 96, 28)
    d.text(6, 20, "WHAT MUST BE TRUE", "h", "start")
    d.box(6, 170, 392, 62, "The launch button appears only when", "the launcher is assigned to the user and its workflow is enabled", "ghost")
    d.box(424, 170, 390, 62, "A form on its own is not reachable", "retire a form, never delete it while a launch may still point at it", "ghost")
    return d.html("<b>The working chain.</b> Creating a launcher auto-creates a non-requestable entitlement; grant it directly or through a role before anyone sees the button.")


# ------------------------------------------------------------------ 10 campaigns
@dgm("qar-factory", "10-certifications-and-qar.md")
def qar_factory():
    d = D("qar-factory", 820, 330, "The campaign factory run",
          "Preflight and plan, then per source: snapshot, upload, settings, aggregate, remove stale accounts, create staged campaigns, verify; a person launches.")
    a = d.box(6, 14, 180, 54, "Preflight", "workbook, API, file server, settings", "")
    p = d.box(214, 14, 180, 54, "Plan", "validate every source and campaign row", "")
    d.arrow([R(a), L(p)], "")
    d.group(0, 92, 820, 124, "For each source that passed", "accent")
    steps = [("Snapshot", "settings, schema, correlation", ""), ("Upload", "clean file, never overwrite a different one", ""), ("Settings", "schema, correlation attribute", ""),
             ("Aggregate", "wait for the load", "blue"), ("Remove stale", "guarded by a percentage", "gold"), ("Create campaigns", "STAGED only", "accent")]
    bx = []
    for i, (t, sub, k) in enumerate(steps):
        bx.append(d.box(10 + i * 134, 120, 118, 78, t, sub, k))
        if i:
            d.arrow([R(bx[i - 1]), L(bx[i])], "accent")
    d.arrow([R(p), (440, 41), (440, 92)], "", plain=True)
    d.arrow([(740, 198), (740, 236)], "accent")
    v = d.box(580, 236, 234, 56, "Verify before launch", "campaign report against the file read back", "teal")
    d.box(300, 236, 244, 56, "Discrepancy report", "why, what to do, state left behind", "")
    d.arrow([L(v), (544, 264)], "teal", dash=True)
    d.box(6, 236, 260, 56, "A person launches", "the script cannot activate a campaign", "gold")
    d.arrow([(300, 264), (266, 264)], "", plain=False, dash=True)
    d.text(410, 318, "Safe to repeat: identical files are reused, finished rows skipped, source settings can be restored.", "l")
    return d.html("<b>Factory design.</b> Dry run, snapshot and restore, staged creation and verification are the safety properties worth copying in any language.")


# ------------------------------------------------------------------ 12 go-live
@dgm("confighub-flow", "12-testing-migration-and-go-live.md")
def confighub_flow():
    d = D("confighub-flow", 820, 300, "Moving configuration between tenants",
          "Backup the source, build a draft that compares with the target, edit it, then deploy. Secrets, appliances and some objects do not travel.")
    st = [("Source tenant", "sandbox, configuration as built", "blue"), ("Backup", "manual, up to 10; 5,000 objects", ""), ("Draft", "compared with the live target, editable", "violet"), ("Deploy", "adds and updates; does not delete", "accent"), ("Target tenant", "production", "teal")]
    row(d, 6, 20, st, 140, 80, 28)
    d.group(0, 130, 820, 160, "What does not move", "gold")
    d.box(14, 158, 250, 114, "Secrets and credentials", "never exported. Re-enter them on every source, and use the moment to issue production credentials", "gold")
    d.box(284, 158, 250, 114, "Appliances and clusters", "per tenant. Build and connect them in the target before the first aggregation", "gold")
    d.box(554, 158, 252, 114, "Silently skipped", "unsupported object types are skipped and the import still reports COMPLETE. Non-employee sources cannot be deployed", "gold")
    return d.html("<b>Promotion path.</b> Take a manual full backup before any cutover step, preview an import first, and diff an export afterwards.")


@dgm("attr-sync-stages", "12-testing-migration-and-go-live.md")
def attr_sync_stages():
    d = D("attr-sync-stages", 820, 290, "Staged switch-on of attribute sync",
          "Ten attributes enabled in five steps over about ten days, with validation between steps and a rollback to the last step.")
    labels = ["location, country", "two more", "two more", "two more", "last two"]
    for i, lab in enumerate(labels):
        h = 40 + i * 28
        x = 20 + i * 150
        d.rect(x, 190 - h, 120, h, "teal" if i < 4 else "accent")
        d.text(x + 60, 190 - h + 18, f"{(i + 1) * 2} attributes", "t")
        d.text(x + 60, 190 - h + 34, lab, "s")
        d.text(x + 60, 208, f"step {i + 1}", "h")
        if i < 4:
            d.arrow([(x + 120, 160), (x + 150, 160)], "accent")
            d.badge(x + 135, 140, "\u2713")
    d.text(60, 236, "after each step: compare a before and after sample, and switch off on data issues", "s", "start")
    d.arrow([(780, 230), (780, 266), (60, 266)], "gold", dash=True, label="rollback to the last good step", lpos=(420, 260))
    d.text(790, 26, "about ten days", "l", "end")
    return d.html("<b>Cheapest rollback.</b> Location and country first, because location drives birthright access; the rest in groups of at most two.")


# ------------------------------------------------------------------ 19 complex applications
@dgm("role-entity-sequence", "19-complex-application-patterns.md")
def role_entity_sequence():
    d = D("role-entity-sequence", 820, 330, "Granting a role and its entity",
          "The workflow branches on scope, grants the role, waits a minute and grants the entity; the rule pairs them through the request comments.")
    d.box(6, 120, 140, 70, "Request form", "requestee, scope, roles", "blue")
    d.diamond(222, 155, 100, 70, "Scope?")
    d.arrow([R((6, 120, 140, 70)), (172, 155)], "")
    lanes = [("Global", [("Grant role", "each selected role")], 30),
             ("Local office", [("Grant role", ""), ("Wait 1 minute", ""), ("Grant office entity", "")], 120),
             ("Client entity", [("Grant role", ""), ("Wait 1 minute", ""), ("Grant client entity", "")], 210)]
    for name, steps, y in lanes:
        d.text(300, y + 4, name.upper(), "h", "start")
        for i, (t, sub) in enumerate(steps):
            x = 300 + i * 126
            d.box(x, y + 12, 108, 48, t, sub or None, "teal" if "Grant" in t else "")
            if i:
                d.arrow([(x - 18, y + 36), (x, y + 36)], "teal")
    d.arrow([(222, 120), (222, 54), (300, 54)], "accent", label="global", lpos=(262, 48))
    d.arrow([(272, 155), (286, 155), (286, 144), (300, 144)], "accent", label="local", lpos=(268, 138), lanchor="end")
    d.arrow([(222, 190), (222, 240), (300, 240)], "accent", label="client", lpos=(262, 234))
    d.box(690, 100, 124, 130, "Provisioning rule", "reads role and entity from the comments, checks for a duplicate, inserts one row", "gold")
    for y in (54, 144, 240):
        d.arrow([(678 if y != 54 else 408, y), (690, 165)], "gold", plain=False) if False else None
    d.arrow([(426, 54), (700, 54), (700, 100)], "gold")
    d.arrow([(678, 144), (690, 144)], "gold")
    d.arrow([(678, 240), (700, 240), (700, 230)], "gold")
    d.text(410, 318, "A default branch must fail, never fall through to the broadest scope.", "l")
    return d.html("<b>Dependent entitlements.</b> Role and entity are separate grants. The one-minute wait separates two provisioning events on the same account.")


@dgm("form-cascade", "19-complex-application-patterns.md")
def form_cascade():
    d = D("form-cascade", 820, 340, "Cascading selection with several forms",
          "Each form feeds a search; the search result fills the next form's dropdown.")
    st = [("Form 1", "scope and requestee", "blue"), ("Search", "parents of the chosen scope", "violet"), ("Form 2", "country, from the result", "blue"), ("Search", "children of country and client", "violet"), ("Form 3", "entity, single or multiple", "blue")]
    bs = row(d, 6, 20, st, 140, 78, 28, akind="accent")
    d.cyl(150, 150, 520, 100, "Search index", "")
    d.text(410, 204, "description = the country an entity belongs to\nattribute = the kind of entitlement\ntags = the normalised client name", "m", "middle", 14)
    d.arrow([B(bs[1]), (300, 150)], "accent", dash=True)
    d.arrow([B(bs[3]), (520, 150)], "accent", dash=True)
    d.box(6, 276, 392, 52, "Why not one form?", "search data sources cannot filter one dropdown by another", "ghost")
    d.box(424, 276, 390, 52, "Why those three fields?", "entitlement attributes are not indexed, so the parent lives in a searchable field", "ghost")
    return d.html("<b>Multi-step forms.</b> The only robust cascade on the platform: the workflow calls the search API between forms and builds each option list.")


@dgm("k-field-cascade", "19-complex-application-patterns.md")
def k_field_cascade():
    d = D("k-field-cascade", 820, 300, "Field dependencies in a composite access block",
          "Service line, asset manager, client, then region, country and entity depend on earlier choices; a level 2 service is derived in a rule.")
    sl = d.box(6, 30, 140, 60, "Service line", "reference list", "blue")
    am = d.box(176, 30, 140, 60, "Asset manager", "by service line", "blue")
    cl = d.box(346, 30, 140, 60, "Client", "by asset manager and service line", "blue")
    rg = d.box(516, 30, 140, 60, "Region(s)", "by client and service line", "blue")
    d.arrow([R(sl), L(am)], "accent")
    d.arrow([R(am), L(cl)], "accent")
    d.arrow([R(cl), L(rg)], "accent")
    ro = d.box(6, 170, 140, 60, "Role(s)", "not scoped by client", "")
    co = d.box(516, 170, 140, 60, "Country(s)", "by client, service line, regions", "teal")
    en = d.box(346, 170, 140, 60, "Entity(s)", "by client and service line", "teal")
    l2 = d.box(676, 170, 138, 60, "Level 2 services", "rule only, not a form field", "gold")
    d.arrow([B(rg), T(co)], "accent")
    d.arrow([B(cl), T(en)], "accent")
    d.arrow([(416, 90), (416, 130), (745, 130), (745, 170)], "gold", dash=True)
    d.text(410, 270, "One block repeats as often as needed. The union of a person's blocks is what they can reach.", "l")
    return d.html("<b>Cascade of five dependent fields.</b> Redrawn from the application's confirmed reference calls; each box is one lookup the form or the rule must make.")


@dgm("k-provisioning-flow", "19-complex-application-patterns.md")
def k_provisioning_flow():
    d = D("k-provisioning-flow", 820, 300, "Read, merge, write, verify",
          "Approval, then for each identity build the payload, create the account, activate, wait and verify; then notify.")
    t = d.box(230, 8, 170, 44, "Trigger", "form submitted", "blue")
    ap = d.box(430, 6, 170, 48, "Approval", "all identities and accesses shown", "gold")
    d.arrow([R(t), L(ap)], "")
    d.group(0, 80, 820, 130, "For each identity", "accent")
    st = [("Build payload", "blocks to row list", ""), ("Create account", "API call", "blue"), ("Activate", "send link", "blue"), ("Wait", "fixed pause", ""), ("Verify", "read back the grants", "teal")]
    bs = []
    for i, (n, sub, k) in enumerate(st):
        bs.append(d.box(14 + i * 160, 108, 130, 74, n, sub, k))
        if i:
            d.arrow([R(bs[i - 1]), L(bs[i])], "accent")
    d.arrow([(515, 52), (515, 80)], "gold")
    d.arrow([(790, 182), (790, 198), (80, 198), (80, 182)], "accent", dash=True, label="next identity; a failure is recorded and the loop continues", lpos=(430, 192))
    d.box(290, 238, 240, 48, "Notify", "every identity, its grants, any failures", "green")
    d.arrow([(410, 210), (410, 238)], "teal")
    return d.html("<b>Why read-back matters.</b> The target had no atomic add, so additions merge into the current list and save it whole, and the verify step catches a success response that changed nothing.")


@dgm("form-to-rule", "19-complex-application-patterns.md")
def form_to_rule():
    d = D("form-to-rule", 820, 340, "Five ways to get form data into a rule",
          "Comments, entitlement name, staging table, direct call from the workflow, and a live lookup inside the rule.")
    fm = d.box(6, 130, 130, 80, "Form and workflow", "the requester's choices", "blue")
    ch = [("Request comments", "text or JSON on the access request", "teal"), ("Entitlement name", "the value carries the data", "teal"),
          ("Staging table", "request id with the selections", ""), ("Direct call", "workflow calls the target API", "gold"), ("Live lookup in the rule", "ask the target for the missing fact", "violet")]
    cb = []
    for i, (t, sub, k) in enumerate(ch):
        y = 10 + i * 64
        cb.append(d.box(250, y, 250, 52, t, sub, k))
        d.arrow([R(fm), (190, 170), (190, y + 26), (250, y + 26)], "accent")
    rule = d.box(620, 100, 190, 80, "Provisioning rule", "parses, checks, and writes", "accent")
    for i in (0, 1, 2, 4):
        d.arrow([R(cb[i]), (560, 10 + i * 64 + 26), (560, 140), (620, 140)], "accent")
    d.box(620, 220, 190, 60, "Target system", "", "")
    d.arrow([(715, 180), (715, 220)], "accent")
    d.arrow([R(cb[3]), (560, 10 + 3 * 64 + 26), (560, 250), (620, 250)], "gold")
    return d.html("<b>Choosing a channel.</b> Comments only exist for requests that came through your workflow; an entitlement name survives every route; a direct call skips the plan, so ISC's view lags until the next aggregation.")


@dgm("multi-db-central", "19-complex-application-patterns.md")
def multi_db_central():
    d = D("multi-db-central", 820, 330, "One source in front of many client databases",
          "Client databases are consolidated into a central database that ISC reads; provisioning calls a procedure that writes to the right client database.")
    for i, n in enumerate(["Client database 1", "Client database 2", "Client database 3"]):
        d.cyl(6, 20 + i * 80, 150, 64, n)
    d.box(210, 100, 120, 60, "Sync job", "kept by the application team", "")
    for i in range(3):
        d.arrow([(156, 52 + i * 80), (210, 130)], "")
    c = d.cyl(380, 70, 200, 150, "Central database", "users, entitlements and a client-to-database map")
    d.arrow([(330, 130), (380, 130)], "")
    src = d.box(650, 70, 160, 60, "ISC source", "aggregates accounts and groups", "accent")
    d.arrow([(580, 100), (650, 100)], "accent", label="aggregate", lpos=(614, 94))
    d.box(650, 160, 160, 60, "Request form", "group and client", "blue")
    d.arrow([(730, 160), (730, 130)], "blue", dash=True, label="client map, as entitlement", lpos=(722, 150), lanchor="end")
    pr = d.box(380, 262, 200, 52, "Provisioning rule", "reads group and client, looks up the database", "gold")
    d.arrow([(730, 220), (730, 288), (580, 288)], "gold")
    d.box(110, 262, 200, 52, "Stored procedure", "user, group, target database", "violet")
    d.arrow([L(pr), (310, 288)], "gold")
    d.arrow([(210, 262), (82, 262), (82, 230)], "gold", dash=True, label="writes to the right database", lpos=(150, 256))
    return d.html("<b>Central integration database.</b> One source, one schedule and one runbook instead of one source per database. The cost is the sync job and a procedure the application team must own.")


# ------------------------------------------------------------------ 20 rules
@dgm("rules-where-run", "20-cloud-and-connector-rule-templates.md")
def rules_where_run():
    d = D("rules-where-run", 820, 330, "Where cloud rules and connector rules run",
          "Cloud rules run inside ISC with no network. Connector rules run on the appliance around the connector's own calls.")
    d.group(0, 8, 400, 314, "Inside ISC", "accent")
    d.group(420, 8, 400, 314, "On the virtual appliance", "teal")
    cr = [("Identity attribute rule", "lifecycle state, dates"), ("Attribute generator", "login name, email"), ("Correlation rule", "match account to identity")]
    for i, (t, sub) in enumerate(cr):
        d.box(24, 36 + i * 62, 200, 50, t, sub, "violet")
    d.box(250, 36, 140, 174, "Identity profile, policies and source configuration", "call these rules", "")
    for i in range(3):
        d.arrow([(224, 61 + i * 62), (250, 61 + i * 62)], "")
    d.box(24, 236, 200, 50, "Before provisioning rule", "adjust the plan", "violet")
    d.box(250, 236, 140, 62, "Provisioning plan", "built per request", "gold")
    d.arrow([(224, 261), (250, 261)], "")
    cn = [("Before operation rule", "body, token, parameters"), ("JDBC provision rule", "every write"), ("After operation / build map", "reshape, disabled flag")]
    for i, (t, sub) in enumerate(cn):
        d.box(440, 36 + i * 64, 190, 52, t, sub, "teal")
    d.box(650, 36, 160, 118, "Connector", "managed client, no extra connections", "blue")
    d.box(650, 180, 160, 118, "Target system", "", "")
    d.arrow([(630, 62), (650, 62)], "teal")
    d.arrow([(630, 126), (650, 100)], "teal")
    d.arrow([(630, 190), (650, 120)], "teal")
    d.arrow([(730, 154), (730, 180)], "teal")
    d.arrow([(390, 267), (420, 267), (420, 190), (440, 190)], "gold", label="plan", lpos=(406, 260))
    return d.html("<b>Two places, two rules of the road.</b> Cloud rules need SailPoint review and cannot call out. Connector rules are edited through the API and take effect on the next run.")


@dgm("cloud-rule-review", "20-cloud-and-connector-rule-templates.md")
def cloud_rule_review():
    d = D("cloud-rule-review", 820, 190, "Getting a cloud rule deployed",
          "Write and validate, submit with the validator output, integrity check, review, deploy; use a temporary copy in change windows.")
    st = [("Write and validate", "one rule per use case, tested", ""), ("Submit", "rule, validator output, tenant, approval", "blue"), ("Integrity check", "not a test that it works", "violet"), ("Review", "about a day; longer if complex", "gold"), ("Deployed", "in the tenant", "teal")]
    bs = row(d, 6, 30, st, 140, 86, 28)
    d.box(6, 140, 808, 40, "Change window: submit a -TEMP copy, validate it, then update the original and ask for the copy to be deleted", "", "ghost")
    return d.html("<b>Lead time is real.</b> Plan about a day per cloud-rule change; connector rules have no review step.")


# ------------------------------------------------------------------ 21 sftp
@dgm("sftp-architecture", "21-sftp-server-for-flat-file-sources.md")
def sftp_architecture():
    d = D("sftp-architecture", 820, 330, "SFTP host for flat-file sources",
          "A tool places files in per-application folders; the appliance cluster reads them over SFTP for each SQL Loader source.")
    d.box(6, 20, 150, 56, "Application owner", "sends the access list", "")
    d.box(6, 130, 150, 66, "Placement tool", "stage, install, checksum", "gold")
    d.arrow([(81, 76), (81, 130)], "")
    d.group(220, 8, 330, 314, "SFTP host (firewalled)", "accent")
    for i, n in enumerate(["app01", "app02", "app03"]):
        d.box(240, 40 + i * 84, 290, 66, f"/{n}/data", f"one login per application, file per cycle", "teal")
    d.arrow([(156, 163), (240, 163)], "gold", label="22", lpos=(198, 157))
    d.box(620, 40, 194, 66, "VA cluster", "reads over SFTP", "blue")
    d.arrow([(620, 73), (530, 73)], "blue", label="22", lpos=(575, 67))
    d.box(620, 140, 194, 90, "SQL Loader source", "url, login, table = file name, merge and index columns", "violet")
    d.arrow([(717, 106), (717, 140)], "blue")
    d.box(620, 260, 194, 52, "ISC aggregation", "correlate, then review", "accent")
    d.arrow([(717, 230), (717, 260)], "violet")
    d.text(385, 318, "", "l")
    return d.html("<b>Flat-file path.</b> One shared host, one login and folder per application. Only the appliances and the placement tool connect; application owners never do.")


# ------------------------------------------------------------------ 22 VA setup
@dgm("va-setup-flow", "22-virtual-appliance-and-cluster-setup.md")
def va_setup_flow():
    d = D("va-setup-flow", 820, 270, "Building a virtual appliance cluster",
          "Plan, prepare the network, deploy, configure, create the cluster, pair each appliance, verify.")
    st = [("1 Plan clusters", "sources, hosts, method", ""), ("2 Network", "firewall, DNS, NTP, proxy", ""), ("3 Deploy image", "change the default password", "blue"), ("4 Configure", "static IP, NTP, hosts file, proxy", "blue"),
          ("5 Create cluster", "name, time zone, type", "accent"), ("6 Pair each VA", "same passphrase, code valid 4 hours", "accent"), ("7 Wait", "about 30 minutes", ""), ("8 Verify", "connected, test source, failover", "teal")]
    r1 = row(d, 6, 20, st[:4], 180, 80, 29, akind="accent")
    r2 = row(d, 6, 160, st[4:], 180, 80, 29, akind="accent")
    d.arrow([(716, 100), (716, 130), (96, 130), (96, 160)], "accent")
    return d.html("<b>Order matters.</b> The network and the plan come first; sources are attached only after every appliance shows connected and a failover test has passed.")


@dgm("va-ha-dr", "22-virtual-appliance-and-cluster-setup.md")
def va_ha_dr():
    d = D("va-ha-dr", 820, 300, "High availability and disaster recovery",
          "Two or more appliances in the active cluster give high availability; a second cluster is the disaster recovery path and needs sources re-pointed and credentials re-entered.")
    d.box(330, 10, 160, 50, "ISC tenant", "", "accent")
    d.group(6, 100, 380, 120, "Primary cluster (active)", "teal")
    d.box(26, 130, 150, 66, "VA 1", "host or zone A", "blue")
    d.box(206, 130, 160, 66, "VA 2", "host or zone B", "blue")
    d.group(434, 100, 380, 120, "DR cluster (standby)", "gold")
    d.box(454, 130, 150, 66, "VA 3", "other site", "")
    d.box(634, 130, 160, 66, "VA 4", "other site", "")
    d.arrow([(196, 100), (380, 60)], "teal")
    d.arrow([(624, 100), (440, 60)], "gold", dash=True)
    d.box(250, 250, 320, 40, "Sources", "attached to one cluster at a time", "")
    d.arrow([(196, 220), (330, 250)], "teal")
    d.arrow([(624, 220), (490, 250)], "gold", dash=True, label="failover: re-point, re-enter credentials", lpos=(806, 246), lanchor="end")
    return d.html("<b>Rolling updates need a pair.</b> One appliance at a time is updated, so two keep the cluster up. SailPoint advises building a new cluster rather than moving existing appliances.")


# ------------------------------------------------------------------ 23 network
@dgm("net-path-owners", "23-network-problems-and-resolution.md")
def net_path_owners():
    d = D("net-path-owners", 820, 220, "The connectivity path and who owns each hop",
          "Tenant, appliance, source. The appliance only calls out.")
    a = d.box(6, 60, 150, 80, "ISC tenant", "", "accent")
    b = d.box(330, 60, 150, 80, "VA cluster", "outbound only", "blue")
    c = d.box(660, 60, 154, 80, "Source system", "directory, database, API", "")
    d.arrow([L(b), R(a)], "accent", label="443 out", lpos=(243, 94))
    d.arrow([R(b), L(c)], "", label="source protocol", lpos=(570, 94))
    d.text(243, 180, "network and security", "h")
    d.text(570, 180, "network and source owner", "h")
    d.text(405, 30, "DNS 53 and NTP 123 to internal servers: infrastructure", "l")
    d.text(405, 206, "Script or administrator to the API: whoever runs the script (proxy, rate limit, token)", "l")
    return d.html("<b>Outbound only.</b> A request to allow SailPoint in is the wrong request; the firewall rule is from the appliance to the destination.")


@dgm("net-ladder", "23-network-problems-and-resolution.md")
def net_ladder():
    d = D("net-ladder", 820, 400, "Six steps for any connectivity problem",
          "Name resolution, route, port, transport security, authentication, application; stop at the first failure.")
    rows = [("1  Name resolution", "nslookup <host>   dig <host>", "wrong or no address, split DNS"),
            ("2  Route", "ping <host> (if ICMP allowed)", "no route to host, asymmetric path"),
            ("3  Port", "nc -vz <host> <port>", "timeout = dropped, refused = closed"),
            ("4  Transport security", "openssl s_client -connect <host>:<port>", "untrusted CA, inspection, expired"),
            ("5  Authentication", "test connection from the source", "rotated credential, wrong account"),
            ("6  Application", "run the operation, read the response", "rate limit, timeout, error in a 200 body")]
    d.text(110, 18, "STEP", "h")
    d.text(410, 18, "COMMAND, FROM THE VA OR ITS SUBNET", "h")
    d.text(700, 18, "TYPICAL FAILURE", "h")
    for i, (a, b, c) in enumerate(rows):
        y = 30 + i * 60
        d.box(6, y, 200, 48, a, "", "accent" if i < 3 else "blue")
        d.box(222, y, 340, 48, b, "", "")
        d.box(578, y, 236, 48, c, "", "ghost")
    return d.html("<b>Work up the stack.</b> Test from the appliance's own network where you can, because its DNS, route and firewall rules are the ones that count.")


def build():
    pass


# ------------------------------------------------------------------ index and 06
@dgm("operating-model", "index.md")
def operating_model():
    d = D("operating-model", 820, 408, "The operating model at a glance",
          "HR data flows through aggregation, the identity profile and rules to a lifecycle state; events start the joiner, mover, leaver, request and certification processes, which reach targets through appliance clusters.")
    d.text(6, 14, "FOUNDATION", "h", "start")
    f = [("HR system", "authoritative", "blue"), ("Aggregate and correlate", "hourly, attribute match", ""), ("Identity profile", "mappings and transforms", ""), ("Cloud rules", "state, dates, names", "violet"), ("Lifecycle state", "pre joiner to inactive", "teal"), ("Event bus", "attribute changed, post-provisioning, form, cron", "accent")]
    fb = row(d, 6, 22, f, 118, 76, 20)
    d.text(6, 124, "PROCESSES, EACH A SET OF WORKFLOWS", "h", "start")
    pr = [("Joiner and rehire", "accounts, mails, IT form", "accent"), ("Mover", "location and job changes", "accent"), ("Leaver", "disable, notify, recover assets", "accent"),
          ("Access request", "profiles, forms, approvals", "gold"), ("Certification", "campaigns, source-owner reviews", "gold")]
    pb = []
    for i, (t, sub, k) in enumerate(pr):
        pb.append(d.box(6 + i * 163, 134, 150, 70, t, sub, k))
    d.arrow([B(fb[5]), (B(fb[5])[0], 114), (81, 114), (81, 134)], "accent", plain=False)
    for i in range(1, 5):
        d.arrow([(B(fb[5])[0], 114), (6 + i * 163 + 75, 114), (6 + i * 163 + 75, 134)], "accent")
    d.text(6, 236, "REACH", "h", "start")
    d.group(0, 244, 820, 70, "Virtual appliance clusters")
    for i, n in enumerate(["HR cluster", "Directory clusters", "Application cluster", "Application cluster"]):
        d.box(20 + i * 196, 262, 176, 40, n, "", "blue")
    for i in range(5):
        d.arrow([(81 + i * 163, 204), (81 + i * 163, 244)], "")
    d.box(6, 330, 808, 62, "Targets", "directories, REST applications, SQL databases, SaaS finance and workflow products, an ITSM mailbox, and flat files for review-only applications", "")
    d.arrow([(410, 314), (410, 330)], "")
    return d.html("<b>One model, five processes.</b> Redrawn from the tenant's own overview: everything downstream depends on the HR feed and on the rules that compute the lifecycle state.")


@dgm("connector-choice", "06-connector-patterns.md")
def connector_choice():
    d = D("connector-choice", 820, 360, "Choosing an integration pattern",
          "Apply the questions in order and stop at the first that fits.")
    qs = [("Authenticates through Active Directory?", "govern the directory groups", "AD connector", "teal"),
          ("A purpose-built connector exists?", "check what it cannot do", "Direct connector", "teal"),
          ("A documented REST API for users and roles?", "expect to write rules", "Web Services", "blue"),
          ("A database you may read and write?", "build map and provisioning rules", "JDBC", "blue"),
          ("None of the above?", "aggregation, correlation and reviews", "Flat file over SFTP", "gold")]
    for i, (q, sub, out, k) in enumerate(qs):
        y = 10 + i * 66
        d.diamond(150, y + 28, 290, 56, q, "gold")
        d.box(430, y + 4, 200, 48, out, sub, k)
        d.arrow([(295, y + 28), (430, y + 28)], k if k != "blue" else "accent", label="yes", lpos=(360, y + 22))
        if i < 4:
            d.arrow([(150, y + 56), (150, y + 76)], "")
    d.box(660, 10, 154, 90, "Why this order", "least custom code first. Each step down adds rules to build and own", "ghost")
    d.box(660, 130, 154, 100, "Disconnected", "a ticket-based application is the last resort. Keep the ticket as the audit trail", "ghost")
    d.box(660, 260, 154, 90, "Nothing at all", "out of scope until the application changes", "ghost")
    return d.html("<b>Selection principle.</b> Directory first, then a purpose-built connector, then web services or JDBC, then a flat file. A flat file is not a failure; it gave review coverage to most of the estate.")


# ------------------------------------------------------------------ 26 offboarding
@dgm("ownership-blast-radius", "26-implementation-team-offboarding.md")
def ownership_blast_radius():
    d = D("ownership-blast-radius", 820, 360, "What a departing implementer takes with them",
          "Ownership, credentials, routing and knowledge, each with the objects and the impact if left untransferred.")
    d.box(300, 140, 220, 80, "Departing implementer", "created most of the platform", "accent")
    quad = [
        (6, 8, "Ownership", "workflows 25 of 28, sources about 75 percent, access profiles over 90 percent, roles 272 of 284", "accent", "highest: automation stops"),
        (484, 8, "Credentials", "workflow tokens, personal tokens used by scripts and tools, shared expiry dates", "gold", "high: integrations fail"),
        (6, 232, "Routing", "approvers, governance groups of one, hard-coded mail, no fallback approver", "gold", "high: work waits forever"),
        (484, 232, "Knowledge", "scripts, local dumps, secret custody, authenticator, support contacts", "violet", "high: cannot repair"),
    ]
    for x, y, t, sub, k, tag in quad:
        d.box(x, y, 330, 118, t, sub, k, tag)
    d.arrow([(360, 140), (330, 126)], "accent")
    d.arrow([(460, 140), (490, 126)], "accent")
    d.arrow([(360, 220), (330, 232)], "accent")
    d.arrow([(460, 220), (490, 232)], "accent")
    return d.html("<b>Four ties.</b> The same person usually appears in all four, which is why offboarding an implementer is a project and not a ticket. Figures are from the final tenant snapshot.")


@dgm("offboarding-phases", "26-implementation-team-offboarding.md")
def offboarding_phases():
    d = D("offboarding-phases", 820, 340, "Offboarding timeline",
          "Inventory, design, reassign, make repeatable, shadow, then disable, observe and delete after the departure.")
    x0, x1 = 30, 790
    def X(day):
        return x0 + (day + 90) * (x1 - x0) / 150.0
    d.line([(x0, 170), (x1, 170)], "")
    for day, lab in [(-90, "T-90"), (-60, "T-60"), (-30, "T-30"), (0, "departure"), (30, "T+30"), (60, "T+60")]:
        d.line([(X(day), 164), (X(day), 176)], "")
        d.text(X(day), 190, lab, "l")
    def bar(a, b, y, t, sub, kind, h=56):
        d.box(X(a), y, X(b) - X(a) - 4, h, t, sub, kind)
    bar(-90, -75, 12, "Inventory", "owner register", "blue", 64)
    bar(-75, -60, 84, "Design", "target owners", "blue", 64)
    bar(-60, -30, 12, "Reassign", "groups, items, sources, workflows, forms, tokens", "accent", 64)
    bar(-30, 0, 84, "Shadow", "receiving team runs it", "gold", 64)
    bar(-30, 0, 12, "Repeatable", "register and monitors", "teal", 64)
    bar(0, 30, 206, "Disable, observe", "failures, exports, approvals", "gold", 70)
    bar(30, 60, 270, "Delete", "when nothing is owned", "violet", 56)
    d.arrow([(X(0), 176), (X(0), 206)], "accent")
    d.text(410, 336, "Disable first, delete last. Offboard downstream accounts in the directories and applications yourself.", "l")
    return d.html("<b>A sequence, not an event.</b> Dates are relative to the departure. Start the inventory three months out; the reassignments are the long pole.")


# ------------------------------------------------------------------ apply
def apply():
    done = []
    for name, (page, fn) in REG.items():
        p = ROOT / page
        s = p.read_text()
        block = "```html\n" + fn() + "\n```"
        ph = f"@@dgm:{name}@@"
        pat = re.compile(r"```html\n<!-- dgm:" + re.escape(name) + r" -->.*?\n```", re.S)
        if pat.search(s):
            s = pat.sub(lambda m: block, s, count=1)
        elif ph in s:
            s = s.replace(ph, block, 1)
        else:
            done.append(f"MISSING placeholder {name} in {page}")
            continue
        p.write_text(s)
        done.append(f"ok {name}")
    print("\n".join(done))
    prev = ["<!doctype html><html lang=en class=js data-theme=dark><head><meta charset=utf-8><meta name=darkreader-lock><link rel=stylesheet href=/styles.css>"
            "<style>body{padding:20px;max-width:900px;margin:auto;background:var(--canvas);color:var(--text)} .sd-fig{margin:10px 0 30px} h5{color:#fa625f;font-family:monospace}</style></head><body>"]
    for name, (page, fn) in REG.items():
        prev.append(f"<h5>{name}</h5>" + fn().replace('class="sd-fig reveal"', 'class="sd-fig"'))
    prev.append("</body></html>")
    (ROOT.parent / "tools" / "preview.html").write_text("\n".join(prev))


if __name__ == "__main__":
    apply()
