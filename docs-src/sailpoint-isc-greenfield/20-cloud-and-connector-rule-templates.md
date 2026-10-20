---
title: Cloud Rule and Connector Rule Templates and Snippets
---

Rules are where most of the real integration logic lived on the program: 13 cloud rules and 41 connector rules. This page is the starting kit: which rule type to use, how to deliver one, and a template for each shape we used. The snippets are generalised from the program's rules with names, hosts and credentials removed. They show structure. **Compile every one in the validator and test it on a sandbox source before use.** Class and method names should be checked against the Javadoc for your tenant release.

## Two kinds of rule

| | Cloud rule | Connector rule |
|---|---|---|
| Runs | Inside ISC | On the virtual appliance, around a connector operation |
| Network access | None | The connector's own managed client only |
| Editable | By SailPoint, after review | Directly, through the connector-rule API |
| Typical use | Compute a value, correlate, adjust a plan | Parse a response, build a request, talk to a database |
| Review | Submitted to SailPoint, with the validator output. Most are reviewed within about a day | None |
| Lives in | Source, identity profile or provisioning policy configuration | A source operation or a source attribute |

The review difference drives workflow. A cloud-rule change is a request with a lead time. A connector-rule change is an API call that takes effect on the next run, which makes it fast and dangerous.

```html
<!-- dgm:rules-where-run -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 330" role="img" aria-labelledby="rules-where-run-t rules-where-run-d" xmlns="http://www.w3.org/2000/svg"><title id="rules-where-run-t">Where cloud rules and connector rules run</title><desc id="rules-where-run-d">Cloud rules run inside ISC with no network. Connector rules run on the appliance around the connector&#x27;s own calls.</desc><defs><marker id="rules-where-run-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="rules-where-run-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="rules-where-run-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="grp accent" x="0" y="8" width="400" height="314" style="fill:none;stroke:var(--accent);stroke-opacity:0.6;stroke-dasharray:6 4"/><text class="h" x="10" y="23" text-anchor="start">Inside ISC</text><rect class="grp teal" x="420" y="8" width="400" height="314" style="fill:none;stroke:var(--teal);stroke-opacity:0.65;stroke-dasharray:6 4"/><text class="h" x="430" y="23" text-anchor="start">On the virtual appliance</text><rect class="box violet" x="24" y="36" width="200" height="50" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="124.0" y="58.0" text-anchor="middle">Identity attribute rule</text><text class="s" x="124.0" y="73.0" text-anchor="middle">lifecycle state, dates</text><rect class="box violet" x="24" y="98" width="200" height="50" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="124.0" y="120.0" text-anchor="middle">Attribute generator</text><text class="s" x="124.0" y="135.0" text-anchor="middle">login name, email</text><rect class="box violet" x="24" y="160" width="200" height="50" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="124.0" y="182.0" text-anchor="middle">Correlation rule</text><text class="s" x="124.0" y="197.0" text-anchor="middle">match account to identity</text><rect class="box " x="250" y="36" width="140" height="174" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="320.0" y="90.0" text-anchor="middle">Identity</text><text class="t" x="320.0" y="105.0" text-anchor="middle">profile,</text><text class="t" x="320.0" y="120.0" text-anchor="middle">policies and</text><text class="t" x="320.0" y="135.0" text-anchor="middle">source</text><text class="t" x="320.0" y="150.0" text-anchor="middle">configuration</text><text class="s" x="320.0" y="165.0" text-anchor="middle">call these rules</text><path class="ln   " d="M224,61 L250,61" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#rules-where-run-ar)"/><path class="ln   " d="M224,123 L250,123" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#rules-where-run-ar)"/><path class="ln   " d="M224,185 L250,185" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#rules-where-run-ar)"/><rect class="box violet" x="24" y="236" width="200" height="50" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="124.0" y="258.0" text-anchor="middle">Before provisioning rule</text><text class="s" x="124.0" y="273.0" text-anchor="middle">adjust the plan</text><rect class="box gold" x="250" y="236" width="140" height="62" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="320.0" y="256.5" text-anchor="middle">Provisioning</text><text class="t" x="320.0" y="271.5" text-anchor="middle">plan</text><text class="s" x="320.0" y="286.5" text-anchor="middle">built per request</text><path class="ln   " d="M224,261 L250,261" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#rules-where-run-ar)"/><rect class="box teal" x="440" y="36" width="190" height="52" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="535.0" y="59.0" text-anchor="middle">Before operation rule</text><text class="s" x="535.0" y="74.0" text-anchor="middle">body, token, parameters</text><rect class="box teal" x="440" y="100" width="190" height="52" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="535.0" y="123.0" text-anchor="middle">JDBC provision rule</text><text class="s" x="535.0" y="138.0" text-anchor="middle">every write</text><rect class="box teal" x="440" y="164" width="190" height="52" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="535.0" y="179.5" text-anchor="middle">After operation / build</text><text class="t" x="535.0" y="194.5" text-anchor="middle">map</text><text class="s" x="535.0" y="209.5" text-anchor="middle">reshape, disabled flag</text><rect class="box blue" x="650" y="36" width="160" height="118" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="730.0" y="85.5" text-anchor="middle">Connector</text><text class="s" x="730.0" y="100.5" text-anchor="middle">managed client, no</text><text class="s" x="730.0" y="113.5" text-anchor="middle">extra connections</text><rect class="box " x="650" y="180" width="160" height="118" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="730.0" y="242.5" text-anchor="middle">Target system</text><path class="ln teal  " d="M630,62 L650,62" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#rules-where-run-ar-teal)"/><path class="ln teal  " d="M630,126 L650,100" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#rules-where-run-ar-teal)"/><path class="ln teal  " d="M630,190 L650,120" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#rules-where-run-ar-teal)"/><path class="ln teal  " d="M730,154 L730,180" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#rules-where-run-ar-teal)"/><path class="ln gold  " d="M390,267 L420,267 L420,190 L440,190" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#rules-where-run-ar-gold)"/><text class="l" x="406" y="260" text-anchor="middle">plan</text></svg></div><figcaption><b>Two places, two rules of the road.</b> Cloud rules need SailPoint review and cannot call out. Connector rules are edited through the API and take effect on the next run.</figcaption></figure>
```

