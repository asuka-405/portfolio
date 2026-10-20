---
title: Setting Up Virtual Appliances and Clusters
---

Every on-premises source in the program reached ISC through a virtual appliance (VA) in a cluster. This page is the build procedure, in the order we would do it again: plan the clusters, prepare the network, deploy the image, pair it with the tenant, verify, and then operate it. It follows SailPoint's published procedure (checked against the VA documentation in October 2026) and adds the planning and checks that the documentation leaves out. Commands are from the documentation unless marked otherwise. Re-check them against the current VA guide before use, because images and tooling change.

## Step 0: plan the clusters

Decide this before you deploy anything. Sources are attached to a cluster, and moving fifty sources later is painful.

| Question | Guidance |
|---|---|
| How many clusters? | At least one for production and one for sandbox. Add clusters per network boundary and per blast radius |
| How many VAs per cluster? | **At least two**, sandbox included. Updates roll through one VA at a time, so one VA means an outage on every update |
| Where do VAs sit? | Close to the sources they serve. One VA per virtual machine host, spread across hosts or availability zones. SailPoint advises against the DMZ |
| Which sources on which cluster? | Group by reachability and risk. The program used a cluster for HR, one per directory estate, one for application sources and one for flat files and region-specific systems, 5 clusters and 9 appliances in all |
| What is the network method? | Standard (direct outbound), HTTP proxy, or network tunnel. Pick one per cluster and keep each cluster consistent |
| Time zone | Set per cluster. It governs aggregation schedules and does not shift for daylight saving |
| Cluster type | Standard, unless you also run the product that needs the harvester type. The type cannot be changed afterwards |

Write the plan as a table and keep it with the architecture document:

| Cluster | Purpose | Sources | VAs | Host or zone | Network method | Owner |
|---|---|---|---|---|---|---|
| `<env>-<purpose>` | | | 2 | | Standard | |

```html
<!-- dgm:va-setup-flow -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 270" role="img" aria-labelledby="va-setup-flow-t va-setup-flow-d" xmlns="http://www.w3.org/2000/svg"><title id="va-setup-flow-t">Building a virtual appliance cluster</title><desc id="va-setup-flow-d">Plan, prepare the network, deploy, configure, create the cluster, pair each appliance, verify.</desc><defs><marker id="va-setup-flow-ar-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk accent" style="fill:var(--accent);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box " x="6" y="20" width="180" height="80" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="96.0" y="57.0" text-anchor="middle">1 Plan clusters</text><text class="s" x="96.0" y="72.0" text-anchor="middle">sources, hosts, method</text><rect class="box " x="215" y="20" width="180" height="80" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="305.0" y="57.0" text-anchor="middle">2 Network</text><text class="s" x="305.0" y="72.0" text-anchor="middle">firewall, DNS, NTP, proxy</text><rect class="box blue" x="424" y="20" width="180" height="80" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="514.0" y="50.5" text-anchor="middle">3 Deploy image</text><text class="s" x="514.0" y="65.5" text-anchor="middle">change the default</text><text class="s" x="514.0" y="78.5" text-anchor="middle">password</text><rect class="box blue" x="633" y="20" width="180" height="80" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="723.0" y="50.5" text-anchor="middle">4 Configure</text><text class="s" x="723.0" y="65.5" text-anchor="middle">static IP, NTP, hosts</text><text class="s" x="723.0" y="78.5" text-anchor="middle">file, proxy</text><path class="ln accent  " d="M186,60.0 L215,60.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-setup-flow-ar-accent)"/><path class="ln accent  " d="M395,60.0 L424,60.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-setup-flow-ar-accent)"/><path class="ln accent  " d="M604,60.0 L633,60.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-setup-flow-ar-accent)"/><rect class="box accent" x="6" y="160" width="180" height="80" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="96.0" y="197.0" text-anchor="middle">5 Create cluster</text><text class="s" x="96.0" y="212.0" text-anchor="middle">name, time zone, type</text><rect class="box accent" x="215" y="160" width="180" height="80" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="305.0" y="190.5" text-anchor="middle">6 Pair each VA</text><text class="s" x="305.0" y="205.5" text-anchor="middle">same passphrase, code</text><text class="s" x="305.0" y="218.5" text-anchor="middle">valid 4 hours</text><rect class="box " x="424" y="160" width="180" height="80" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="514.0" y="197.0" text-anchor="middle">7 Wait</text><text class="s" x="514.0" y="212.0" text-anchor="middle">about 30 minutes</text><rect class="box teal" x="633" y="160" width="180" height="80" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="723.0" y="190.5" text-anchor="middle">8 Verify</text><text class="s" x="723.0" y="205.5" text-anchor="middle">connected, test source,</text><text class="s" x="723.0" y="218.5" text-anchor="middle">failover</text><path class="ln accent  " d="M186,200.0 L215,200.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-setup-flow-ar-accent)"/><path class="ln accent  " d="M395,200.0 L424,200.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-setup-flow-ar-accent)"/><path class="ln accent  " d="M604,200.0 L633,200.0" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-setup-flow-ar-accent)"/><path class="ln accent  " d="M716,100 L716,130 L96,130 L96,160" style="fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-setup-flow-ar-accent)"/></svg></div><figcaption><b>Order matters.</b> The network and the plan come first; sources are attached only after every appliance shows connected and a failover test has passed.</figcaption></figure>
```

