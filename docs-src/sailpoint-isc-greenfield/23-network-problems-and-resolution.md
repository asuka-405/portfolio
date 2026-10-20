---
title: Network Problems and How to Resolve Them
---

Most connectivity incidents on the program traced back to the network, not to ISC, and most were resolved by asking the right question of the right team. This page gives a method for diagnosing them, the commands to use, a catalogue of the problems we met or that the community reports, and a template for the request you will send the network team. It assumes the appliance layout from the architecture and setup pages.

## The path, and who owns each hop

```text
ISC tenant  <--HTTPS 443 (outbound from VA)--  VA cluster  --source protocol-->  Source system
                                                    |
                                                    +--DNS 53, NTP 123--> internal servers
```

| Hop | What can break | Usual owner |
|---|---|---|
| VA to ISC and its services | Firewall allow-list, proxy, TLS inspection, DNS | Network and security |
| VA to DNS and NTP | Wrong server, blocked port | Infrastructure |
| VA to source | Route, firewall, port, certificate, credentials | Network, source owner |
| Source behaviour | Timeouts, rate limits, TLS versions, service accounts | Source owner |
| Script or administrator to the ISC API | Corporate proxy, rate limit, token | Whoever runs the script |

**The VA only makes outbound connections.** Nothing inside your network needs to accept a connection from ISC. When a firewall request says "allow SailPoint in", it is the wrong request.

```html
<!-- dgm:net-path-owners -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 220" role="img" aria-labelledby="net-path-owners-t net-path-owners-d" xmlns="http://www.w3.org/2000/svg"><title id="net-path-owners-t">The connectivity path and who owns each hop</title><desc id="net-path-owners-d">Tenant, appliance, source. The appliance only calls out.</desc><defs><marker id="net-path-owners-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="net-path-owners-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box accent" x="6" y="60" width="150" height="80" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="81.0" y="103.5" text-anchor="middle">ISC tenant</text><rect class="box blue" x="330" y="60" width="150" height="80" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="405.0" y="97.0" text-anchor="middle">VA cluster</text><text class="s" x="405.0" y="112.0" text-anchor="middle">outbound only</text><rect class="box " x="660" y="60" width="154" height="80" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="737.0" y="90.5" text-anchor="middle">Source system</text><text class="s" x="737.0" y="105.5" text-anchor="middle">directory, database,</text><text class="s" x="737.0" y="118.5" text-anchor="middle">API</text><path class="ln accent  " d="M330,100.0 L156,100.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#net-path-owners-ar-accent)"/><text class="l" x="243" y="94" text-anchor="middle">443 out</text><path class="ln   " d="M480,100.0 L660,100.0" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#net-path-owners-ar)"/><text class="l" x="570" y="94" text-anchor="middle">source protocol</text><text class="h" x="243" y="180" text-anchor="middle">network and security</text><text class="h" x="570" y="180" text-anchor="middle">network and source owner</text><text class="l" x="405" y="30" text-anchor="middle">DNS 53 and NTP 123 to internal servers: infrastructure</text><text class="l" x="405" y="206" text-anchor="middle">Script or administrator to the API: whoever runs the script (proxy, rate limit, token)</text></svg></div><figcaption><b>Outbound only.</b> A request to allow SailPoint in is the wrong request; the firewall rule is from the appliance to the destination.</figcaption></figure>
```

## A method that works

Work up the stack and stop at the first failure.

1. **Name resolution.** Does the host name resolve, to the address you expect, from the VA's network?
2. **Route.** Is there a path from the VA to that address?
3. **Port.** Does the port accept a connection from the VA?
4. **Transport security.** Does the TLS handshake complete, and is the certificate trusted and unexpired?
5. **Authentication.** Do the credentials work from the VA?
6. **Application.** Does the operation succeed, within the timeout?

Test from the VA itself if you can, because the VA's DNS, route and firewall rules are the ones that count. If the image lacks a tool, test from another host in the same subnet and zone, and say so in your notes.