### Cloud rule types

| Type | Purpose | Typical input | Returns |
|---|---|---|---|
| Account profile attribute generator | Compute an account attribute when provisioning (a login name, an email) | The identity, the application, and the helper object | A value |
| Identity attribute rule | Compute an identity attribute for the identity profile | The identity | A value |
| Correlation rule | Match an account to an identity with logic a simple criterion cannot express | The account | A map naming the identity attribute and the value to match |
| Before provisioning rule | Adjust the provisioning plan before it reaches the source | The plan, the identity, the application | Nothing (it edits the plan) |
| Manager correlation rule | Work out an identity's manager | The account or identity | A map |
| BuildMap rule | Reshape rows from a file | The row data | A map |
| Transform rule | Used by a transform | The transform input | A value |

Variables seen in the program's rules: `identity` and `application` for generators and attribute rules, `account` for correlation, `plan`, `application` and `identity` for before-provisioning, and in all of them `log` and the helper `idn`.

### Connector rule types

| Type | Connector | Purpose | Variables seen |
|---|---|---|---|
| Before operation | Web Services | Run before an HTTP operation: set the body, add a header, fetch a value | `application`, `requestEndPoint`, `oldResponseMap`, `restClient`, plus `provisioningPlan` on write operations. Returns the end point |
| After operation | Web Services | Run after an HTTP operation: parse, reshape, set the disabled flag | `application`, `requestEndPoint`, `processedResponseObject`, `rawResponseObject`, `restClient`. Returns the list of accounts or groups |
| BuildMap | JDBC | Turn each result row into an account map | `result`, `schema`. Returns the map |
| JDBC provision | JDBC | Perform every write | `plan`, `connection`, `application`. Returns a provisioning result |
| BuildMap | Delimited file | Reshape parsed file rows | the row data |
| Before and after create, modify, delete | Active Directory | Run a script on the directory agent | (scripts run on the Windows host) |

SailPoint's documentation states that connector rules run on the appliance, receive managed connections from the platform, and that **additional connections or call-outs are not allowed.** On the program, web-services rules made calls through the connector's own client helper and that worked. Raw HTTP libraries did not (see the connectors pages). Treat any call a rule makes as a dependency and keep it to the connector's helper.

## Delivering rules safely

### Cloud rules