## Step 1: sizing and prerequisites

| Item | Requirement (per VA) |
|---|---|
| Compute | 4 processors, 16 GB memory, 128 GB storage as a minimum image. Cloud equivalents: a 4 vCPU general-purpose instance |
| Processor | A supported Intel or AMD generation exposed by the hypervisor |
| Hypervisor | vSphere 8.0 or later, Hyper-V Server 2016 or later, or a supported cloud |
| Network | Outbound 443 to SailPoint and the listed services, DNS (53), NTP (123), and the ports of the sources it serves |
| Time | Synchronised. Internal NTP if outbound 123 is closed |
| DNS | Reaches your internal DNS servers, so it can resolve source host names |
| Optional components | A Privileged Access Gateway or Data Access Security collector adds processors and memory |
| Restrictions | No third-party monitoring agents. Not in restricted geographies. Not in `10.255.255.241/28`, which a VA cannot route to |

Write these down for the network team before the build (see the network page for a firewall request template).

## Step 2: obtain and deploy the image

| Platform | How |
|---|---|
| vSphere | Download the package from the VA documentation page and deploy it with your standard process |
| Hyper-V | Use the package labelled for Azure, which contains a `sailpoint-va.vhd`. Create a **Generation 1** VM, give it the memory the requirements page states, connect it to an external virtual switch and attach the existing disk |
| AWS | Open a support request for an image (AMI) identifier, giving your account number and region. Launch it with an instance size that meets the requirements, enable instance metadata access with a **hop limit of 2**, and use a security group that allows port 22 from your range |
| Azure | The extracted disk is about 132 GB. Upload it to a storage container, create a managed disk from it, then create the VM from that disk (Linux, a size that meets the requirements) with a network security group that allows port 22 |
| Google Cloud | Extract the image, upload it to a storage bucket, import it as a custom image without OS adaptation, and create an instance with a 128 GB boot disk |

For every platform: start the VM, then sign in to the console or over SSH as the `sailpoint` user with the default password given in the documentation, and **change it immediately**:

```bash
passwd
```

Store the new password in your vault. If it is lost, a new VA has to be created. On a cloud VM, if a failed DHCP-related service is reported after login, the documentation says to disable it:

```bash
sudo systemctl disable esx_dhcp_bump.service
```

On Hyper-V, disable the Azure agent to prevent DNS and routing problems:

```bash
systemctl status waagent
sudo systemctl mask waagent
sudo reboot
```

## Step 3: network settings on the VA

### Static IP (local deployments)

Find the name of the second network interface, then create the network file:

```bash
ip addr
sudoedit /etc/systemd/network/static.network
```

```text
[Match]
Name=<interface name>

[Network]
DNS=<dns server>
Address=<ip address>/<prefix length>
Gateway=<gateway>
Domains=<search domain>
```

```bash
sudo reboot
```

Interface names are assigned when the VM is created, so check each VA. Use a different file, not a copy, per VA.

### Local NTP

Where outbound NTP is closed, point each VA to your internal server. Each VA is configured separately:

```bash
sudoedit /etc/systemd/timesyncd.conf        # set NTP=<server names or addresses>, uncomment it
sudo systemctl restart systemd-timesyncd
timedatectl status
```

### Host name mappings for sources

If a source host name does not resolve through DNS, map it in `/home/sailpoint/hosts.yaml` and restart the service. Indentation is exact: two spaces before the address, four spaces then a dash before each name.

```yaml
hosts:
  10.20.30.40:
    - host1.domain.example
    - host1
```

```bash
sudo systemctl restart charon
```

Prefer fixing DNS to maintaining a file on every VA.

### HTTP proxy

Copy the proxy template from SailPoint's community into `/home/sailpoint/` and set it:

