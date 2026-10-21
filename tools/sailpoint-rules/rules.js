// SailPoint ISC rule and transform templates. Pure functions, no DOM.
// Rule types, input argument names and return values come from SailPoint's public developer documentation
// (developer.sailpoint.com, Extensibility > Rules), read on 2026-10-21. Code bodies are examples written for this tool:
// test each one in a sandbox tenant. Cloud rules also need SailPoint's review before they are deployed.

export const GROUPS = ["Cloud rules", "Connector rules", "Transforms"];

const IDN = ["idn", "sailpoint.server.IdnRuleUtil", "Read-only entry point to the identity and account data model."];
const LOG = ["log", "org.apache.log4j.Logger", "Logger. Output is visible only to SailPoint personnel."];

const P = {
	str: (key, label, def, hint) => ({ key, label, def, hint, kind: "string" }),
	ident: (key, label, def, hint) => ({ key, label, def, hint, kind: "ident" }),
	list: (key, label, def, hint) => ({ key, label, def, hint, kind: "idents" }),
	names: (key, label, def, hint) => ({ key, label, def, hint, kind: "names" }),
	int: (key, label, def, hint) => ({ key, label, def, hint, kind: "int" }),
};

const CLOUD_NOTES = [
	"Runs in the SailPoint cloud with read-only access to the data model and no on-premises access.",
	"Must be reviewed by SailPoint before it is deployed (rules are submitted by ticket). File name: Rule - {type} - {name}.xml.",
	"Add null checks and try/catch. Do not log sensitive data, hard-code values, or use code the review blocks (see the checker tab).",
];
const CONNECTOR_NOTES = [
	"Runs on the virtual appliance (connector executed). It cannot query the SailPoint data model and cannot make extra connections or callouts.",
	"Log output goes to ccg.log on the virtual appliance. Attach the rule to the source as described in the connector rules documentation.",
];