- **One rule per use case, updated in place.** Dozens of near-identical copies accumulated: four lifecycle-state variants and two next-processing-date variants sat in the tenant, with only one referenced. Keep the name plain and archive history in version control.
- **Controlled change window.** SailPoint's guidance is to submit a `-TEMP` copy, validate it in the window, then update the original and ask for the temporary one to be deleted.
- **Submission standard.** UTF-8, readable indentation, comments on non-obvious logic, no commented-out code, tested. Run the validator before you submit and attach its output.
- **Plan lead time.** Allow about a day, and more for a rule that is complex or poorly commented.

```html
<!-- dgm:cloud-rule-review -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 190" role="img" aria-labelledby="cloud-rule-review-t cloud-rule-review-d" xmlns="http://www.w3.org/2000/svg"><title id="cloud-rule-review-t">Getting a cloud rule deployed</title><desc id="cloud-rule-review-d">Write and validate, submit with the validator output, integrity check, review, deploy; use a temporary copy in change windows.</desc><defs><marker id="cloud-rule-review-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box " x="6" y="30" width="140" height="86" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="76.0" y="56.0" text-anchor="middle">Write and</text><text class="t" x="76.0" y="71.0" text-anchor="middle">validate</text><text class="s" x="76.0" y="86.0" text-anchor="middle">one rule per use</text><text class="s" x="76.0" y="99.0" text-anchor="middle">case, tested</text><rect class="box blue" x="174" y="30" width="140" height="86" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="244.0" y="57.0" text-anchor="middle">Submit</text><text class="s" x="244.0" y="72.0" text-anchor="middle">rule, validator</text><text class="s" x="244.0" y="85.0" text-anchor="middle">output, tenant,</text><text class="s" x="244.0" y="98.0" text-anchor="middle">approval</text><rect class="box violet" x="342" y="30" width="140" height="86" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="412.0" y="63.5" text-anchor="middle">Integrity check</text><text class="s" x="412.0" y="78.5" text-anchor="middle">not a test that it</text><text class="s" x="412.0" y="91.5" text-anchor="middle">works</text><rect class="box gold" x="510" y="30" width="140" height="86" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="580.0" y="63.5" text-anchor="middle">Review</text><text class="s" x="580.0" y="78.5" text-anchor="middle">about a day; longer</text><text class="s" x="580.0" y="91.5" text-anchor="middle">if complex</text><rect class="box teal" x="678" y="30" width="140" height="86" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="748.0" y="70.0" text-anchor="middle">Deployed</text><text class="s" x="748.0" y="85.0" text-anchor="middle">in the tenant</text><path class="ln   " d="M146,73.0 L174,73.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#cloud-rule-review-ar)"/><path class="ln   " d="M314,73.0 L342,73.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#cloud-rule-review-ar)"/><path class="ln   " d="M482,73.0 L510,73.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#cloud-rule-review-ar)"/><path class="ln   " d="M650,73.0 L678,73.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#cloud-rule-review-ar)"/><rect class="box ghost" x="6" y="140" width="808" height="40" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="410.0" y="156.0" text-anchor="middle">Change window: submit a -TEMP copy, validate it, then update the original and ask for the copy to be</text><text class="t" x="410.0" y="171.0" text-anchor="middle">deleted</text></svg></div><figcaption><b>Lead time is real.</b> Plan about a day per cloud-rule change; connector rules have no review step.</figcaption></figure>
```

### Connector rules

The connector-rule API supports create, update, delete and a validate call. Attach a rule to a source with a JSON patch:

```text
PATCH /v3/sources/{id}         Content-Type: application/json-patch+json
```

| What you attach | Path |
|---|---|
| Before provisioning rule | `/beforeProvisioningRule` |
| Native rules (directory scripts) | `/connectorAttributes/nativeRules` (a list: set all of them together) |
| Account correlation rule | `/accountCorrelationRule` |
| Manager correlation rule | `/managerCorrelationRule` |
| BuildMap or JDBC BuildMap | `/connectorAttributes/buildMapRule` |
| JDBC provision | `/connectorAttributes/jdbcProvisionRule` |
| Web Services operation before or after | `/connectorAttributes/connectionParameters/<index>/beforeRule` and `/afterRule` |

```json
[
  { "op": "replace", "path": "/connectorAttributes/jdbcProvisionRule", "value": "<rule name>" }
]
```

Paths and endpoint versions change, so confirm them in the current API reference. The rule's `script` field is a JSON string, so newlines and quotes must be escaped. Generate it with a script, not by hand.

### House rules for every rule