```yaml
https_proxy: http://<proxy>:<port>/
http_proxy: http://<proxy>:<port>/
no_proxy: <host1>|<host2>          # hosts to reach directly, such as local APIs
```

Then pass the proxy to the bootstrap commands in the next step. In a cloud network, the VA must not be able to reach the instance metadata address (typically `169.254.169.254`) when it runs behind a proxy. A proxy that inspects TLS must present a certificate the VA trusts, because the VA rejects untrusted certificates.

### Network tunnel

For firewalls that can allow IP addresses but not domain names. It needs outbound 443 to the regional tunnel addresses. The setup guide is on SailPoint's community, behind a login, and the tunnel is not available in some government environments.

## Step 4: create the cluster in the tenant

1. **Admin, Connections, Virtual Appliances, Create New.**
2. Enter a unique cluster name and description. Use a convention such as `<env>-<purpose>-<nn>`.
3. Choose the time zone.
4. Choose the cluster type (Standard).
5. Optionally enable debugging, which gives verbose logs for 24 hours.
6. Save. If you license other components, enable them under cluster components.

## Step 5: pair each VA with the cluster

On each VA, with the same passphrase for every VA in the cluster:

```bash
va-bootstrap set-passphrase
va-bootstrap pair
```

For a proxy VA, add the proxy options to both commands:

```bash
va-bootstrap set-passphrase --http-proxy <http://host:port> --https-proxy <http://host:port>
va-bootstrap pair             --http-proxy <http://host:port> --https-proxy <http://host:port>
```

Then:

1. In the cluster, **Edit, Virtual Appliances, Add New, VA**.
2. Enter the pairing code shown on the VA in the configuration page, and select **Pair**.
3. Wait about 30 minutes.