export const TEMPLATES = [
	// ============================================================ cloud rules
	{
		id: "ia-lifecycle",
		group: "Cloud rules",
		type: "IdentityAttribute",
		title: "Lifecycle state from start and end dates",
		summary: "Returns the active or inactive value from two date attributes on the identity. Based on SailPoint's own lifecycle example, with null and parse handling added.",
		inputs: [LOG, IDN, ["identity", "sailpoint.object.Identity", "The identity being calculated."], ["oldValue", "java.lang.Object", "The attribute value before the rule runs."]],
		output: ["attributeValue", "java.lang.Object", "The value of the identity attribute."],
		params: [
			P.str("startAttr", "Start date attribute", "startDate"),
			P.str("endAttr", "End date attribute", "endDate"),
			P.str("dateFormat", "Date format", "yyyy-MM-dd", "Java SimpleDateFormat pattern."),
			P.str("activeValue", "Value when active", "active"),
			P.str("inactiveValue", "Value when inactive", "inactive"),
		],
		body: () => `import java.text.SimpleDateFormat;
import java.util.Date;

SimpleDateFormat fmt = new SimpleDateFormat("{{dateFormat}}");
Date today = new Date();
Date startDate = null;
Date endDate = null;

try {
	Object startText = identity.getAttribute("{{startAttr}}");
	if (startText != null && startText.toString().trim().length() > 0) {
		startDate = fmt.parse(startText.toString().trim());
	}
	Object endText = identity.getAttribute("{{endAttr}}");
	if (endText != null && endText.toString().trim().length() > 0) {
		endDate = fmt.parse(endText.toString().trim());
	}
} catch (Exception e) {
	log.warn("Lifecycle rule: cannot read a date for identity " + identity.getName() + ": " + e.getMessage());
	return null;
}

// An end date in the past always wins.
if (endDate != null && endDate.before(today)) {
	return "{{inactiveValue}}";
}
// Otherwise the identity is active once the start date has been reached.
if (startDate != null && !startDate.after(today)) {
	return "{{activeValue}}";
}
return null;`,
		notes: [...CLOUD_NOTES, "The lifecycle state attribute is calculated last in a refresh, so it can use other identity attributes. Avoid uniqueness logic in identity attribute rules."],
	},
	{
		id: "ia-displayname",
		group: "Cloud rules",
		type: "IdentityAttribute",
		title: "Display name from first and last name",
		summary: "Joins two identity attributes, trims them, and falls back to a third attribute when either is empty.",
		inputs: [LOG, IDN, ["identity", "sailpoint.object.Identity", "The identity being calculated."], ["oldValue", "java.lang.Object", "The attribute value before the rule runs."]],
		output: ["attributeValue", "java.lang.Object", "The value of the identity attribute."],
		params: [P.str("firstAttr", "First name attribute", "firstname"), P.str("lastAttr", "Last name attribute", "lastname"), P.str("fallbackAttr", "Fallback attribute", "uid")],
		body: () => `Object first = identity.getAttribute("{{firstAttr}}");
Object last = identity.getAttribute("{{lastAttr}}");
String f = (first == null) ? "" : first.toString().trim();
String l = (last == null) ? "" : last.toString().trim();

if (f.length() > 0 && l.length() > 0) {
	return f + " " + l;
}

Object fallback = identity.getAttribute("{{fallbackAttr}}");
if (fallback != null && fallback.toString().trim().length() > 0) {
	return fallback.toString().trim();
}
return null;`,
		notes: CLOUD_NOTES,
	},
	{
		id: "corr-email",
		group: "Cloud rules",
		type: "Correlation",
		title: "Correlate on email built from the username",
		summary: "Builds an email address from an account attribute and a fixed domain, then correlates on the email identity attribute. Based on SailPoint's example.",
		inputs: [LOG, IDN, ["account", "sailpoint.object.ResourceObject", "The aggregated account data (read-only)."], ["application", "sailpoint.object.Application", "The source being correlated (read-only)."]],
		output: ["returnMap", "java.util.Map", "Must contain identityAttributeName and identityAttributeValue."],
		params: [P.str("usernameAttr", "Account attribute", "username"), P.str("domain", "Email domain", "example.com"), P.str("identityAttr", "Identity attribute to match", "email", "Must be searchable.")],
		body: () => `String user = account.getStringAttribute("{{usernameAttr}}");
if (user == null || user.trim().length() == 0) {
	log.warn("Correlation: account has no {{usernameAttr}}");
	return null;
}

Map returnMap = new HashMap();
returnMap.put("identityAttributeName", "{{identityAttr}}");
returnMap.put("identityAttributeValue", user.trim().toLowerCase() + "@{{domain}}");
return returnMap;`,
		notes: [...CLOUD_NOTES, "The identity attribute named in identityAttributeName must be searchable. The rule runs before the configured correlation. Returning null for no match is the usual convention: confirm in a sandbox."],
	},
	{
		id: "corr-empno",
		group: "Cloud rules",
		type: "Correlation",
		title: "Correlate on an employee number with leading zeros removed",
		summary: "Strips leading zeros from an account attribute so 000123 and 123 match the same identity.",
		inputs: [LOG, IDN, ["account", "sailpoint.object.ResourceObject", "The aggregated account data (read-only)."], ["application", "sailpoint.object.Application", "The source being correlated (read-only)."]],
		output: ["returnMap", "java.util.Map", "Must contain identityAttributeName and identityAttributeValue."],
		params: [P.str("accountAttr", "Account attribute", "employeeNo"), P.str("identityAttr", "Identity attribute to match", "employeeNumber")],
		body: () => `String raw = account.getStringAttribute("{{accountAttr}}");
if (raw == null || raw.trim().length() == 0) {
	return null;
}

// "000123" -> "123", but keep a single "0" as it is
String normalised = raw.trim().replaceFirst("^0+(?!$)", "");

Map returnMap = new HashMap();
returnMap.put("identityAttributeName", "{{identityAttr}}");
returnMap.put("identityAttributeValue", normalised);
return returnMap;`,
		notes: [...CLOUD_NOTES, "The identity attribute must hold the same normalised form (strip zeros there too, with a transform), or nothing will match."],
	},
	{
		id: "mgr-email",
		group: "Cloud rules",
		type: "ManagerCorrelation",
		title: "Manager by email attribute",
		summary: "Finds the manager by matching an account attribute (the manager's email) to the email identity attribute. Based on SailPoint's example.",
		inputs: [LOG, IDN, ["link", "sailpoint.object.Link", "The aggregated account (read-only)."], ["managerAttributeValue", "java.lang.Object", "The value stored in the manager attribute."]],
		output: ["returnMap", "java.util.Map", "Must contain identityAttributeName and identityAttributeValue."],
		params: [P.str("linkAttr", "Account attribute holding the manager email", "manager.email"), P.str("identityAttr", "Identity attribute to match", "email")],
		body: () => `String managerEmail = link.getAttribute("{{linkAttr}}");
if (managerEmail == null || managerEmail.trim().length() == 0) {
	return null;
}

Map returnMap = new HashMap();
returnMap.put("identityAttributeName", "{{identityAttr}}");
returnMap.put("identityAttributeValue", managerEmail.trim());
return returnMap;`,
		notes: [...CLOUD_NOTES, "Runs before the configured manager correlation. Useful when the authoritative source has several accounts per identity."],
	},
	{
		id: "mgr-value",
		group: "Cloud rules",
		type: "ManagerCorrelation",
		title: "Manager by the stored manager attribute value",
		summary: "Uses managerAttributeValue directly, trimmed, as the value of an identity attribute (for example the manager's employee number).",
		inputs: [LOG, IDN, ["link", "sailpoint.object.Link", "The aggregated account (read-only)."], ["managerAttributeValue", "java.lang.Object", "The value stored in the manager attribute."]],
		output: ["returnMap", "java.util.Map", "Must contain identityAttributeName and identityAttributeValue."],
		params: [P.str("identityAttr", "Identity attribute to match", "employeeNumber")],
		body: () => `if (managerAttributeValue == null) {
	return null;
}
String value = managerAttributeValue.toString().trim();
if (value.length() == 0) {
	return null;
}

Map returnMap = new HashMap();
returnMap.put("identityAttributeName", "{{identityAttr}}");
returnMap.put("identityAttributeValue", value);
return returnMap;`,
		notes: CLOUD_NOTES,
	},
	{
		id: "bp-enable-modify",
		group: "Cloud rules",
		type: "BeforeProvisioning",
		title: "Turn Enable and Disable into a Modify of one attribute",
		summary: "For sources that disable accounts by setting an attribute instead of a native disable. Based on the pattern in SailPoint's example.",
		inputs: [LOG, IDN, ["plan", "sailpoint.object.ProvisioningPlan", "The provisioning instructions sent to the connector."], ["application", "sailpoint.object.Application", "The source being provisioned (read-only)."], ["integration", "sailpoint.object.IntegrationConfig", "The integration that references the rule."]],
		output: null,
		params: [P.str("attr", "Attribute that carries the disable state", "IIQDisabled", "Use the attribute your connector expects."), P.str("disabledValue", "Value that means disabled", "true")],
		body: () => `import sailpoint.object.*;
import sailpoint.object.ProvisioningPlan.*;

if (plan == null || plan.getAccountRequests() == null) {
	return;
}

for (AccountRequest accountRequest : plan.getAccountRequests()) {
	boolean disable = ProvisioningPlan.ObjectOperation.Disable.equals(accountRequest.getOp());
	boolean enable = ProvisioningPlan.ObjectOperation.Enable.equals(accountRequest.getOp());
	if (!disable && !enable) {
		continue;
	}

	accountRequest.setOp(ProvisioningPlan.ObjectOperation.Modify);

	AttributeRequest attributeRequest = new AttributeRequest();
	attributeRequest.setName("{{attr}}");
	attributeRequest.setOperation(ProvisioningPlan.Operation.Set);
	attributeRequest.setValue(disable ? "{{disabledValue}}" : "false");
	accountRequest.add(attributeRequest);
}`,
		notes: [...CLOUD_NOTES, "There is no return value: the rule changes the plan in place. Do not use it to create new attributes. Use a provisioning policy for that."],
	},
	{
		id: "bp-strip",
		group: "Cloud rules",
		type: "BeforeProvisioning",
		title: "Remove an attribute request before it is sent",
		summary: "Drops every request for one attribute from the plan, for example one the target must never receive.",
		inputs: [LOG, IDN, ["plan", "sailpoint.object.ProvisioningPlan", "The provisioning instructions sent to the connector."], ["application", "sailpoint.object.Application", "The source being provisioned (read-only)."], ["integration", "sailpoint.object.IntegrationConfig", "The integration that references the rule."]],
		output: null,
		params: [P.str("attr", "Attribute to remove", "description")],
		body: () => `import sailpoint.object.*;
import sailpoint.object.ProvisioningPlan.*;
import java.util.ArrayList;
import java.util.List;

if (plan == null || plan.getAccountRequests() == null) {
	return;
}

for (AccountRequest accountRequest : plan.getAccountRequests()) {
	if (accountRequest.getAttributeRequests() == null) {
		continue;
	}
	// copy first: removing while iterating the same list fails
	List toRemove = new ArrayList();
	for (AttributeRequest attributeRequest : accountRequest.getAttributeRequests()) {
		if ("{{attr}}".equals(attributeRequest.getName())) {
			toRemove.add(attributeRequest);
		}
	}
	for (Object o : toRemove) {
		accountRequest.remove((AttributeRequest) o);
	}
}`,
		notes: CLOUD_NOTES,
	},
	{
		id: "ag-username",
		group: "Cloud rules",
		type: "AttributeGenerator",
		title: "Unique username (first.last, then first.last2, ...)",
		summary: "Generates an account attribute during provisioning and checks that the name is free. Uses idn.accountExistsByDisplayName as in SailPoint's example.",
		inputs: [LOG, IDN, ["identity", "sailpoint.object.Identity", "The identity the value is generated for."], ["application", "sailpoint.object.Application", "The source being provisioned to (read-only)."], ["field", "sailpoint.object.Field", "Metadata about the attribute being generated."]],
		output: ["value", "java.lang.Object", "The generated value, or null when none is found."],
		params: [P.int("maxTries", "Maximum attempts", "1000", "Stops the loop if every name is taken."), P.str("separator", "Separator between first and last", ".")],
		body: () => `String first = identity.getFirstname();
String last = identity.getLastname();
if (first == null || last == null) {
	return null;
}
first = first.trim().toLowerCase().replaceAll("[^a-z0-9]", "");
last = last.trim().toLowerCase().replaceAll("[^a-z0-9]", "");
if (first.length() == 0 || last.length() == 0) {
	return null;
}

String base = first + "{{separator}}" + last;
String username = base;
int attempt = 1;
while (idn.accountExistsByDisplayName(application.getName(), username)) {
	attempt++;
	if (attempt > {{maxTries}}) {
		log.warn("No free username found for " + base);
		return null;
	}
	username = base + attempt;
}
return username;`,
		notes: [...CLOUD_NOTES, "Check how the target treats case and length, and add a length limit if it has one. idn.accountExistsByDisplayName matches the account display name: confirm that it is the attribute your source stores the username in."],
	},
	{
		id: "ag-email",
		group: "Cloud rules",
		type: "AttributeGenerator",
		title: "Email address from name",
		summary: "first.last@domain, lower case, with accents and spaces removed. It does not check that the address is free.",
		inputs: [LOG, IDN, ["identity", "sailpoint.object.Identity", "The identity the value is generated for."], ["application", "sailpoint.object.Application", "The source being provisioned to (read-only)."], ["field", "sailpoint.object.Field", "Metadata about the attribute being generated."]],
		output: ["value", "java.lang.Object", "The generated value, or null."],
		params: [P.str("domain", "Email domain", "example.com")],
		body: () => `import java.text.Normalizer;

String first = identity.getFirstname();
String last = identity.getLastname();
if (first == null || last == null) {
	return null;
}

// "José" -> "Jose", then keep letters and digits only
first = Normalizer.normalize(first.trim(), Normalizer.Form.NFD).replaceAll("\\\\p{M}", "").toLowerCase().replaceAll("[^a-z0-9]", "");
last = Normalizer.normalize(last.trim(), Normalizer.Form.NFD).replaceAll("\\\\p{M}", "").toLowerCase().replaceAll("[^a-z0-9]", "");
if (first.length() == 0 || last.length() == 0) {
	return null;
}
return first + "." + last + "@{{domain}}";`,
		notes: [...CLOUD_NOTES, "Combine with a uniqueness check (see the username template) when two people can share a name."],
	},
	{
		id: "bm-combine",
		group: "Cloud rules",
		type: "BuildMap",
		title: "Delimited file: combine two columns",
		summary: "Merges two columns of a delimited file into one value during aggregation. Based on SailPoint's example.",
		signature: ["log", ["cols", "List"], ["record", "List"], "application", "schema"],
		inputs: [["cols", "java.util.List", "Ordered column names from the header or the columns list."], ["record", "java.util.List", "Ordered values of the current row."], ["application", "System.Collections.Hashtable", "The application configuration map."], ["schema", "sailpoint.object.Schema", "The schema of the delimited file source."], LOG],
		output: ["map", "java.util.Map", "The row as a map. Start from DelimitedFileConnector.defaultBuildMap(cols, record)."],
		params: [P.str("first", "First column", "access"), P.str("second", "Second column", "permission"), P.str("target", "Result column", "access"), P.str("joiner", "Joiner", " - ")],
		body: () => `import sailpoint.connector.DelimitedFileConnector;

Map map = DelimitedFileConnector.defaultBuildMap(cols, record);

String a = (String) map.get("{{first}}");
String b = (String) map.get("{{second}}");
if (a != null && b != null) {
	map.remove("{{first}}");
	map.remove("{{second}}");
	map.put("{{target}}", a + "{{joiner}}" + b);
}
return map;`,
		notes: ["Cloud-executed against the delimited file connector, with read-only access to the rows. The XML signature block is optional for BuildMap rules but supported.", ...CLOUD_NOTES.slice(1)],
	},
	{
		id: "bm-split",
		group: "Cloud rules",
		type: "BuildMap",
		title: "Delimited file: split a multi-value column into a list",
		summary: "Turns a column such as GroupA|GroupB into a list so it can be aggregated as a multi-valued entitlement.",
		signature: ["log", ["cols", "List"], ["record", "List"], "application", "schema"],
		inputs: [["cols", "java.util.List", "Ordered column names."], ["record", "java.util.List", "Ordered values of the current row."], ["application", "System.Collections.Hashtable", "The application configuration map."], ["schema", "sailpoint.object.Schema", "The schema of the delimited file source."], LOG],
		output: ["map", "java.util.Map", "The row as a map."],
		params: [P.str("column", "Column to split", "groups"), P.str("delimiter", "Delimiter (a literal character)", "|")],
		body: () => `import sailpoint.connector.DelimitedFileConnector;
import java.util.ArrayList;
import java.util.List;

Map map = DelimitedFileConnector.defaultBuildMap(cols, record);

Object raw = map.get("{{column}}");
if (raw != null && raw instanceof String) {
	List values = new ArrayList();
	// Pattern.quote makes the delimiter literal, so | and . are safe
	for (String part : ((String) raw).split(java.util.regex.Pattern.quote("{{delimiter}}"))) {
		String trimmed = part.trim();
		if (trimmed.length() > 0) {
			values.add(trimmed);
		}
	}
	map.put("{{column}}", values);
}
return map;`,
		notes: ["The column must be marked multi-valued in the schema, or the list is flattened.", ...CLOUD_NOTES],
	},
	{
		id: "tr-normalise",
		group: "Cloud rules",
		type: "Transform",
		title: "Transform rule: capitalise each word",
		summary: "A rule called from a transform. The transform's attributes (such as input) are available as variables in the rule.",
		inputs: [LOG, IDN],
		output: ["value", "java.lang.Object", "The transformed value, usually a String."],
		params: [],
		body: () => `if (input == null) {
	return null;
}
String text = input.toString().trim();
if (text.length() == 0) {
	return null;
}

StringBuilder sb = new StringBuilder();
for (String word : text.toLowerCase().split("\\\\s+")) {
	if (sb.length() > 0) {
		sb.append(" ");
	}
	sb.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
}
return sb.toString();`,
		notes: ["Call it from a transform of type rule: {\"type\": \"rule\", \"attributes\": {\"name\": \"<rule name>\", \"input\": ...}}. The type attribute Transform is required on the Rule element.", ...CLOUD_NOTES],
	},

	// ============================================================ connector rules
	{
		id: "jbm-status",
		group: "Connector rules",
		type: "JDBCBuildMap",
		title: "JDBC: turn a status column into a boolean flag",
		summary: "Builds the default map, then replaces a status text with a true/false attribute. Based on SailPoint's example.",
		inputs: [["result", "java.sql.ResultSet", "The current row of the query."], ["connection", "java.sql.Connection", "The current SQL connection."], ["state", "java.util.Map", "Shared between rows of one aggregation run."], ["application", "sailpoint.object.Application", "The JDBC source."], ["schema", "sailpoint.object.Schema", "The schema being read."]],
		output: ["map", "java.util.Map", "One row as names and values."],
		params: [P.str("statusColumn", "Status column", "status"), P.str("inactiveValue", "Text that means inactive", "inactive"), P.str("flagAttr", "Boolean attribute to set", "inactive")],
		connectorInput: [["result", "java.sql.ResultSet"], ["connection", "java.sql.Connection"], ["state", "java.util.Map"], ["application", "sailpoint.object.Application"], ["schema", "sailpoint.object.Schema"]],
		body: () => `import sailpoint.connector.*;

Map map = JDBCConnector.buildMapFromResultSet(result, schema);

String status = (String) map.get("{{statusColumn}}");
if ("{{inactiveValue}}".equalsIgnoreCase(status)) {
	map.put("{{flagAttr}}", true);
} else {
	map.put("{{flagAttr}}", false);
}
map.remove("{{statusColumn}}");
return map;`,
		notes: [...CONNECTOR_NOTES, "The rule can run extra queries on the connection, which makes aggregation slow if it does so per row. The state map lets you cache lookups for the whole run."],
	},
	{
		id: "jbm-column",
		group: "Connector rules",
		type: "JDBCBuildMap",
		title: "JDBC: add a column the default map left out",
		summary: "Reads one more column straight from the ResultSet and adds it to the map under a chosen name.",
		inputs: [["result", "java.sql.ResultSet", "The current row of the query."], ["connection", "java.sql.Connection", "The current SQL connection."], ["state", "java.util.Map", "Shared between rows of one aggregation run."], ["application", "sailpoint.object.Application", "The JDBC source."], ["schema", "sailpoint.object.Schema", "The schema being read."]],
		output: ["map", "java.util.Map", "One row as names and values."],
		params: [P.ident("column", "Column in the query", "DEPT_NAME"), P.str("attr", "Attribute name in the map", "department")],
		connectorInput: [["result", "java.sql.ResultSet"], ["connection", "java.sql.Connection"], ["state", "java.util.Map"], ["application", "sailpoint.object.Application"], ["schema", "sailpoint.object.Schema"]],
		body: () => `import sailpoint.connector.*;

Map map = JDBCConnector.buildMapFromResultSet(result, schema);

try {
	String value = result.getString("{{column}}");
	if (value != null) {
		map.put("{{attr}}", value.trim());
	}
} catch (java.sql.SQLException e) {
	log.error("Column {{column}} is not in the result set: " + e.getMessage());
}
return map;`,
		notes: [...CONNECTOR_NOTES, "The column must be selected by the source's query. The attribute should exist in the schema."],
	},
	{
		id: "jp-skeleton",
		group: "Connector rules",
		type: "JDBCProvision",
		title: "JDBC: create, modify and delete one table",
		summary: "A parameterised-SQL skeleton for a single user table. Generated from the column list you give. Extend the status handling for your target.",
		inputs: [["connection", "java.sql.Connection", "The current SQL connection."], ["plan", "sailpoint.object.ProvisioningPlan", "The requests to process."], ["application", "sailpoint.object.Application", "The JDBC source."], ["schema", "sailpoint.object.Schema", "The schema of the source."]],
		output: ["result", "sailpoint.object.ProvisioningResult", "Status of the request."],
		params: [P.ident("table", "Table", "users"), P.ident("keyColumn", "Key column (native identity)", "username"), P.list("columns", "Other columns (comma separated)", "email,department", "Each is written from an attribute with the same name.")],
		connectorInput: [["connection", "java.sql.Connection"], ["plan", "sailpoint.object.ProvisioningPlan"], ["application", "sailpoint.object.Application"], ["schema", "sailpoint.object.Schema"]],
		body: (v) => {
			const cols = v.columns.split(",").map((c) => c.trim()).filter(Boolean);
			const insertCols = [v.keyColumn, ...cols];
			const placeholders = insertCols.map(() => "?").join(", ");
			const sets = cols.map((c) => `${c} = ?`).join(", ");
			const lines = [];
			lines.push(`import sailpoint.object.*;
import sailpoint.object.ProvisioningPlan.*;
import java.sql.*;

ProvisioningResult result = new ProvisioningResult();

if (plan == null || plan.getAccountRequests() == null) {
	result.setStatus(ProvisioningResult.STATUS_COMMITTED);
	return result;
}

// the value of one attribute request, or null
String valueOf(AccountRequest req, String name) {
	AttributeRequest ar = req.getAttributeRequest(name);
	return (ar == null || ar.getValue() == null) ? null : ar.getValue().toString();
}

for (AccountRequest req : plan.getAccountRequests()) {
	PreparedStatement ps = null;
	try {
		if (ProvisioningPlan.AccountRequest.Operation.Create.equals(req.getOperation())) {
			ps = connection.prepareStatement("INSERT INTO ${v.table} (${insertCols.join(", ")}) VALUES (${placeholders})");
			ps.setString(1, req.getNativeIdentity());`);
			cols.forEach((c, i) => lines.push(`\t\t\tps.setString(${i + 2}, valueOf(req, "${c}"));`));
			lines.push(`			ps.executeUpdate();
		} else if (ProvisioningPlan.AccountRequest.Operation.Modify.equals(req.getOperation())) {`);
			if (cols.length) {
				lines.push(`			ps = connection.prepareStatement("UPDATE ${v.table} SET ${sets} WHERE ${v.keyColumn} = ?");`);
				cols.forEach((c, i) => lines.push(`\t\t\tps.setString(${i + 1}, valueOf(req, "${c}"));`));
				lines.push(`			ps.setString(${cols.length + 1}, req.getNativeIdentity());
			ps.executeUpdate();`);
			} else lines.push("\t\t\t// no columns to update");
			lines.push(`		} else if (ProvisioningPlan.AccountRequest.Operation.Delete.equals(req.getOperation())) {
			ps = connection.prepareStatement("DELETE FROM ${v.table} WHERE ${v.keyColumn} = ?");
			ps.setString(1, req.getNativeIdentity());
			ps.executeUpdate();
		}
		// Disable, Enable, Lock and Unlock are not handled here. Add branches if the target needs them.
		result.setStatus(ProvisioningResult.STATUS_COMMITTED);
	} catch (SQLException e) {
		log.error("Provisioning failed for " + req.getNativeIdentity() + ": " + e.getMessage());
		result.setStatus(ProvisioningResult.STATUS_FAILED);
		result.addError(e.getMessage());
	} finally {
		if (ps != null) {
			try { ps.close(); } catch (SQLException ignore) {}
		}
	}
}
return result;`);
			return lines.join("\n");
		},
		notes: [...CONNECTOR_NOTES, "Check that an account does not already exist before a create, and handle null values (modify with a null attribute currently writes NULL)."],
	},
	{
		id: "wsb-body",
		group: "Connector rules",
		type: "WebServiceBeforeOperationRule",
		title: "Web Services: fill placeholders in the request body",
		summary: "Replaces tokens such as %%email%% in the body of the next request with values from the provisioning plan, then returns the endpoint.",
		inputs: [["application", "sailpoint.object.Application", "The application whose operation is running."], ["provisioningPlan", "sailpoint.object.ProvisioningPlan", "The requests that update the body or URL."], ["requestEndPoint", "sailpoint.connector.webservices.Endpoint", "The current request: headers, body, URL, method."], ["restClient", "sailpoint.connector.webservices.WebServicesClient", "HTTP client for the target."], ["oldResponseMap", "java.util.Map", "Response of an earlier endpoint of the same operation type."]],
		output: ["updatedEndPoint or map", "Endpoint | Map", "Return the Endpoint, or a Map with updatedEndPoint and connectorStateMap."],
		params: [P.list("attrs", "Attributes (comma separated)", "email,department", "Each %%name%% in the body is replaced.")],
		connectorInput: [["application", "sailpoint.object.Application"], ["provisioningPlan", "sailpoint.object.ProvisioningPlan"], ["requestEndPoint", "sailpoint.connector.webservices.Endpoint"], ["restClient", "sailpoint.connector.webservices.WebServicesClient"], ["oldResponseMap", "java.util.Map"]],
		body: (v) => {
			const names = v.attrs.split(",").map((c) => c.trim()).filter(Boolean);
			return `import sailpoint.object.*;
import sailpoint.object.ProvisioningPlan.*;

String body = requestEndPoint.getBody();
if (body == null || provisioningPlan == null || provisioningPlan.getAccountRequests() == null || provisioningPlan.getAccountRequests().isEmpty()) {
	return requestEndPoint;
}

AccountRequest req = (AccountRequest) provisioningPlan.getAccountRequests().get(0);
String[] names = new String[] { ${names.map((n) => `"${n}"`).join(", ")} };

for (String name : names) {
	AttributeRequest ar = req.getAttributeRequest(name);
	String value = (ar == null || ar.getValue() == null) ? "" : ar.getValue().toString();
	// escape quotes and backslashes so the JSON stays valid
	value = value.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"");
	body = body.replace("%%" + name + "%%", value);
}

requestEndPoint.setBody(body);
return requestEndPoint;`;
		},
		notes: [...CONNECTOR_NOTES, "Only getBody and setBody are shown here. The Endpoint class has more members (headers, URL, method): see SailPoint's javadoc. The documentation lists the map form of the return as type sailpoint.connector.webservices.Map, which looks like a typo: verify against your version."],
	},
	{
		id: "wsa-attr",
		group: "Connector rules",
		type: "WebServiceAfterOperationRule",
		title: "Web Services: add a computed attribute to each parsed record",
		summary: "Walks the parsed records after an operation and adds one derived attribute, then returns them under the data key.",
		inputs: [["application", "sailpoint.object.Application", "The application whose operation ran."], ["processedResponseObject", "List<Map<String, Object>>", "Parsed accounts or groups; keys are schema attributes."], ["requestEndPoint", "sailpoint.connector.webservices.EndPoint", "The request that ran."], ["restClient", "sailpoint.connector.webservices.WebServicesClient", "HTTP client for the target."], ["rawResponseObject", "String", "The raw JSON or XML response."]],
		output: ["updatedAccountOrGroupList", "java.util.Map", "May hold data (the records) and connectorStateMap (state to keep)."],
		params: [P.str("first", "First attribute", "firstName"), P.str("second", "Second attribute", "lastName"), P.str("target", "Attribute to add", "displayName")],
		connectorInput: [["application", "sailpoint.object.Application"], ["processedResponseObject", "java.util.List"], ["requestEndPoint", "sailpoint.connector.webservices.EndPoint"], ["restClient", "sailpoint.connector.webservices.WebServicesClient"], ["rawResponseObject", "java.lang.String"]],
		body: () => `import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

List records = new ArrayList();
if (processedResponseObject != null) {
	for (Object o : processedResponseObject) {
		Map record = (Map) o;
		Object a = record.get("{{first}}");
		Object b = record.get("{{second}}");
		if (a != null && b != null) {
			record.put("{{target}}", a.toString().trim() + " " + b.toString().trim());
		}
		records.add(record);
	}
}

Map updated = new HashMap();
updated.put("data", records);
return updated;`,
		notes: [...CONNECTOR_NOTES, "The rule must return a Map. Put the records under the key data. SailPoint's own example logs after its return statement and uses a variable out of scope, so do not copy that part."],
	},
	{
		id: "ref-ad-ops",
		group: "Connector rules",
		type: "ConnectorBeforeCreate / ConnectorAfterCreate (and Modify, Delete)",
		title: "Active Directory and Entra: before and after operation rules (reference)",
		summary: "Six rule types that call a PowerShell script on the IQService around account create, modify and delete. Reference card: no code is generated.",
		reference: true,
		inputs: [["Application", "System.Collections.Hashtable", "Map of the application configuration."], ["Request", "SailPoint.Utils.objects.AccountRequest", "The account request instructions."], ["Result", "SailPoint.Utils.objects.ServiceResult", "The provisioning result. The rule can change it."]],
		output: null,
		params: [],
		body: () => "",
		notes: ["Type values: ConnectorBeforeCreate, ConnectorBeforeModify, ConnectorBeforeDelete, ConnectorAfterCreate, ConnectorAfterModify, ConnectorAfterDelete. Supported on Active Directory and Azure Active Directory sources.", "SailPoint recommends keeping the wrapper rule minimal and putting the logic in the PowerShell script on the client server, which avoids a SailPoint code review for each change.", "The request-parsing block of SailPoint's PowerShell template is marked as protected code: do not edit it.", "IQService setup: Utils.dll in the IQService folder on each host, and the service running as a dedicated account that can create directories."],
	},
	{
		id: "ref-sap",
		group: "Connector rules",
		type: "SAPBuildMap / SapHrOperationProvisioning",
		title: "SAP rules (reference)",
		summary: "SAPBuildMap transforms SAP data during aggregation (and can make SAP BAPI calls). SapHrOperationProvisioning performs SAP HR modify operations during provisioning. Reference card: no code is generated.",
		reference: true,
		inputs: [],
		output: null,
		params: [],
		body: () => "",
		notes: ["Supported on SAP and SAP HR sources. See SailPoint's SAP BuildMap and SAP HR Provisioning Modify rule pages for the inputs and outputs of each."],
	},

	// ============================================================ transforms
	{
		id: "t-email",
		group: "Transforms",
		type: "transform",
		title: "Email from first and last name",
		summary: "lower( first + '.' + last + '@' + domain ) with spaces removed from each name.",
		inputs: [],
		output: null,
		params: [P.str("name", "Transform name", "Build Email"), P.str("firstAttr", "First name identity attribute", "firstname"), P.str("lastAttr", "Last name identity attribute", "lastname"), P.str("domain", "Domain", "example.com")],
		build: (v) => {
			const idAttr = (n) => ({ type: "replace", attributes: { regex: "\\s+", replacement: "", input: { type: "identityAttribute", attributes: { name: n } } } });
			return { name: v.name, type: "lower", attributes: { input: { type: "concat", attributes: { values: [idAttr(v.firstAttr), ".", idAttr(v.lastAttr), `@${v.domain}`] } } } };
		},
		notes: ["Check each transform type and its attribute names against SailPoint's transform documentation before use. Create with POST /v3/transforms."],
	},
	{
		id: "t-firstvalid",
		group: "Transforms",
		type: "transform",
		title: "First non-empty value from several sources",
		summary: "Takes the first usable account attribute across several sources, in order.",
		inputs: [],
		output: null,
		params: [P.str("name", "Transform name", "First Valid Email"), P.str("attr", "Account attribute", "mail"), P.names("sources", "Sources in priority order (comma separated)", "HR,Active Directory,Directory", "Names as they appear in ISC.")],
		build: (v) => ({
			name: v.name,
			type: "firstValid",
			attributes: { ignoreErrors: true, values: v.sources.split(",").map((s) => s.trim()).filter(Boolean).map((s) => ({ type: "accountAttribute", attributes: { sourceName: s, attributeName: v.attr } })) },
		}),
			notes: ["Source names may contain spaces. Check each transform type and its attribute names against SailPoint's transform documentation."],
	},
	{
		id: "t-lookup",
		group: "Transforms",
		type: "transform",
		title: "Lookup table with a default",
		summary: "Maps codes to values, with a default for anything not in the table.",
		inputs: [],
		output: null,
		params: [P.str("name", "Transform name", "Country Code Lookup"), P.str("attr", "Identity attribute", "countryCode"), P.str("table", "Table (code=value per line, \\n or ;)", "US=United States;GB=United Kingdom;IN=India"), P.str("def", "Default", "Unknown")],
		build: (v) => {
			const table = {};
			for (const pair of v.table.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)) {
				const i = pair.indexOf("=");
				if (i > 0) table[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
			}
			table.default = v.def;
			return { name: v.name, type: "lookup", attributes: { table, input: { type: "identityAttribute", attributes: { name: v.attr } } } };
		},
		notes: ["The reserved key default is returned when no key matches."],
	},
	{
		id: "t-conditional",
		group: "Transforms",
		type: "transform",
		title: "Conditional on an attribute value",
		summary: "Returns one value when an attribute equals something, another otherwise.",
		inputs: [],
		output: null,
		params: [P.str("name", "Transform name", "Is Contractor"), P.str("attr", "Identity attribute", "employeeType"), P.str("equals", "Compare to", "contractor"), P.str("yes", "Value when equal", "CONTRACTOR"), P.str("no", "Value otherwise", "EMPLOYEE")],
		build: (v) => ({ name: v.name, type: "conditional", attributes: { expression: "$attr eq $expected", positiveCondition: v.yes, negativeCondition: v.no, attr: { type: "identityAttribute", attributes: { name: v.attr } }, expected: v.equals } }),
		notes: ["Comparison with eq is case-sensitive. Wrap the input in a lower transform for case-insensitive checks."],
	},
	{
		id: "t-dateformat",
		group: "Transforms",
		type: "transform",
		title: "Reformat a date",
		summary: "Converts a date attribute from one format to another. Named formats such as ISO8601 and LDAP are also accepted by the dateFormat transform.",
		inputs: [],
		output: null,
		params: [P.str("name", "Transform name", "Start Date ISO"), P.str("attr", "Identity attribute", "startDate"), P.str("inFmt", "Input format", "dd/MM/yyyy"), P.str("outFmt", "Output format", "yyyy-MM-dd")],
		build: (v) => ({ name: v.name, type: "dateFormat", attributes: { inputFormat: v.inFmt, outputFormat: v.outFmt, input: { type: "identityAttribute", attributes: { name: v.attr } } } }),
		notes: ["Patterns follow Java date pattern letters (yyyy, MM, dd, HH, mm, ss)."],
	},
	{
		id: "t-pad",
		group: "Transforms",
		type: "transform",
		title: "Pad an employee ID to a fixed length",
		summary: "Left-pads an attribute with a character so 42 becomes 000042.",
		inputs: [],
		output: null,
		params: [P.str("name", "Transform name", "Padded Employee ID"), P.str("attr", "Identity attribute", "employeeNumber"), P.str("padding", "Padding character", "0"), P.int("length", "Final length", "6")],
		build: (v) => ({ name: v.name, type: "leftPad", attributes: { length: String(v.length), padding: v.padding, input: { type: "identityAttribute", attributes: { name: v.attr } } } }),
		notes: ["leftPad takes its length as a string in the examples SailPoint publishes. Confirm for your tenant."],
	},
	{
		id: "t-split",
		group: "Transforms",
		type: "transform",
		title: "Split a value and take one part",
		summary: "Splits an attribute on a delimiter and returns one element, for example the domain of an email.",
		inputs: [],
		output: null,
		params: [P.str("name", "Transform name", "Email Domain"), P.str("attr", "Identity attribute", "email"), P.str("delimiter", "Delimiter", "@"), P.int("index", "Index (starting at 0)", "1")],
		build: (v) => ({ name: v.name, type: "split", attributes: { delimiter: v.delimiter, index: String(v.index), throws: false, input: { type: "identityAttribute", attributes: { name: v.attr } } } }),
		notes: ["With throws set to false an out-of-range index returns null instead of an error."],
	},
	{
		id: "t-replace",
		group: "Transforms",
		type: "transform",
		title: "Regex replace",
		summary: "Replaces text matching a regular expression, for example to strip non-digits from a phone number.",
		inputs: [],
		output: null,
		params: [P.str("name", "Transform name", "Digits Only Phone"), P.str("attr", "Identity attribute", "phone"), P.str("regex", "Regular expression", "[^0-9]"), P.str("replacement", "Replacement", "")],
		build: (v) => ({ name: v.name, type: "replace", attributes: { regex: v.regex, replacement: v.replacement, input: { type: "identityAttribute", attributes: { name: v.attr } } } }),
		notes: ["The regex is Java syntax and is stored in JSON, so a backslash must be doubled in the file (the tool does this for you)."],
	},
];