1. **Header comment** with purpose, owner, version, date and the sources it is attached to.
2. **No credentials, no URLs with secrets.** Read them from the source.
3. **Idempotent.** Running twice must not do harm.
4. **Log with `log`, not a webhook,** and never log a secret or a whole account map in production.
5. **Fail loudly on missing input,** quietly on "nothing to do".
6. **Set the disabled flag in both directions** in any rule that builds accounts.
7. **Never rename an entitlement format** a rule parses.
8. **List every rule in the documentation pack,** with the sources it serves. A rule shared by two sources changes both.

## Cloud rule templates

:::details Template: unique login name (account profile attribute generator)
Used for a directory login name built from name parts plus a counter, with a uniqueness check and a hard limit so it cannot loop forever. The helper checks the name against accounts already on the source.

```java
import java.util.Random;

// Purpose : generate a unique login name (<=8 chars) from first and last name.
// Owner   : <team>      Version: 1.0      Attached to: <directory source> create policy

int MAX_ATTEMPTS = 2000;
int counter = 1;
int attempts = 0;
String CHARS = "abcdefghijklmnopqrstuvwxyz";

public String clean(String s) {
    if (s == null || s.trim().isEmpty()) s = "def";
    s = s.replaceAll("[^a-zA-Z]", "").toLowerCase();
    // pad short names so the pattern below always has three characters
    Random r = new Random();
    StringBuilder b = new StringBuilder(s);
    while (b.length() < 3) b.append(CHARS.charAt(r.nextInt(CHARS.length())));
    return b.toString();
}

public String build(String fn, String ln, int n) {
    String first = fn.substring(0, Math.min(3, fn.length()));
    String last  = ln.substring(Math.max(0, ln.length() - 3));
    String num   = (n < 10) ? "0" + n : String.valueOf(n);
    String out   = first + last + num;
    // trim to the limit, shortening the name part and keeping the counter
    if (out.length() > 8) out = (first + last).substring(0, 8 - num.length()) + num;
    return out;
}

public boolean unique(String candidate) {
    return !idn.accountExistsByDisplayName(application.getName(), candidate);
}

String fn = clean(identity.getAttribute("firstname"));
String ln = clean(identity.getAttribute("lastname"));
String candidate;
do {
    candidate = build(fn, ln, counter++);
    attempts++;
} while (!unique(candidate) && attempts < MAX_ATTEMPTS);

if (attempts >= MAX_ATTEMPTS) {
    throw new RuntimeException("Could not generate a unique login name after " + MAX_ATTEMPTS + " attempts");
}
log.debug("Generated login name " + candidate);
return candidate;
```

Notes: decide what a name with accents, hyphens or one letter should produce, and test those. Keep the check against live data, because two people hired the same day will collide. Document the pattern, because the service desk will be asked how it works.
:::

:::details Template: date calculated in the person's own time zone (identity attribute rule)
Used for lifecycle and "next processing" attributes. The key points are to read the person's time zone, to fall back safely when it is missing or invalid, and to treat the date as a point in time.

```java
import java.time.*;
import java.time.format.DateTimeFormatter;

// Purpose : compute the instant a person becomes inactive, at 22:00 local on the end date.
String DEFAULT_ZONE = "<IANA zone, for example Europe/London>";

String endDate = identity.getAttribute("endDate");     // yyyy-MM-dd or ISO instant
String tz      = identity.getAttribute("timezone");

if (endDate == null || endDate.trim().isEmpty()) return null;   // no end date: no value

ZoneId zone;
try {
    zone = ZoneId.of(tz);
} catch (Exception e) {                                  // null or invalid zone
    zone = ZoneId.of(DEFAULT_ZONE);
}

LocalDate day;
try {
    day = endDate.contains("T")
        ? ZonedDateTime.parse(endDate, DateTimeFormatter.ISO_ZONED_DATE_TIME).toLocalDate()
        : LocalDate.parse(endDate, DateTimeFormatter.ISO_LOCAL_DATE);
} catch (Exception e) {
    log.warn("Unparseable end date: " + endDate);
    return null;
}

ZonedDateTime cutoff = day.atTime(22, 0).atZone(zone);
return cutoff.toInstant().toString();                    // store as UTC
```

Notes: compare dates as instants, never as local strings. Test the daylight-saving change days, a missing zone, and an end date in the past.
:::

