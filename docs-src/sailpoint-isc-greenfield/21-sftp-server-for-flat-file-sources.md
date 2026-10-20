---
title: Setting Up an SFTP Server for Flat-File Sources
---

About 120 of the 146 sources on the program were flat files, so the SFTP server behind them was one of the most important pieces of infrastructure in the estate. This page describes the design we used, a build recipe for a Linux SFTP host, the source configuration that reads from it, the file hygiene that keeps reviews correct, and what goes wrong. The commands are examples for a Linux host with OpenSSH. Adapt them to your standards and have your platform team review them.

## How a flat-file source reaches the file

On the program the flat-file sources were **SQL Loader** sources, not the delimited-file type. A SQL Loader source reads a CSV file through a text-file database driver and queries it with SQL, so each file is a table. The virtual appliance opens an SFTP connection to the file server, reads the file and aggregates it like any other source.

```text
Application owner  ->  CSV file  ->  SFTP server  <-- SFTP (22) --  Virtual appliance cluster  ->  ISC source
                                      (one folder and one login per application)
```

The delimited-file source type is the alternative. It is loaded by uploading the file through the UI or API, with no appliance and no server, and it suits small, manual loads. The program used SQL Loader, so that a tool could drop a file and ISC could read it on a schedule. If you need neither a schedule nor an appliance, upload is simpler.

```html
<!-- dgm:sftp-architecture -->
<figure class="sd-fig reveal"><div class="dgm-scroll"><svg class="sd" viewBox="0 0 820 330" role="img" aria-labelledby="sftp-architecture-t sftp-architecture-d" xmlns="http://www.w3.org/2000/svg"><title id="sftp-architecture-t">SFTP host for flat-file sources</title><desc id="sftp-architecture-d">A tool places files in per-application folders; the appliance cluster reads them over SFTP for each SQL Loader source.</desc><defs><marker id="sftp-architecture-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk " style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="sftp-architecture-ar-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk blue" style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker><marker id="sftp-architecture-ar-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk gold" style="fill:var(--gold);fill-opacity:1" d="M0,0 L10,5 L0,10z"/></marker><marker id="sftp-architecture-ar-violet" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="mk violet" style="fill:var(--text);fill-opacity:0.6" d="M0,0 L10,5 L0,10z"/></marker></defs><rect class="box " x="6" y="20" width="150" height="56" style="fill:var(--sd-f0);stroke:var(--text);stroke-opacity:0.32;stroke-width:1.1"/><text class="t" x="81.0" y="45.0" text-anchor="middle">Application owner</text><text class="s" x="81.0" y="60.0" text-anchor="middle">sends the access list</text><rect class="box gold" x="6" y="130" width="150" height="66" style="fill:var(--sd-fg);stroke:var(--gold);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="81.0" y="153.5" text-anchor="middle">Placement tool</text><text class="s" x="81.0" y="168.5" text-anchor="middle">stage, install,</text><text class="s" x="81.0" y="181.5" text-anchor="middle">checksum</text><path class="ln   " d="M81,76 L81,130" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#sftp-architecture-ar)"/><rect class="grp accent" x="220" y="8" width="330" height="314" style="fill:none;stroke:var(--accent);stroke-opacity:0.6;stroke-dasharray:6 4"/><text class="h" x="230" y="23" text-anchor="start">SFTP host (firewalled)</text><rect class="box teal" x="240" y="40" width="290" height="66" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="385.0" y="70.0" text-anchor="middle">/app01/data</text><text class="s" x="385.0" y="85.0" text-anchor="middle">one login per application, file per cycle</text><rect class="box teal" x="240" y="124" width="290" height="66" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="385.0" y="154.0" text-anchor="middle">/app02/data</text><text class="s" x="385.0" y="169.0" text-anchor="middle">one login per application, file per cycle</text><rect class="box teal" x="240" y="208" width="290" height="66" style="fill:var(--sd-ft);stroke:var(--teal);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="385.0" y="238.0" text-anchor="middle">/app03/data</text><text class="s" x="385.0" y="253.0" text-anchor="middle">one login per application, file per cycle</text><path class="ln gold  " d="M156,163 L240,163" style="fill:none;stroke:var(--gold);stroke-opacity:1;stroke-width:1.4;" marker-end="url(#sftp-architecture-ar-gold)"/><text class="l" x="198" y="157" text-anchor="middle">22</text><rect class="box blue" x="620" y="40" width="194" height="66" style="fill:var(--sd-fb);stroke:var(--blue);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="717.0" y="70.0" text-anchor="middle">VA cluster</text><text class="s" x="717.0" y="85.0" text-anchor="middle">reads over SFTP</text><path class="ln blue  " d="M620,73 L530,73" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#sftp-architecture-ar-blue)"/><text class="l" x="575" y="67" text-anchor="middle">22</text><rect class="box violet" x="620" y="140" width="194" height="90" style="fill:var(--sd-fv);stroke:var(--violet);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="717.0" y="169.0" text-anchor="middle">SQL Loader source</text><text class="s" x="717.0" y="184.0" text-anchor="middle">url, login, table = file</text><text class="s" x="717.0" y="197.0" text-anchor="middle">name, merge and index</text><text class="s" x="717.0" y="210.0" text-anchor="middle">columns</text><path class="ln blue  " d="M717,106 L717,140" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#sftp-architecture-ar-blue)"/><rect class="box accent" x="620" y="260" width="194" height="52" style="fill:var(--sd-fa);stroke:var(--accent);stroke-opacity:0.7;stroke-width:1.1"/><text class="t" x="717.0" y="283.0" text-anchor="middle">ISC aggregation</text><text class="s" x="717.0" y="298.0" text-anchor="middle">correlate, then review</text><path class="ln violet  " d="M717,230 L717,260" style="fill:none;stroke:var(--text);stroke-opacity:0.6;stroke-width:1.4;" marker-end="url(#sftp-architecture-ar-violet)"/><text class="l" x="385" y="318" text-anchor="middle"></text></svg></div><figcaption><b>Flat-file path.</b> One shared host, one login and folder per application. Only the appliances and the placement tool connect; application owners never do.</figcaption></figure>
```