// ------------------------------------------------------------------ rendering

const JAVA_ESC = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
const XML_ESC = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const RULE_NAMES = {
 "ia-lifecycle": "Calculate Lifecycle State",
 "ia-displayname": "Build Display Name",
 "corr-email": "Correlate By Email",
 "corr-empno": "Correlate By Employee Number",
 "mgr-email": "Manager By Email",
 "mgr-value": "Manager By Attribute Value",
 "bp-enable-modify": "Convert Enable And Disable To Modify",
 "bp-strip": "Remove Attribute Request",
 "ag-username": "Generate Unique Username",
 "ag-email": "Generate Email Address",
 "bm-combine": "Combine Columns",
 "bm-split": "Split Multi Value Column",
 "tr-normalise": "Capitalise Words",
 "jbm-status": "Status To Inactive Flag",
 "jbm-column": "Add Result Set Column",
 "jp-skeleton": "Provision User Table",
 "wsb-body": "Fill Request Body",
 "wsa-attr": "Add Computed Attribute"
};

export function defaultValues(t) {
	return Object.fromEntries(t.params.map((p) => [p.key, p.def]));
}

/** Checks the form values and returns {problems, clean} where clean has safe values for each kind. */
export function checkParams(t, values) {
	const problems = [];
	const clean = {};
	for (const p of t.params) {
		const raw = String(values[p.key] ?? "");
		if (p.kind === "ident") {
			if (!IDENT.test(raw)) problems.push({ key: p.key, message: `${p.label}: use letters, digits and underscore only, starting with a letter.` });
		} else if (p.kind === "idents") {
			const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
			if (!parts.length && p.def !== "") problems.push({ key: p.key, message: `${p.label}: enter at least one name.` });
			for (const part of parts) if (!IDENT.test(part)) problems.push({ key: p.key, message: `${p.label}: "${part}" is not a plain name (letters, digits, underscore).` });
		} else if (p.kind === "names") {
			const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
			if (!parts.length) problems.push({ key: p.key, message: `${p.label}: enter at least one name.` });
			for (const part of parts) if (!/^[A-Za-z0-9_ .-]+$/.test(part)) problems.push({ key: p.key, message: `${p.label}: "${part}" has characters that are not allowed.` });
		} else if (p.kind === "int") {
			if (!/^\d{1,6}$/.test(raw) || Number(raw) < 1) problems.push({ key: p.key, message: `${p.label}: enter a whole number of 1 or more.` });
		} else if (p.kind === "string" && /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)) {
			problems.push({ key: p.key, message: `${p.label}: contains control characters.` });
		}
		clean[p.key] = raw;
	}
	return { problems, clean };
}