:::details Template: correlation rule
Used when a simple "attribute equals attribute" criterion is not enough, such as a privileged account with a prefix that must be stripped to find its owner.

```java
Map out = new HashMap();

String login = account.getStringAttribute("sAMAccountName");
String value;
if (login == null || login.trim().isEmpty()) {
    value = "NO_MATCH_BLANK";          // a value that cannot match, rather than null
} else if (login.indexOf('_') == 1 && login.indexOf('_') == login.lastIndexOf('_')) {
    value = login.substring(2);        // "a_jsmith" -> "jsmith"
} else {
    value = login;
}

out.put("identityAttributeName", "<identity attribute>");
out.put("identityAttributeValue", value);
return out;
```

Notes: return a value that cannot match, not null, for a blank input. Remember matching is exact, so normalise case on both sides.
:::

:::details Template: before-provisioning rule skeleton
Used to change the plan before it reaches the source: rewrite an operation, add an argument, or drop an entitlement. Keep each change small and table-driven.

```java
import sailpoint.object.ProvisioningPlan;
import sailpoint.object.ProvisioningPlan.AccountRequest;
import sailpoint.object.ProvisioningPlan.AttributeRequest;

String P = "BeforeProv <name> - ";
if (plan == null || plan.getAccountRequests() == null) return;

for (AccountRequest ar : plan.getAccountRequests()) {
    ProvisioningPlan.ObjectOperation op = ar.getOp();

    // Example: turn a disable into a modify that moves the account
    if (ProvisioningPlan.ObjectOperation.Disable.equals(op)) {
        log.debug(P + "rewriting Disable for " + ar.getNativeIdentity());
        ar.setOp(ProvisioningPlan.ObjectOperation.Modify);
        ar.add(new AttributeRequest("<attribute>", ProvisioningPlan.Operation.Set, "<value>"));
        continue;
    }

    // Example: never touch a protected account
    String ni = ar.getNativeIdentity();
    if (ni != null && ni.startsWith("<protected prefix>")) {
        throw new RuntimeException(P + "refusing to change protected account " + ni);
    }
}
```

Notes: a before rule changes what the connector receives, so test every operation (create, modify, enable, disable, delete) after any edit. A rule that turns disable into modify must also set the attributes that do the real work.
:::

:::details Template: turn add and remove into set (replace-only connectors)
For a connector that cannot add or remove one value of a multi-valued attribute and cannot read a single account, the rule reads the current values from ISC, applies the change, and sends the whole list.

```java
import java.util.*;
import sailpoint.object.ProvisioningPlan;
import sailpoint.object.Schema;

private List asList(Object o) {
    if (o instanceof Collection) return new ArrayList((Collection) o);
    return new ArrayList(Collections.singletonList(o));
}

String P = "AddRemoveToSet - ";
if (plan == null || plan.getAccountRequests() == null) return;
Schema schema = application.getSchema("account");
if (schema == null) { log.warn(P + "no account schema"); return; }

for (ProvisioningPlan.AccountRequest ar : plan.getAccountRequests()) {
    if (ProvisioningPlan.ObjectOperation.Create.equals(ar.getOp())) continue;
    if (ProvisioningPlan.ObjectOperation.Delete.equals(ar.getOp())) continue;
    if (ar.getAttributeRequests() == null) continue;

    for (ProvisioningPlan.AttributeRequest a : ar.getAttributeRequests()) {
        if (a.getName() == null || a.getValue() == null || a.getOp() == null) continue;
        boolean add = ProvisioningPlan.Operation.Add.equals(a.getOp());
        boolean rem = ProvisioningPlan.Operation.Remove.equals(a.getOp());
        if (!add && !rem) continue;
        if (!schema.isMultiValued(a.getName())) continue;

        String ni = ar.getNativeIdentity() != null ? ar.getNativeIdentity() : plan.getNativeIdentity();
        String app = ar.getApplicationName() != null ? ar.getApplicationName() : application.getName();
        if (ni == null) { log.error(P + "no native identity"); continue; }

        Object acct = idn.getAccountByNativeIdentity(app, ni);
        if (acct == null) { log.error(P + "account not found " + ni); continue; }
        Object current = idn.getRawAccountAttribute(acct, a.getName());
        if (current == null) continue;

        List values = asList(current);
        List change = asList(a.getValue());
        if (add) values.addAll(change); else values.removeAll(change);
        a.setValue(values);
        a.setOp(ProvisioningPlan.Operation.Set);
    }
}
```