```html
<!-- dgm:net-ladder -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 400" role="img" aria-labelledby="net-ladder-t net-ladder-d" xmlns="http://www.w3.org/2000/svg"><title id="net-ladder-t">Six steps for any connectivity problem</title><desc id="net-ladder-d">Name resolution, route, port, transport security, authentication, application; stop at the first failure.</desc><defs></defs><text class="h" x="110" y="18" text-anchor="middle">STEP</text><text class="h" x="410" y="18" text-anchor="middle">COMMAND, FROM THE VA OR ITS SUBNET</text><text class="h" x="700" y="18" text-anchor="middle">TYPICAL FAILURE</text><rect class="box accent" x="6" y="30" width="200" height="48" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="106.0" y="57.5" text-anchor="middle">1  Name resolution</text><rect class="box " x="222" y="30" width="340" height="48" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="392.0" y="57.5" text-anchor="middle">nslookup &lt;host&gt;   dig &lt;host&gt;</text><rect class="box ghost" x="578" y="30" width="236" height="48" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="696.0" y="50.0" text-anchor="middle">wrong or no address, split</text><text class="t" x="696.0" y="65.0" text-anchor="middle">DNS</text><rect class="box accent" x="6" y="90" width="200" height="48" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="106.0" y="117.5" text-anchor="middle">2  Route</text><rect class="box " x="222" y="90" width="340" height="48" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="392.0" y="117.5" text-anchor="middle">ping &lt;host&gt; (if ICMP allowed)</text><rect class="box ghost" x="578" y="90" width="236" height="48" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="696.0" y="110.0" text-anchor="middle">no route to host, asymmetric</text><text class="t" x="696.0" y="125.0" text-anchor="middle">path</text><rect class="box accent" x="6" y="150" width="200" height="48" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="106.0" y="177.5" text-anchor="middle">3  Port</text><rect class="box " x="222" y="150" width="340" height="48" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="392.0" y="177.5" text-anchor="middle">nc -vz &lt;host&gt; &lt;port&gt;</text><rect class="box ghost" x="578" y="150" width="236" height="48" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="696.0" y="170.0" text-anchor="middle">timeout = dropped, refused =</text><text class="t" x="696.0" y="185.0" text-anchor="middle">closed</text><rect class="box blue" x="6" y="210" width="200" height="48" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="106.0" y="237.5" text-anchor="middle">4  Transport security</text><rect class="box " x="222" y="210" width="340" height="48" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="392.0" y="237.5" text-anchor="middle">openssl s_client -connect &lt;host&gt;:&lt;port&gt;</text><rect class="box ghost" x="578" y="210" width="236" height="48" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="696.0" y="230.0" text-anchor="middle">untrusted CA, inspection,</text><text class="t" x="696.0" y="245.0" text-anchor="middle">expired</text><rect class="box blue" x="6" y="270" width="200" height="48" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="106.0" y="297.5" text-anchor="middle">5  Authentication</text><rect class="box " x="222" y="270" width="340" height="48" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="392.0" y="297.5" text-anchor="middle">test connection from the source</text><rect class="box ghost" x="578" y="270" width="236" height="48" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="696.0" y="290.0" text-anchor="middle">rotated credential, wrong</text><text class="t" x="696.0" y="305.0" text-anchor="middle">account</text><rect class="box blue" x="6" y="330" width="200" height="48" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="106.0" y="357.5" text-anchor="middle">6  Application</text><rect class="box " x="222" y="330" width="340" height="48" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="392.0" y="357.5" text-anchor="middle">run the operation, read the response</text><rect class="box ghost" x="578" y="330" width="236" height="48" style="fill:none;stroke-dasharray:5 4;stroke:var(--text);stroke-opacity:0.34;stroke-width:1.1"/><text class="t" x="696.0" y="350.0" text-anchor="middle">rate limit, timeout, error in</text><text class="t" x="696.0" y="365.0" text-anchor="middle">a 200 body</text></svg></div><figcaption><b>Work up the stack.</b> Test from the appliance's own network where you can, because its DNS, route and firewall rules are the ones that count.</figcaption></figure>
```

### Commands

Tool availability varies by image, and the VA does not ship a telnet client. Community members report using these on the appliance, with a network utility run inside the appliance's toolbox where it is not on the host. Treat the toolbox detail as community-reported and check your image.

```bash
# 1. name resolution
nslookup <host>
dig <host>

# 2-3. route and port (use ping only if ICMP is allowed)
nc -vz <host> <port>

# 4. TLS handshake and certificate
openssl s_client -connect <host>:<port> -servername <host>

# 4/6. HTTPS reachability (a HEAD request; connection or TLS errors fail, an HTTP error status does not)
curl -v -I https://<host> --connect-timeout 5

# 6. which containers are up on the VA (community-reported)
docker ps -a
```

A reachability loop over the SailPoint hosts:

```bash
HOSTS=("<host 1>" "<host 2>" "<host 3>")     # from the current required-URL list
for H in "${HOSTS[@]}"; do
  printf "%-60s " "$H"
  if curl -sS -I "https://$H" --connect-timeout 5 >/dev/null 2>&1; then echo OK; else echo FAIL; fi
done
```

## Required destinations for the VA

SailPoint publishes the list of hosts a VA must reach, and states that it can change without notice. Take the current list from the **VA requirements page** and put it under change management. As of the October 2026 documentation the groups were:

| Group | Purpose | Port |
|---|---|---|
| SailPoint and tenant domains (the identity cloud domains and the API domains) | Configuration, commands, updates | 443 |
| The VA access and secure API hosts | Control channel | 443 |
| Operating system update domains (Flatcar) | Security patches and updates | 443 |
| A feature-flag service | Feature control | 443 |
| Cloud service endpoints for object storage, queue, database, container registry (region-specific, and the US East ones **always**) | Image and update delivery | 443 |
| Internal DNS | Name resolution | 53 |
| NTP | Time (closed if you use internal NTP on every VA) | 123 |
| SSH, inbound, internal only | Administration | 22 |

SailPoint has announced that some cloud-hosted endpoints will move to SailPoint-hosted ones. The guidance is to keep the existing entries and **add** the new ones as they are published. Removing the old ones before the migration finishes is what breaks a VA.

## Ports by source type

Confirm these with the source owner. Defaults differ by version and installation.

| Source | Typical ports (from the VA) |
|---|---|
| Active Directory (read) | 389 LDAP, 636 LDAPS, 3268 and 3269 for the global catalogue, 53 DNS, 88 if Kerberos is used |
| Active Directory (write) | The directory agent's listening port on the Windows host. The program's design listed 5050 and 5051. It is set at installation, so read the installed value |
| SQL Server | 1433, or the instance's port; for named instances the browser service on UDP 1434 as well |
| Oracle | 1521 |
| PostgreSQL | 5432 |
| MySQL | 3306 |
| REST and SaaS applications | 443, to the vendor's host name, plus the vendor's token endpoint |
| SFTP file server | 22 |
| Another VA cluster's source | As above, from that cluster |

## Problems and resolutions

### VA and cluster

| Symptom | Likely cause | Check | Resolution |
|---|---|---|---|
| VA shows **Inactive** | It cannot reach the service: firewall, proxy, DNS or time | Run the reachability loop from the VA. Check that the other VA is healthy | Get the missing destination allowed. Compare the failing VA's route, proxy and DNS with the healthy one |
| Stuck at "update in progress" | An update download was interrupted, or credentials expired after a long outage | Look at container status and the VA logs. Look for download errors or expired credentials | Restore outbound access, avoid repeated restarts during the update, restart the cluster once. If it persists, contact support |
| "VA Did Not Update" | The update could not finish | Same as above | Restart the cluster, then support |
| Cluster shows "Only 1 VA" | A VA is down or removed | Cluster page | Restore it. A cluster with a disconnected VA receives no updates |
| Pairing fails | Code expired (4 hours), passphrase mismatch, no outbound path | Generate a new code. Confirm the same passphrase on each VA | Pair again |
| Configuration incomplete | The VA could not connect during setup | Network and time | Fix and wait up to 30 minutes |
| Warning for memory or disk | Under-sized VA or debug logging left on | Check sizing and the debug setting | Disable debugging, add resources |
| Time drift, odd TLS or token errors | NTP blocked or wrong | `timedatectl status` | Configure internal NTP on every VA |
| Every integration on one cluster fails | The cluster or a shared service account | Cluster status, the shared login | Fix the cluster. This was the first thing to suspect on the program |
| One integration fails while its cluster peers are fine | That integration's own route, such as egress or DNS to an external host | Test from the VA to that host | One source reached a vendor host in another geography and was the only one on its cluster that did |

### Name resolution

| Symptom | Likely cause | Resolution |
|---|---|---|
| Every directory source fails after a DNS change | The VA's DNS servers cannot resolve the domain controllers, or the VA still holds old settings | `nslookup` the controllers from the VA. Correct the VA's DNS. Reboot the VA (not only the service) so it picks up routes and resolvers |
| Works by IP, fails by name | Split-horizon DNS: internal names are not served to the VA's resolver | Point the VA at the internal resolver, or map the host in the VA's hosts file as a stopgap |
| Intermittent failures | One of several DNS servers is broken | Query each server directly |
| Case-sensitive host lookups in a component | Host name case differs from the application's | Match the case the application uses |

### Firewalls and routes

| Symptom | Likely cause | Resolution |
|---|---|---|
| "No route to host" | A routing change, a missing route from the VA's subnet, or a firewall rejecting rather than dropping | `nc -vz` to the host. Ask the network team for the path and the rule hit |
| Connection times out | A firewall silently dropping | Same. A timeout points to a drop, a refusal to a closed port |
| Connection refused | The service is not listening, or a host firewall | Check the service and the host firewall |
| Works from a laptop, not from the VA | The VA's zone has different rules | Test from the VA's subnet |
| Works for hours, then fails | Session or idle timeout on a firewall for long-lived or slow connections | Ask for the idle timeout, and keep calls short |
| A source in the reserved range | A VA cannot route to `10.255.255.241/28`, and a tunnel cannot to `172.16.0.0/22` | Re-address the source or use another method |
| Asymmetric routing | Replies take a different path and are dropped | Network team traces both directions |