function fillBody(t, clean) {
	const src = typeof t.body === "function" ? t.body(clean) : t.body;
	return src.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in clean ? JAVA_ESC(clean[k]) : `{{${k}}}`));
}

function safeName(s) {
	return String(s).replace(/[^A-Za-z0-9 _.-]/g, "").trim() || "Example Rule";
}

/**
 * @returns {{ok: boolean, problems: object[], files: {name: string, text: string, language: string}[], warnings: string[]}}
 */
export function renderTemplate(t, values, { ruleName } = {}) {
	const { problems, clean } = checkParams(t, values);
	if (problems.length) return { ok: false, problems, files: [], warnings: [] };
	const warnings = [];
	if (t.reference) return { ok: true, problems: [], files: [], warnings };

	if (t.build) {
		const obj = t.build(clean);
		return { ok: true, problems: [], files: [{ name: `${safeName(obj.name || t.id).replace(/ /g, "-").toLowerCase()}.json`, text: JSON.stringify(obj, null, 2) + "\n", language: "json" }], warnings };
	}

	const name = safeName(ruleName || RULE_NAMES[t.id] || t.title);
	const script = fillBody(t, clean);
	if (script.includes("]]>")) warnings.push('The script contains "]]>", which ends the CDATA section. Remove it.');
	const sig = t.signature ? `\n  <Signature>\n    <Inputs>\n${t.signature.map((a) => (typeof a === "string" ? `      <Argument name="${a}"/>` : `      <Argument name="${a[0]}" type="${a[1]}"/>`)).join("\n")}\n    </Inputs>\n  </Signature>` : "";
	const indented = script.split("\n").map((l) => (l ? `    ${l}` : l)).join("\n");
	const files = [];
	if (t.group === "Cloud rules") {
		const xml = `<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE Rule PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<Rule language="beanshell" name="${XML_ESC(name)}" type="${t.type}">
  <Description>${XML_ESC(t.summary)}</Description>${sig}
  <Source><![CDATA[
${indented}
  ]]></Source>
</Rule>
`;
		files.push({ name: `Rule - ${t.type} - ${name}.xml`, text: xml, language: "xml" });
	} else {
		files.push({ name: `${name.replace(/ /g, "-").toLowerCase()}.bsh`, text: script + "\n", language: "java" });
		const input = (t.connectorInput || t.inputs.map((i) => [i[0], i[1]])).map(([n, ty]) => ({ name: n, description: "", type: ty }));
		const json = {
			name,
			description: t.summary,
			type: t.type,
			signature: { input, output: t.output ? { name: t.output[0], description: t.output[2], type: t.output[1] } : null },
			sourceCode: { version: "1.0", script },
		};
		files.push({ name: `${name.replace(/ /g, "-").toLowerCase()}.connector-rule.json`, text: JSON.stringify(json, null, 2) + "\n", language: "json" });
		warnings.push("The JSON file follows SailPoint's connector rule object model (POST /beta/connector-rules). Check field names against the API reference before sending it.");
	}
	return { ok: true, problems: [], files, warnings };
}