Notes: the read comes from ISC's last aggregation, so a value changed in the target since then is overwritten. State that limit in the integration notes, and prefer a live read in a connector rule when the target allows one.
:::

## Connector rule templates

:::details Template: web services before operation (build a body, no credentials)
Used on a write operation to build the request body from the plan, optionally enriched by a live lookup. Credentials come from the source, not the rule.

```java
import java.util.*;
import connector.common.JsonUtil;
import sailpoint.object.ProvisioningPlan.AccountRequest;
import sailpoint.object.ProvisioningPlan.AttributeRequest;
import sailpoint.connector.webservices.WebServicesClient;
import sailpoint.tools.Util;

String P = "<Source> BeforeAddEnt - ";

// 1. Read what the plan carries
String nativeId = null;
String value = null;
for (AccountRequest ar : (List<AccountRequest>) provisioningPlan.getAccountRequests()) {
    nativeId = ar.getNativeIdentity();
    AttributeRequest req = ar.getAttributeRequest("<entitlement attribute>");
    if (req != null && req.getValue() != null) value = req.getValue().toString();
}
if (Util.isNullOrEmpty(nativeId) || Util.isNullOrEmpty(value)) {
    throw new RuntimeException(P + "native identity or entitlement value missing");
}

// 2. Optional live lookup through the connector's client (needs a token the source already holds)
// WebServicesClient client = new WebServicesClient();
// Map args = new HashMap(); args.put("url", lookupUrl); client.configure(args);
// String json = client.executeGet(lookupUrl, headers, Arrays.asList("2**"));
// if (Util.isNullOrEmpty(json)) throw new RuntimeException(P + "lookup returned nothing");

// 3. Build the body. Escape values; prefer a map and JSON serialiser to string concatenation.
Map payload = new LinkedHashMap();
payload.put("userId", nativeId);
payload.put("entitlementId", value);
// payload.put("startDate", startDate);

Map body = new HashMap();
body.put("jsonBody", JsonUtil.toJson(payload));   // confirm the serialiser name for your release
requestEndPoint.setBody(body);

log.info(P + "built body for " + nativeId);
return requestEndPoint;
```

Notes: never build JSON by concatenating strings around user values, because a quote in a name breaks the request. Check the lookup result and fail with a clear message. Do not paste a client id or secret into the rule: one early rule did, and it is a security finding.
:::

:::details Template: web services before operation for revoke (read live, then decide)
Used when removing access needs the target's current state: remove one role, or delete the row if it would be empty, or disable the user if nothing remains. Reading live data makes revoke correct even when the aggregated view is stale.

```java
String P = "<Source> BeforeRemove - ";

// 1. Parse the identifiers packed into the entitlement value: "<name> ((<rowId>::<roleId>))"
String ent = <entitlement value from the attribute request>;
int a = ent.lastIndexOf("((");
int b = ent.lastIndexOf("))");
if (a < 0 || b < a) throw new RuntimeException(P + "entitlement value has no identifier segment: " + ent);
String[] ids = ent.substring(a + 2, b).split("::");
if (ids.length != 2) throw new RuntimeException(P + "identifier segment malformed: " + ent);
String rowId = ids[0];
String roleId = ids[1];

// 2. Read the live grants for this user
// String live = client.executePost(getUserUrl, headers, body, Arrays.asList("2**"));

// 3. Decide
//    - the row keeps other roles      -> call "remove role from row"
//    - removing would empty the row   -> call "delete row"
//    - the user would have no access  -> call "disable user"

// 4. Return the end point configured for the chosen call.
return requestEndPoint;
```

Notes: if the format of the value changes, this rule and the aggregation rule that produces it must change in the same release. Throw when the identifier is missing, so a failed parse never reports success.
:::

:::details Template: web services after operation (aggregation, disabled flag in both directions)
Used to turn the raw response into accounts, set the disabled flag and keep only the fields you want.