| Rule | Detail |
|---|---|
| Passphrase | The same on every VA in the cluster. It cannot start with a special character or contain `!`, `/`, `\` or spaces |
| Pairing code | Valid for 4 hours. Generate a new one if it expires |
| Association | By passphrase and pairing code, not by a key file |
| Order | Add the second VA after the first shows as connected, and use the same passphrase |

## Step 6: verify before you attach a source

| Check | Pass |
|---|---|
| VA status | **Connected** for every VA in the cluster |
| Cluster badge | No "Only 1 VA", "Inactive VA" or "VA Did Not Update" badge |
| Time | `timedatectl status` shows synchronised |
| Name resolution | The source host resolves from the VA |
| Port reachability | The source port answers from the VA |
| Outbound | The required SailPoint hosts answer on 443 |
| Source | A test source in the cluster passes **Test Connection** and a small aggregation |
| Failover | Take one VA out of service and confirm a source still aggregates |

Take a VM snapshot after a good configuration, as SailPoint suggests, and delete it once the VA has joined its cluster.

## Step 7: attach sources

- Select the cluster on the source. If the source supports TLS, enable it, and the certificate is copied to the cluster.
- Run **Test Connection**, then a first aggregation, then a full run.
- Record the source, cluster and owner in the cluster plan.
- For directory sources that write, install and test the directory agent on the Windows host (see the directory page).

## Operating the cluster

| Task | How |
|---|---|
| Health | Cluster and VA badges in the tenant, plus the monitors from the hypercare page |
| Restart the cluster | Menu, Restart, confirm. This is the usual first step for a stuck or non-updating VA |
| Updates | Rolling, one VA at a time, not skippable, with no notice. A cluster with a disconnected VA receives no updates at all, so fix an inactive VA quickly |
| Pending OS update | `sudo update_engine_client -status` shows "need reboot" |
| Debug logging | Enable only when needed, and turn it off, because it fills the disk |
| Disk, memory warnings | Check log levels, then the sizing against the requirements |
| Certificate expiry | Replace the expiring certificate under `/home/sailpoint/ca-certificates/` and remove the old one |
| Containers restarting repeatedly | If a container restarts more than 10 times in 30 minutes, update and restart the cluster |
| Password | `passwd` as `sailpoint`, then `sudo reboot`. Save it |

### Adding a VA to a cluster

Deploy the image, apply the network settings, run `va-bootstrap set-passphrase` with the cluster's passphrase and `va-bootstrap pair`, and add it in the cluster. Keep two or more in every cluster.

### Replacing or retiring a VA

- **Delete** a VA from the cluster's edit page, then shut down the instance on your platform. A VA cannot be deleted if it is the only one in its cluster and still has a source attached.
- **SailPoint advises against moving or migrating** existing VAs. Replace by building new.
- **A failed cluster** is replaced by creating a new cluster with at least two VAs, pointing each source at it, checking the connections, and then deleting the old cluster. Expect to re-enter source credentials when a source moves to a different cluster.

## Disaster recovery

The documented approach is a second cluster, not a standby VA: a new cluster is built, sources are re-pointed, and credentials are re-entered. Plan accordingly:

- Keep a runbook for building a replacement cluster, and rehearse it once.
- Keep the credentials for every source retrievable from your vault, because failover needs them.
- Decide which sources are critical enough to keep a warm second cluster for.
- Remember that VAs and clusters are per tenant, so production and sandbox each need their own.

```html
<!-- dgm:va-ha-dr -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 300" role="img" aria-labelledby="va-ha-dr-t va-ha-dr-d" xmlns="http://www.w3.org/2000/svg"><title id="va-ha-dr-t">High availability and disaster recovery</title><desc id="va-ha-dr-d">Two or more appliances in the active cluster give high availability; a second cluster is the disaster recovery path and needs sources re-pointed and credentials re-entered.</desc><defs><marker id="va-ha-dr-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="va-ha-dr-ar-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk teal" style="fill:var(--teal);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box accent" x="330" y="10" width="160" height="50" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="410.0" y="38.5" text-anchor="middle">ISC tenant</text><rect class="grp teal" x="6" y="100" width="380" height="120" style="fill:none;stroke:var(--teal);stroke-opacity:0.65;stroke-dasharray:6 4"/><text class="h" x="16" y="115" text-anchor="start">Primary cluster (active)</text><rect class="box blue" x="26" y="130" width="150" height="66" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="101.0" y="160.0" text-anchor="middle">VA 1</text><text class="s" x="101.0" y="175.0" text-anchor="middle">host or zone A</text><rect class="box blue" x="206" y="130" width="160" height="66" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="286.0" y="160.0" text-anchor="middle">VA 2</text><text class="s" x="286.0" y="175.0" text-anchor="middle">host or zone B</text><rect class="grp gold" x="434" y="100" width="380" height="120" style="fill:none;stroke:var(--gold);stroke-opacity:0.65;stroke-dasharray:6 4"/><text class="h" x="444" y="115" text-anchor="start">DR cluster (standby)</text><rect class="box " x="454" y="130" width="150" height="66" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="529.0" y="160.0" text-anchor="middle">VA 3</text><text class="s" x="529.0" y="175.0" text-anchor="middle">other site</text><rect class="box " x="634" y="130" width="160" height="66" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="714.0" y="160.0" text-anchor="middle">VA 4</text><text class="s" x="714.0" y="175.0" text-anchor="middle">other site</text><path class="ln teal  " d="M196,100 L380,60" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-ha-dr-ar-teal)"/><path class="ln gold dash " d="M624,100 L440,60" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#va-ha-dr-ar-gold)"/><rect class="box " x="250" y="250" width="320" height="40" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="410.0" y="267.0" text-anchor="middle">Sources</text><text class="s" x="410.0" y="282.0" text-anchor="middle">attached to one cluster at a time</text><path class="ln teal  " d="M196,220 L330,250" style="fill:none;stroke:var(--teal);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#va-ha-dr-ar-teal)"/><path class="ln gold dash " d="M624,220 L490,250" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;stroke-dasharray:5 4;" marker-end="url(#va-ha-dr-ar-gold)"/><text class="l" x="806" y="246" text-anchor="end">failover: re-point, re-enter credentials</text></svg></div><figcaption><b>Rolling updates need a pair.</b> One appliance at a time is updated, so two keep the cluster up. SailPoint advises building a new cluster rather than moving existing appliances.</figcaption></figure>
```

## Build checklist

| Done | Item |
|---|---|
| | Cluster plan approved: names, sources, hosts, methods |
| | Firewall requests raised and tested from the VA network |
| | DNS and NTP confirmed |
| | Image deployed, default password changed and stored |
| | Static IP, hosts file or proxy configured |
| | Cluster created in the tenant with the right time zone |
| | Passphrase agreed and stored; each VA paired within four hours |
| | Every VA **Connected**; two or more per cluster |
| | Test source passes; failover tested |
| | Sources attached and documented |
| | Monitoring and alerting on cluster status |
| | Rebuild runbook written |

## Actions

- Plan clusters in a table before you deploy, and give every cluster two or more VAs.
- Build the network (firewall, DNS, NTP, proxy) before the image.
- Change and vault the default password on first login.
- Use one passphrase per cluster and store it.
- Verify with Test Connection and a failover test before you attach production sources.
- Alert on cluster badges, and treat "Only 1 VA" as an incident.
- Rehearse a rebuild.