## Design decisions

What we observed on the program: one shared Linux SFTP host, one login and one folder per application, the login and an encrypted password stored in the source, and files placed by an administrator tool that used elevated rights on the server. The chroot, the source-address restriction and the scripts on this page are **our recommended hardening**, not a description of what the program had.

| Decision | What we did | Why |
|---|---|---|
| One server, shared | A single Linux SFTP host reachable from the appliance cluster that serves flat files | Cheap, central, one place to monitor |
| One folder and one login per application | Each source has its own SFTP user and folder | One application's credentials cannot read another's file |
| One file per source and cycle | A new, clearly named file for each review cycle | The history is explicit and a reviewer's file is never overwritten |
| File name equals table name | The SQL in the source selects from a table named like the file (without the extension) | The driver treats each file in the folder as a table |
| Password authentication, source credentials in the source | The source stores the SFTP user and an encrypted password | That is how the source authenticates. Restrict by source address (recommended) |
| Admin access by a named administrator with elevated rights | Files are put in place by an automated tool or an administrator, not by application owners | Application owners email a file, a controlled process places it |
| Placement | Reachable by the cluster that serves the source, on a network the appliances can route to | The appliance, not ISC, connects |

Several of these are choices, not rules. A cloud object store with SFTP access, a managed file transfer product, or an existing corporate SFTP service may suit you better, as long as the appliance can reach it and it supports the connection the driver needs. Confirm with a test before you commit.

## Build recipe: the server

### 1. Prepare the host

- A hardened Linux host with time synchronised to your internal time source.
- A separate data volume for the SFTP area, monitored for free space.
- Backups of the data area on your normal schedule (the files are evidence for reviews).
- OpenSSH server, a host firewall, and a log shipper to your central logging.

### 2. Create the group and the base directory

```bash
# one group for every application login
sudo groupadd sftp-apps

# base directory owned by root (required if you use a chroot)
sudo mkdir -p /srv/sftp
sudo chown root:root /srv/sftp
sudo chmod 755 /srv/sftp
```

### 3. Create an application login and folder

Repeat for every application. Use a script (below) so the settings are identical every time.

```bash
APP=app01                               # lower case, no spaces
sudo useradd -g sftp-apps -s /usr/sbin/nologin -d /srv/sftp/$APP -M $APP
# set a long random password and store it in your vault, not in a ticket
sudo passwd $APP

# chroot directory: must be owned by root and not writable by anyone else
sudo mkdir -p /srv/sftp/$APP/data
sudo chown root:root /srv/sftp/$APP
sudo chmod 755       /srv/sftp/$APP

# writable folder inside the chroot
sudo chown $APP:sftp-apps /srv/sftp/$APP/data
sudo chmod 750            /srv/sftp/$APP/data
```

### 4. Configure OpenSSH for SFTP only

Edit `/etc/ssh/sshd_config` (or a file in `sshd_config.d`):

```text
Subsystem sftp internal-sftp

Match Group sftp-apps
    ChrootDirectory /srv/sftp/%u
    ForceCommand internal-sftp
    PasswordAuthentication yes
    PermitTTY no
    AllowTcpForwarding no
    X11Forwarding no
    AllowAgentForwarding no
```

Optionally restrict logins to the appliance addresses:

```text
Match Group sftp-apps Address <VA 1 address>,<VA 2 address>
    ChrootDirectory /srv/sftp/%u
    ForceCommand internal-sftp
```

(Combine the conditions on a single `Match` line, and keep your administrators in a different group that is not forced into `internal-sftp`.) Test the configuration, then reload:

```bash
sudo sshd -t && sudo systemctl reload sshd
```

### 5. Firewall

| From | To | Port | Purpose |
|---|---|---|---|
| Appliances in the cluster | SFTP host | 22 | The source reads the file |
| Administration host | SFTP host | 22 | Placing files, maintenance |
| Nothing else | | | Application owners do not connect |

### 6. Test before you wire a source

```bash
# from a host in the same network zone as the appliances
sftp app01@<sftp host>
sftp> ls
sftp> put test.csv data/test.csv
sftp> bye
```

Then run **Test Connection** from the ISC source, which is the test that matters, because it uses the appliance's network path and the driver's own client.

### A reusable onboarding script

```bash
#!/bin/bash
# add_app.sh <name>  - creates a login and folder for one application
set -euo pipefail
APP="$1"
[[ "$APP" =~ ^[a-z][a-z0-9_-]{2,30}$ ]] || { echo "bad name"; exit 1; }
id "$APP" &>/dev/null && { echo "exists"; exit 1; }

useradd -g sftp-apps -s /usr/sbin/nologin -d /srv/sftp/$APP -M "$APP"
mkdir -p /srv/sftp/$APP/data
chown root:root /srv/sftp/$APP && chmod 755 /srv/sftp/$APP
chown "$APP":sftp-apps /srv/sftp/$APP/data && chmod 750 /srv/sftp/$APP/data

PW=$(openssl rand -base64 24)
echo "$APP:$PW" | chpasswd
echo "Created $APP. Store this password in the vault now: $PW"
```

## Build recipe: the ISC source

The source attributes that mattered on the program (values are placeholders):

```json
{
  "type": "SQLLoader",
  "connectorAttributes": {
    "driverClass": "com.hxtt.sql.text.TextDriver",
    "url": "jdbc:csv:/sftp://<sftp host>/<folder>/",
    "user": "<application login>",
    "password": "<set in the UI, encrypted>",
    "additionalConnProperties": ["_CSV_Header=true", "lockTimeout=30000"],
    "SQL": "select * from <file name without extension> order by [<id column>]",
    "testConnSQL": "select * from <file name without extension> order by [<id column>]",
    "indexColumns": ["<id column>"],
    "mergeRows": true,
    "mergeColumns": ["<entitlement column>"],
    "disableOrderingCheck": true,
    "deleteThresholdPercentage": 10,
    "encrypted": "password,group.password"
  }
}
```

| Setting | Meaning and advice |
|---|---|
| `url` | The data-files URL. The format is `jdbc:csv:` followed by `/sftp://host/folder/`. The documentation shows a variant without the leading slash, so test which one your server needs. Use a path the SFTP login can reach from its starting directory |
| `user`, `password` | The application login. Set the password in the UI so it is stored encrypted |
| `_CSV_Header=true` | The first row is the column header |
| `lockTimeout=30000` | SailPoint recommends at least 30000 ms for remote connections. Without it, a default of one second caused "timeout beyond 1000 ms to open a table" |
| `SQL` | Reads the file as a table. The table is the file name without the extension |
| `indexColumns`, `mergeRows`, `mergeColumns` | When several rows describe one account (one row per entitlement), merge them into one account with a multi-valued attribute. **These are not in the UI.** Add them with the API. The query must be ordered by the index column |
| `disableOrderingCheck` | Skips the sorted-input check. Only safe if you sort the file yourself |
| `deleteThresholdPercentage` | Set it. A truncated or empty file is the commonest cause of mass removal on a flat-file source |

Add the merge attributes with a JSON patch (confirm the path syntax for your API version):

```json
[
  { "op": "add", "path": "/connectorAttributes/mergeRows", "value": true },
  { "op": "add", "path": "/connectorAttributes/mergeColumns", "value": ["<entitlement column>"] },
  { "op": "add", "path": "/connectorAttributes/indexColumns", "value": ["<id column>"] }
]
```

### Schema and correlation

- Define the account schema from the column names, and mark the identifier, display name and entitlement attributes.
- Correlate on one attribute (the email address or the login name), chosen by match rate against the identity cube.
- Run an account aggregation and review the uncorrelated list before you build campaigns on the source.

## File hygiene

Most flat-file failures are file problems. Apply these to every file before it is placed:

| Rule | Why |
|---|---|
| **UTF-8 encoding** | Special characters otherwise appear corrupted after aggregation |
| **A header row** that matches the schema | A new column that is not in the SQL is ignored |
| **Sorted by the index column** when merging | The driver fails with "data should be sorted in ascending order", or accounts split |
| **One spelling of every id** | `USER01` and `user01` in one file made ISC drop one spelling |
| **No stray apostrophes or spaces in headers** | Header names become column names |
| **Consistent line endings** | CRLF is safe |
| **Atomic placement** | Upload under a temporary name and rename, so the appliance never reads a half-written file |
| **Never overwrite a different file of the same name** | Place the new one with a suffix and reconcile |
| **Record a checksum** | Prove later which file a campaign was built from |

A small preparation script that fixes the common problems:

```python
import csv, sys

src, dst, id_col = sys.argv[1], sys.argv[2], sys.argv[3]

with open(src, newline="", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

if not rows:
    sys.exit("refusing to write an empty file")

for r in rows:
    for k in r:
        r[k] = (r[k] or "").strip()
    r[id_col] = r[id_col].lower()          # one spelling of every id

rows.sort(key=lambda r: r[id_col])

with open(dst, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\r\n")
    w.writeheader()
    w.writerows(rows)

print("wrote", len(rows), "rows")
```

### Placing a file as an administrator

On the program, an automated tool placed the files through a staging folder, with elevated rights on the server. The pattern is worth copying even if your tool is a shell script:

1. Upload to a staging folder the administrator owns.
2. Use `sudo install -o <app login> -g <group> -m 664 <staged> <target>` to put the file where the application login can read it, with the right owner.
3. If a file of that name already exists and its checksum differs, place the new one under a different name and stop.
4. Remove the staged copy.
5. Read the file back and compare the checksum before aggregating.

## Monitoring and operations

| Check | Why |
|---|---|
| Free space on the data volume | A full disk makes uploads fail |
| Age of the newest file per application | Stale files produce stale reviews. Compare with the aggregation schedule |
| Count of lines per file against the last | A sudden drop is a truncated file |
| Failed login attempts | Brute force against password logins |
| Connection count from unknown addresses | Anyone other than the appliances and administrators |
| Source health in ISC | The first signal that the file or the path is wrong |
| Backup success | The files are the evidence for reviews |

Housekeeping:

- Keep files for the retention period your audit requires, then archive.
- Rotate application passwords on a schedule and when staff leave, and update the source when you do.
- Review the list of logins quarterly against the list of live sources.
- Treat the server as a controlled system: patched, logged, and covered by your normal access review.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Test Connection: "verify that the location in the Data Files URL is correct" | The URL format or the path is wrong | Use `jdbc:csv:/sftp://host/folder/`, and the complete path for the default folder. Check with a manual SFTP session |
| "timeout beyond 1000 ms to open a table" | The lock timeout is too short for a remote file | `lockTimeout=30000` as an additional connection parameter |
| "Failed to load table ...: read-only file system" | The login cannot write where the driver needs to | Check permissions on the folder |
| "Driver is not valid" with a text file | The file is a text file, not CSV | Use the text variant of the URL and the matching extension property |
| "Data should be sorted in ascending order" | Merging is on and the file is not sorted | Sort the file, or add an `order by` to the query |
| One entitlement per account | Rows for one account are not adjacent | Sort by account id |
| Special characters appear as symbols | Wrong encoding | Save as UTF-8 and re-run |
| A new column is not picked up | The SQL lists columns | Add the column to the query |
| A disabled account is removed after a maintenance task | The source cannot re-read a provisioned account | Add the get-object query |
| Aggregation fails after a credential change | A cached pooled connection | Disable pooling through the API, as documented for the connector |
| Intermittent timeouts or "login failed" | The documentation warns SFTP can fail intermittently for this connector | Retry, check server load and connection limits, and keep files small |
| The source reads an old file | A different file of the same name was not replaced | Check names and checksums, and the folder the URL points to |
| Everything fails at once | The server, the firewall or DNS | Test from a host on the appliance's network |

## Security notes

- Passwords for application logins are credentials. Store them in a vault, never in a spreadsheet or a ticket.
- The file contains personal data about people and their access. Restrict who can read the folders, encrypt backups, and delete files when retention ends.
- Do not let the server initiate connections to the internet.
- A flat-file source is only as accurate as the file. Record who produced it and when.
- Where the file is built from another system, automate it. A manual export that someone forgets to run is the commonest cause of a stale review.

## Actions

- Decide on SQL Loader, upload, or an existing transfer service for each application before you build the server.
- Build one login and one folder per application, from a script.
- Put the file hygiene rules in a script that every file passes through.
- Set the delete threshold, the lock timeout and the merge attributes on every source.
- Monitor file age and size as well as source health.
- Keep a record of which file each campaign was built from.