// ------------------------------------------------------------------ rule checker

const BLOCKED = [
	[/\bgetObjectById\s*\(/, "getObjectById() is blocked in cloud rules. Use the idn helper methods."],
	[/\bgetObjectByName\s*\(/, "getObjectByName() is blocked in cloud rules. Use the idn helper methods."],
	[/(^|[^A-Za-z_.])getObject\s*\(/, "getObject() is blocked in cloud rules. Use the idn helper methods."],
	[/\.search\s*\(|(^|[^A-Za-z_.])search\s*\(/, "search() is blocked in cloud rules. Use the idn helper methods."],
	[/\bcountObjects\s*\(/, "countObjects() is blocked in cloud rules. Use the idn helper methods."],
	[/\bsleep\s*\(/, "sleep() is blocked."],
	[/System\s*\.\s*out/, "System.out is blocked. Use log.debug, log.info, log.warn or log.error."],
	[/System\s*\.\s*exit/, "System.exit is blocked."],
	[/\.toXml\s*\(/, "toXml() is blocked."],
];
const GUIDELINES = [
	[/\bnew\s+Thread\b|\bExecutorService\b|\bThread\s*\./, "Do not spawn threads."],
	[/\.wait\s*\(/, "Do not use wait()."],
	[/\bRuntime\s*\.\s*getRuntime|\bProcessBuilder\b/, "Do not run external processes."],
	[/\bnew\s+(URL|Socket|FileInputStream|FileOutputStream|File|FileReader|FileWriter)\b|\bHttpURLConnection\b|\bHttpClient\b/, "Do not call external systems or read files in a cloud rule."],
	[/\bLogger\s*\.\s*getLogger\b|\bLogFactory\b/, "Use the provided log variable, not your own logger."],
	[/(password|passwd|secret|apikey|api_key|token)\s*=\s*"[^"]{3,}"/i, "Looks like a hard-coded secret."],
];

/** @returns {{level: "error"|"warn"|"info", line: number, message: string}[]} */
export function checkRule(source, { cloud = true } = {}) {
	const out = [];
	const text = String(source);
	if (!text.trim()) return [{ level: "info", line: 0, message: "Paste a rule to check it." }];
	const lines = text.split(/\r?\n/);
	const typeMatch = /<Rule\b[^>]*\btype\s*=\s*"([^"]+)"/.exec(text);
	const isXml = /<Rule\b/.test(text);
	if (isXml && !typeMatch) out.push({ level: "error", line: 1, message: "The Rule element has no type attribute. Cloud rules must declare their type." });
	if (isXml && !/<Source>/.test(text)) out.push({ level: "error", line: 1, message: "There is no Source element." });
	if (isXml && /&(amp|lt|gt);/.test(text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => m)) && /<!\[CDATA\[[\s\S]*&(amp|lt|gt);[\s\S]*\]\]>/.test(text)) out.push({ level: "warn", line: 1, message: "Entities such as &amp; &lt; &gt; inside CDATA are literal text. SailPoint asks for the real characters." });
	if (isXml && !/<!\[CDATA\[/.test(text) && /[<>&]/.test(text.replace(/<[^>]+>/g, ""))) out.push({ level: "warn", line: 1, message: "The script is not wrapped in CDATA, so characters like < and & must be escaped." });
	if (isXml && typeMatch && !/^[A-Za-z]+$/.test(typeMatch[1])) out.push({ level: "warn", line: 1, message: `Unusual rule type "${typeMatch[1]}".` });
	lines.forEach((line, i) => {
		const code = line.replace(/\/\/.*$/, "");
		if (cloud) for (const [re, msg] of BLOCKED) if (re.test(code)) out.push({ level: "error", line: i + 1, message: msg });
		for (const [re, msg] of GUIDELINES) if (re.test(code)) out.push({ level: "warn", line: i + 1, message: msg });
		if (/^\s*\/\/\s*(import|String|Map|List|if|for|return|log\.|[a-z]+\s*=)/.test(line)) out.push({ level: "info", line: i + 1, message: "Looks like commented-out code. SailPoint's review does not accept commented-out blocks." });
	});
	if (!/\btry\s*\{/.test(text)) out.push({ level: "info", line: 0, message: "No try/catch found. SailPoint's guidelines ask for error handling." });
	if (!/!=\s*null|==\s*null|\bnull\s*[!=]=/.test(text)) out.push({ level: "info", line: 0, message: "No null check found." });
	if (/\bSystem\.|\blog\.(debug|info)\s*\(.*(password|ssn|secret)/i.test(text) && !out.some((o) => /sensitive/.test(o.message)) && /log\.\w+\s*\(.*(password|ssn|secret)/i.test(text)) out.push({ level: "warn", line: 0, message: "A log statement mentions a sensitive word. Never log sensitive data." });
	if (/\+\s*"?\s*\.\s*size\(\)|for\s*\(.*:\s*idn\.\w*(Accounts|Identities)/i.test(text)) out.push({ level: "info", line: 0, message: "Avoid iterating over all accounts or identities in a rule. Use a projection query helper." });
	return out.sort((a, b) => a.line - b.line);
}

export const SAMPLE_CHECK = `<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE Rule PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<Rule language="beanshell" name="Needs work" type="IdentityAttribute">
  <Description>Example with problems for the checker.</Description>
  <Source><![CDATA[
    import sailpoint.object.*;
    String password = "hunter2secret";
    Identity other = context.getObjectByName(Identity.class, "spadmin");
    System.out.println("looking at " + other.getName());
    Thread.sleep(500);
    // log.info("old debug line");
    return other.getAttribute("email");
  ]]></Source>
</Rule>
`;