```java
import java.util.*;
import connector.common.JsonUtil;
import sailpoint.tools.GeneralException;

String P = "<Source> AfterAccountAgg - ";
try {
    List<Map> users = JsonUtil.parseJson(rawResponseObject);
    List out = new ArrayList();

    for (Map u : users) {
        Object status = u.get("<status field>");

        // Compare tolerantly and set the flag in both directions.
        boolean inactive = status != null && "inactive".equalsIgnoreCase(status.toString().trim());
        u.put("IIQDisabled", inactive);

        // Allowlist: keep only the fields the schema defines.
        Map clean = new HashMap();
        for (String k : new String[] { "<id>", "<name>", "<email>", "<group list>" }) {
            if (u.containsKey(k)) clean.put(k, u.get(k));
        }
        clean.put("IIQDisabled", inactive);
        out.add(clean);
    }

    log.info(P + "accounts returned: " + out.size());   // a population monitor in the log
    Map result = new HashMap();
    result.put("data", out);
    return result;

} catch (Exception e) {
    throw new GeneralException(P + "error processing response: " + e.getMessage(), e);
}
```

Notes: a single case-sensitive test such as `"InActive".equals(status)` silently makes every account look enabled when the application changes its wording. An allowlist stops a vendor adding a field that quietly changes what ISC stores. Log the count so a truncated feed is visible.
:::

:::details Template: web services after operation for groups (a dummy entitlement)
For an application with no groups, give every account one entitlement to review and revoke.

```java
Map role = new HashMap();
role.put("Id", "<stable id>");
role.put("Name", "<Application> Access");
List data = new ArrayList();
data.add(role);
Map out = new HashMap();
out.put("data", data);
return out;
```

Notes: pair it with a before-remove rule that turns "remove the dummy entitlement" into the application's offboarding call, and document that revoking it does that.
:::

:::details Template: JDBC build map
Used to turn a database row into an account map and set the disabled flag from a status column.

```java
import sailpoint.connector.*;
import java.util.Map;

Map map = JDBCConnector.buildMapFromResultSet(result, schema);

if (map != null) {
    Object st = map.get("<status column>");
    // both directions, tolerant comparison, and a deliberate default for unknown values
    boolean disabled = (st == null) ? false : !"active".equalsIgnoreCase(st.toString().trim());
    map.put("IIQDisabled", disabled);
}
return map;
```

Notes: decide what an unknown or null status means and write it down. Do not log the whole map on every row in production.
:::

:::details Template: JDBC provisioning rule skeleton
Used to perform every write on a database source. The structure that worked: one helper per statement, one branch per operation, a result object that records success or failure, and a transaction around multi-statement operations.

```java
import java.sql.*;
import java.util.*;
import sailpoint.object.ProvisioningPlan;
import sailpoint.object.ProvisioningPlan.AccountRequest;
import sailpoint.object.ProvisioningPlan.AttributeRequest;
import sailpoint.object.ProvisioningResult;
import connector.common.JsonUtil;

String P = "<Source> JDBCProvision - ";

public Object attr(AccountRequest ar, String name) {
    AttributeRequest r = (ar == null) ? null : ar.getAttributeRequest(name);
    return (r == null) ? null : r.getValue();
}

// Read and consume the metadata that the request workflow put in the comments
public Map readMeta(AccountRequest ar, String attrName) {
    AttributeRequest r = ar.getAttributeRequest(attrName);
    if (r == null || r.getComments() == null) throw new RuntimeException(P + "request carries no metadata");
    Map m = JsonUtil.toMap(r.getComments());
    r.setComments(null);
    if (m == null) throw new RuntimeException(P + "METADATA IS NULL");
    return m;
}

public boolean exists(Connection c, String user, String role, String entity) throws SQLException {
    try (PreparedStatement s = c.prepareStatement(
            "SELECT COUNT(*) FROM <assignment table> WHERE UserName = ? AND RoleName = ? AND Entity = ?")) {
        s.setString(1, user); s.setString(2, role); s.setString(3, entity);
        try (ResultSet rs = s.executeQuery()) { rs.next(); return rs.getInt(1) > 0; }
    }
}

ProvisioningResult result = new ProvisioningResult();

if (plan != null && plan.getAccountRequests() != null) {
    for (AccountRequest ar : (List<AccountRequest>) plan.getAccountRequests()) {
        try {
            String user = ar.getNativeIdentity();
            if (user == null || user.trim().isEmpty() || "none".equals(user)) {
                throw new RuntimeException(P + "no native identity");
            }

            if (AccountRequest.Operation.Create.equals(ar.getOperation())) {
                Map meta = readMeta(ar, "<entitlement attribute>");
                connection.setAutoCommit(false);
                try {
                    // INSERT account ... ; INSERT assignment ...   (parameterised statements only)
                    connection.commit();
                    result.setStatus(ProvisioningResult.STATUS_COMMITTED);
                } catch (SQLException e) {
                    connection.rollback();
                    throw e;
                } finally {
                    connection.setAutoCommit(true);
                }

            } else if (AccountRequest.Operation.Modify.equals(ar.getOperation())) {
                // for each AttributeRequest: Add -> insert (check exists() first), Remove -> delete
                result.setStatus(ProvisioningResult.STATUS_COMMITTED);

            } else if (AccountRequest.Operation.Disable.equals(ar.getOperation())) {
                // UPDATE account SET status = <disabled> WHERE user = ?
                result.setStatus(ProvisioningResult.STATUS_COMMITTED);

            } else if (AccountRequest.Operation.Enable.equals(ar.getOperation())) {
                // UPDATE account SET status = <enabled> WHERE user = ?
                result.setStatus(ProvisioningResult.STATUS_COMMITTED);

            } else {
                throw new RuntimeException(P + "unsupported operation " + ar.getOperation());
            }
        } catch (Exception e) {
            log.error(P + "failed: " + e.getMessage());
            result.setStatus(ProvisioningResult.STATUS_FAILED);
            result.addError(e);
        }
    }
}
return result;
```