### Proxies and TLS inspection

| Symptom | Likely cause | Resolution |
|---|---|---|
| VA cannot reach SailPoint but a browser can | The browser uses a proxy and the VA does not | Configure the proxy on the VA, or open the destinations directly |
| TLS errors, "untrusted certificate", S3 download broken | A device inspecting TLS presents its own certificate | Exempt the VA's destinations from inspection, or install the inspection CA on the VA |
| Proxy returns 407 | The proxy needs authentication | Use an unauthenticated rule for the VA, or the proxy configuration the VA supports |
| A web-services source works in a browser, fails in the connector | A forward proxy sits between the VA and the vendor | Add a bypass for local hosts, or allow the vendor host directly |
| Web filter blocks a category | A "new or uncategorised domain" rule | Allow the specific hosts |

### Source-specific

| Source | Symptom | Likely cause | Resolution |
|---|---|---|---|
| Active Directory | Cannot bind over LDAPS | The controller's certificate is not trusted, expired or has the wrong name | `openssl s_client` to port 636. Trust the issuing CA and use the name on the certificate |
| Active Directory | Works for reads, fails for writes | The directory agent is unreachable or its service account lacks rights | Test the agent port from the VA, check the service and its permissions |
| SQL Server | Named instance not found | The browser service port (UDP 1434) is blocked, or the instance has a dynamic port | Use the fixed port in the URL, or allow the browser service |
| Databases | TLS or driver errors after a server upgrade | The server requires a newer protocol than the driver offers | Check the driver and server protocol versions |
| REST or SaaS | HTTP 429 | A rate limit | Respect the retry header, reduce page size and concurrency |
| REST or SaaS | Token endpoint times out under load | The vendor's token service fails under concurrency | Stagger requests |
| REST or SaaS | Calls over about a minute fail and later requests from that person are cancelled for an hour | The appliance's call timeout (63 seconds in our measurement) | Keep calls short, split the work, add a timeout in the application |
| SFTP | Test connection fails | The URL, the folder permissions, the firewall | See the SFTP page |
| Any | Fails only at certain times | A maintenance window, a backup, a batch job at the target | Check the source's schedule against yours |

### From scripts and administrators to the API

| Symptom | Likely cause | Resolution |
|---|---|---|
| Script fails behind a corporate proxy | The proxy is not configured in the client | Set the proxy for the tool |
| HTTP 429 | The 100 requests per 10 seconds per client allowance | Back off using the retry header, and use a separate client per tool |
| Intermittent 401 | An expired token | Refresh the token before it lapses |

## How to ask the network team

Send one request that is complete, so they do not have to ask. Use this template:

| Field | Example |
|---|---|
| Purpose | Allow the identity governance appliances to reach `<destination>` |
| Source | `<VA 1 address>`, `<VA 2 address>` (cluster `<name>`, subnet `<cidr>`) |
| Destination | `<host name>` / `<address>` (and the list of host names for the SailPoint services) |
| Port and protocol | TCP 443 (or the port and protocol) |
| Direction | **Outbound** from the appliance |
| Duration | Permanent |
| Frequency and volume | Scheduled every `<n>` hours, `<small>` data |
| Business justification | Account aggregation and provisioning for `<application>` |
| Test | The result of `nc -vz` or `curl` from the appliance's subnet, before and after |
| Owner | `<name>` |
| Change record | `<number>` |

Attach the evidence: the command, the output, the time, and which VA ran it.

## The evidence bundle for a support case

When you must involve SailPoint support, include:

- Tenant name and environment.
- Cluster name and the VA identifiers.
- The time the problem began, with the time zone.
- The symptom and the exact error text.
- What you tested from the VA, and the results.
- Whether the VA recently updated or was rebooted.
- The VA logs for the period, and the cluster status screenshot.
- Recent network changes.

## Prevention

- Give the network team the full destination list **before** the build, and add the new hosts when SailPoint publishes them.
- Test from the VA's subnet as part of every source onboarding, and record the result.
- Put every firewall rule in the cluster plan next to the sources it serves.
- Alert on cluster status and VA inactivity.
- Review the allow-list quarterly against the current requirements page.
- Tell the network team before an appliance moves, is re-addressed, or its DNS changes.
- Keep two VAs per cluster in different failure domains.

## Actions

- Adopt the six-step method and the evidence habit: command, output, time, VA.
- Keep the firewall request template and use it for every request.
- Hold the required-destinations list under change control.
- Test every new source from the VA's network before you configure it in ISC.
- Record the DNS, route and time settings of each cluster in the plan.
