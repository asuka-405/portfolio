// A small, invented IdentityIQ export used by the "Load sample" button and the tests.
// Every name here is made up.

const ref = (cls, name) => `<Reference class="sailpoint.object.${cls}" name="${name}"/>`;

export const SAMPLE_FILES = [
	{
		name: "applications.xml",
		text: `<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
  <Application authoritative="true" connector="sailpoint.connector.DelimitedFileConnector" featuresString="DISCOVER_SCHEMA, DIRECT_PERMISSIONS" name="HR Feed" type="DelimitedFile">
    <AccountCorrelationConfig>${ref("CorrelationConfig", "HR Correlation")}</AccountCorrelationConfig>
    <Attributes>
      <Map>
        <entry key="file" value="/data/hr/employees.csv"/>
        <entry key="delimiter" value=","/>
        <entry key="hasHeader" value="true"/>
        <entry key="filetransport" value="local"/>
        <entry key="indexColumn" value="employeeId"/>
        <entry key="mergeRows" value="false"/>
        <entry key="buildMapRule" value="HR Build Map"/>
      </Map>
    </Attributes>
    <Owner>${ref("Identity", "spadmin")}</Owner>
    <Schemas>
      <Schema displayAttribute="employeeId" identityAttribute="employeeId" nativeObjectType="account" objectType="account">
        <AttributeDefinition name="employeeId" type="string"/>
        <AttributeDefinition name="firstName" type="string"/>
        <AttributeDefinition name="lastName" type="string"/>
        <AttributeDefinition name="dept" type="string"/>
        <AttributeDefinition name="costCenter" type="string"/>
        <AttributeDefinition name="mail" type="string"/>
        <AttributeDefinition name="managerId" type="string"/>
        <AttributeDefinition name="status" type="string"/>
        <AttributeDefinition name="hire_date" type="string"/>
      </Schema>
    </Schemas>
    <ManagerCorrelationFilter operation="EQ" property="employeeId" value="managerId"/>
  </Application>

  <Application connector="sailpoint.connector.ADLDAPConnector" featuresString="AUTHENTICATE, ENABLE, UNLOCK, PROVISIONING, SEARCH, MANAGER_LOOKUP" name="Corp AD" type="Active Directory - Direct">
    <AccountCorrelationConfig>${ref("CorrelationConfig", "AD Correlation")}</AccountCorrelationConfig>
    <Attributes>
      <Map>
        <entry key="IQServiceHost" value="iqservice01.example.test"/>
        <entry key="IQServicePort" value="5050"/>
        <entry key="authType" value="simple"/>
        <entry key="user" value="svc-sailpoint@example.test"/>
        <entry key="password" value="1:ACP:Zm9vYmFy"/>
        <entry key="searchDN" value="DC=example,DC=test"/>
        <entry key="customizationRule" value="AD Customization"/>
      </Map>
    </Attributes>
    <Owner>${ref("Identity", "spadmin")}</Owner>
    <Schemas>
      <Schema displayAttribute="sAMAccountName" identityAttribute="distinguishedName" nativeObjectType="user" objectType="account">
        <AttributeDefinition name="distinguishedName" type="string"/>
        <AttributeDefinition name="sAMAccountName" type="string"/>
        <AttributeDefinition name="mail" type="string"/>
        <AttributeDefinition name="employeeID" type="string"/>
        <AttributeDefinition name="memberOf" type="string" multi="true" entitlement="true" managed="true" schemaObjectType="group"/>
      </Schema>
      <Schema displayAttribute="cn" identityAttribute="distinguishedName" nativeObjectType="group" objectType="group">
        <AttributeDefinition name="distinguishedName" type="string"/>
        <AttributeDefinition name="cn" type="string"/>
      </Schema>
    </Schemas>
    <ProvisioningForms>
      <Form name="AD Create" objectType="account" type="Create">
        <Section>
          <Field name="sAMAccountName" displayName="Login" type="string" required="true">
            <Script><Source>String f = identity.getAttribute("firstname"); String l = identity.getAttribute("lastname"); return (f.substring(0,1) + l).toLowerCase();</Source></Script>
          </Field>
          <Field name="mail" displayName="Email" type="string">
            <RuleRef>${ref("Rule", "Build Email")}</RuleRef>
          </Field>
          <Field name="description" displayName="Description" type="string"/>
        </Section>
      </Form>
    </ProvisioningForms>
  </Application>

  <Application connector="sailpoint.connector.JDBCConnector" name="Payroll DB" type="JDBC">
    <Attributes>
      <Map>
        <entry key="url" value="jdbc:postgresql://db.example.test:5432/payroll"/>
        <entry key="driverClass" value="org.postgresql.Driver"/>
        <entry key="user" value="sailpoint_ro"/>
        <entry key="password" value="ENC(abc123)"/>
        <entry key="SQL" value="select emp_id, grade, pay_group from payroll_view"/>
        <entry key="mergeRows" value="true"/>
      </Map>
    </Attributes>
    <Owner>${ref("Identity", "payroll.owner")}</Owner>
    <Schemas>
      <Schema displayAttribute="emp_id" identityAttribute="emp_id" nativeObjectType="account" objectType="account">
        <AttributeDefinition name="emp_id" type="string"/>
        <AttributeDefinition name="grade" type="string"/>
        <AttributeDefinition name="pay_group" type="string" entitlement="true" managed="true"/>
      </Schema>
    </Schemas>
  </Application>

  <Application connector="sailpoint.connector.RACFConnector" name="Mainframe" type="RACF - Full">
    <Attributes><Map><entry key="host" value="mf.example.test"/></Map></Attributes>
  </Application>

  <Application connector="sailpoint.connector.LogicalConnector" name="Finance Suite" type="Logical"/>
</sailpoint>`,
	},
	{
		name: "identity-config.xml",
		text: `<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
  <ObjectConfig name="Identity">
    <ObjectAttribute displayName="First Name" name="firstname" standard="true" type="string">
      <AttributeSource name="firstName"><ApplicationRef>${ref("Application", "HR Feed")}</ApplicationRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Last Name" name="lastname" standard="true" type="string">
      <AttributeSource name="lastName"><ApplicationRef>${ref("Application", "HR Feed")}</ApplicationRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Email" name="email" standard="true" type="string">
      <AttributeSource name="mail"><ApplicationRef>${ref("Application", "HR Feed")}</ApplicationRef></AttributeSource>
      <AttributeSource name="mail"><ApplicationRef>${ref("Application", "Corp AD")}</ApplicationRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Department" extended="true" name="department" searchable="true" type="string">
      <AttributeSource name="dept"><ApplicationRef>${ref("Application", "HR Feed")}</ApplicationRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Cost Center" extended="true" name="cost_center" type="string">
      <AttributeSource type="rule"><RuleRef>${ref("Rule", "Cost Center Normalize")}</RuleRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Employee Type" extended="true" name="employeeType" type="string">
      <AttributeSource type="rule"><RuleRef>${ref("Rule", "Employee Type From Status")}</RuleRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Hire Date" extended="true" name="hire_date" type="date">
      <AttributeSource name="hire_date"><ApplicationRef>${ref("Application", "HR Feed")}</ApplicationRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Pay Grade" extended="true" name="payGrade" type="string">
      <AttributeSource name="grade"><ApplicationRef>${ref("Application", "Payroll DB")}</ApplicationRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Region" extended="true" name="region" type="string">
      <AttributeSource type="rule"><RuleRef>${ref("Rule", "Region Lookup")}</RuleRef></AttributeSource>
    </ObjectAttribute>
    <ObjectAttribute displayName="Manager" name="manager" standard="true" type="identity"/>
  </ObjectConfig>
  <ObjectConfig name="Bundle">
    <ObjectAttribute displayName="Business Justification" extended="true" name="justification" type="string"/>
  </ObjectConfig>
  <CorrelationConfig name="HR Correlation">
    <AttributeAssignments>
      <Filter operation="EQ" property="employeeId" value="employeeId"/>
    </AttributeAssignments>
  </CorrelationConfig>
  <CorrelationConfig name="AD Correlation">
    <AttributeAssignments>
      <Filter operation="EQ" property="employeeId" value="employeeID"/>
      <Filter operation="EQ" property="email" value="mail"/>
    </AttributeAssignments>
  </CorrelationConfig>
</sailpoint>`,
	},
	{
		name: "rules.xml",
		text: `<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
  <Rule language="beanshell" name="Cost Center Normalize" type="IdentityAttribute">
    <Description>Strip the CC- prefix and upper-case the code.</Description>
    <Source><![CDATA[
      // value comes from the HR feed
      String cc = link.getAttribute("costCenter");
      if (cc == null) return null;
      return cc.replace("CC-", "").toUpperCase();
    ]]></Source>
  </Rule>
  <Rule language="beanshell" name="Employee Type From Status" type="IdentityAttribute">
    <Source><![CDATA[
      String s = link.getAttribute("status");
      if ("A".equals(s)) return "Employee";
      else if ("C".equals(s)) return "Contractor";
      return "Unknown";
    ]]></Source>
  </Rule>
  <Rule language="beanshell" name="Region Lookup" type="IdentityAttribute">
    <Source><![CDATA[
      import sailpoint.object.Custom;
      Custom regions = context.getObjectByName(Custom.class, "Region Map");
      String dept = identity.getAttribute("department");
      return regions.get(dept);
    ]]></Source>
  </Rule>
  <Rule language="beanshell" name="Build Email" type="FieldValue">
    <Source><![CDATA[
      String f = identity.getAttribute("firstname");
      String l = identity.getAttribute("lastname");
      return f.toLowerCase() + "." + l.toLowerCase() + "@example.test";
    ]]></Source>
  </Rule>
  <Rule language="beanshell" name="HR Build Map" type="BuildMap">
    <Source><![CDATA[
      import sailpoint.tools.Util;
      Map map = new HashMap();
      for (int i = 0; i < cols.size(); i++) {
        if (record.get(i) != null) map.put(cols.get(i), record.get(i).trim());
      }
      return map;
    ]]></Source>
  </Rule>
  <Rule language="beanshell" name="AD Customization" type="ResourceObjectCustomization">
    <Source><![CDATA[
      String dn = object.getStringAttribute("distinguishedName");
      object.setAttribute("ou", dn.substring(dn.indexOf(",") + 1));
      return object;
    ]]></Source>
  </Rule>
  <Rule language="beanshell" name="Nightly Export Listener" type="Listener">
    <Source><![CDATA[ java.io.FileWriter w = new java.io.FileWriter("/tmp/out.txt"); ]]></Source>
  </Rule>
  <Rule language="beanshell" name="Unused Helper" type="Validation">
    <Source><![CDATA[ return null; ]]></Source>
  </Rule>
</sailpoint>`,
	},
	{
		name: "roles.xml",
		text: `<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
  <Bundle name="AD - Finance Share" type="it">
    <Owner>${ref("Identity", "fin.owner")}</Owner>
    <Description>Read and write on the finance file share.</Description>
    <Attributes><Map><entry key="approvalScheme" value="manager,owner"/></Map></Attributes>
    <Profiles>
      <Profile>
        <ApplicationRef>${ref("Application", "Corp AD")}</ApplicationRef>
        <Constraints>
          <Filter operation="EQ" property="memberOf" value="CN=FIN-Share-RW,OU=Groups,DC=example,DC=test"/>
        </Constraints>
      </Profile>
    </Profiles>
  </Bundle>
  <Bundle name="Payroll Admin Access" type="it">
    <Owner>${ref("Identity", "payroll.owner")}</Owner>
    <Profiles>
      <Profile>
        <ApplicationRef>${ref("Application", "Payroll DB")}</ApplicationRef>
        <Constraints><Filter operation="EQ" property="pay_group" value="ADMIN"/></Constraints>
      </Profile>
      <Profile>
        <ApplicationRef>${ref("Application", "Corp AD")}</ApplicationRef>
        <Constraints><Filter operation="EQ" property="memberOf" value="CN=PAY-Admins,OU=Groups,DC=example,DC=test"/></Constraints>
      </Profile>
    </Profiles>
  </Bundle>
  <Bundle name="AP Clerk" type="business">
    <Owner>${ref("Identity", "fin.owner")}</Owner>
    <Description>Accounts payable clerk.</Description>
    <Requirements>${ref("Bundle", "AD - Finance Share")}</Requirements>
    <Selector>
      <IdentitySelector>
        <MatchExpression and="true">
          <MatchTerm name="department" value="Finance"/>
          <MatchTerm name="employeeType" value="Employee"/>
        </MatchExpression>
      </IdentitySelector>
    </Selector>
  </Bundle>
  <Bundle name="Payroll Approver" type="business">
    <Owner>${ref("Identity", "payroll.owner")}</Owner>
    <Requirements>${ref("Bundle", "Payroll Admin Access")}</Requirements>
    <Inheritance>${ref("Bundle", "AP Clerk")}</Inheritance>
    <Selector>
      <IdentitySelector>
        <CompoundFilter>
          <Filter operation="IN" property="region"><Value><List><String>EMEA</String><String>APAC</String></List></Value></Filter>
        </CompoundFilter>
      </IdentitySelector>
    </Selector>
  </Bundle>
  <Policy name="Pay vs Pay Approval" type="SOD">
    <Owner>${ref("Identity", "fin.owner")}</Owner>
    <Description>Nobody should both clerk and approve payroll.</Description>
    <Constraints>
      <SODConstraint name="Clerk vs Approver" remediationAdvice="Remove one of the two roles.">
        <LeftBundles>${ref("Bundle", "AP Clerk")}</LeftBundles>
        <RightBundles>${ref("Bundle", "Payroll Admin Access")}</RightBundles>
      </SODConstraint>
    </Constraints>
  </Policy>
</sailpoint>`,
	},
	{
		name: "tasks-and-misc.xml",
		text: `<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">
<sailpoint>
  <TaskDefinition executor="sailpoint.task.AccountAggregationTask" name="Aggregate HR and AD">
    <Attributes><Map><entry key="applications" value="HR Feed,Corp AD"/></Map></Attributes>
  </TaskDefinition>
  <TaskSchedule cronExpressions="0 0 2 * * ?" name="Aggregate HR and AD" taskDefinition="Aggregate HR and AD"/>
  <TaskDefinition executor="sailpoint.task.IdentityRefreshExecutor" name="Refresh All"/>
  <TaskDefinition executor="sailpoint.task.PerformMaintenance" name="Perform Maintenance"/>
  <Workflow name="Joiner Provisioning" type="IdentityLifecycle">
    <Step name="Start"><Transition to="Approve"/></Step>
    <Step name="Approve"><Approval name="Manager approval"/><Transition to="Provision"/></Step>
    <Step name="Provision"><Script><Source>wfcontext.put("done", true);</Source></Script></Step>
  </Workflow>
  <EmailTemplate name="Access Approved" subject="Your access was approved"><Body>Hello $spt_identity.firstname, your request was approved.</Body></EmailTemplate>
  <CertificationDefinition name="Quarterly Manager Review" type="Manager"/>
  <Capability name="Helpdesk"/>
  <Capability name="FinanceAuditor"/>
  <IdentityTrigger name="Joiner" type="Create"><WorkflowRef>${ref("Workflow", "Joiner Provisioning")}</WorkflowRef></IdentityTrigger>
  <QuickLink name="Request Access" category="LCM"/>
  <Configuration name="SystemConfiguration"/>
</sailpoint>`,
	},
];