Notes:

- **Parameterised statements only.** Names come from forms and HR data.
- **A transaction around multi-statement creates,** with a rollback. Several helpers in the program's rules marked a failure without rolling back, so a sequence of modifies could succeed in part.
- **One status per account request.** In a loop, make sure a later success does not overwrite an earlier failure. Keep a flag.
- **Unknown operations should fail,** not fall through silently.
- **Do not catch and ignore.** A swallowed exception sent a request with blank fields once.
:::

:::details Template: delimited-file customisation rule (cloud)
The default rule for a cloud flat-file source is a single call. Keep it unless you need to reshape rows.

```java
import sailpoint.thunderbolt.service.ConnectorService;

return ConnectorService.applyStandardFlatFileCustomizations(context, application, connector, object);
```
:::

:::details Snippet: a safe debug helper (use only if you must)
Logging through `log` is the right choice. If a diagnostic webhook already exists, this is the safe shape: it is gated by a flag, has short timeouts, and can never fail the operation.

```java
boolean DEBUG_WEBHOOK = false;        // keep false in production

public void debugSend(String message) {
    if (!DEBUG_WEBHOOK) return;
    try {
        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL("<listener url>").openConnection();
        c.setConnectTimeout(2000);
        c.setReadTimeout(2000);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.getOutputStream().write(message.getBytes("UTF-8"));
        c.getResponseCode();
    } catch (Exception e) {
        log.warn("debug webhook failed: " + e.getMessage());   // swallow
    }
}
```

The unsafe version threw on failure and set no timeouts, which made provisioning fail or hang whenever the listener was down. Four production rules carried it.
:::

## Testing rules

| Step | How |
|---|---|
| Compile | The rule validator, before every submission or update |
| Unit logic | Copy the pure functions (parsing, name building) into a scratch class and run them against a table of inputs, including empty, null, very long and accented values |
| One object | Run the operation for a single test account before a batch |
| Each operation | Create, modify, enable, disable, delete after any edit to a provisioning rule |
| Negative | A missing comment, a malformed entitlement value, a null status, an API error body returned with HTTP 200 |
| Evidence | Keep the log lines and a before and after of the target for the documentation pack |
| Rollback | Keep the previous version of the script so a bad change is one API call to undo |

### Common errors

| Symptom | Likely cause |
|---|---|
| Compile error on a type | A missing import, or a class the sandbox does not allow |
| `Rule: <name> not found` | The rule name in the source does not match |
| Rule runs but nothing changes | The attach path or the operation index is wrong |
| `METADATA IS NULL` | The request carried no comment (see the complex applications page) |
| A literal placeholder lands in the target | A before rule did not run on that operation |
| Every account enabled after a vendor update | A status comparison stopped matching |
| Hang or consecutive aggregation errors after a change | A raw HTTP library inside the rule |

## Actions

- Keep every rule in version control with its attach path, and export from the tenant on a schedule to catch drift.
- Start from a template here, strip what you do not need, and add the header comment.
- Review each new rule for credentials, debug helpers and disabled-flag direction before it is attached.
- Budget a day of lead time for every cloud-rule change.
- Test negative cases as carefully as the happy path.
