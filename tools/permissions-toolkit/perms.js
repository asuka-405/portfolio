// Unix permissions and sudoers. Pure functions, no DOM.
// chmod: octal and symbolic modes, chmod expressions applied to a starting mode, umask results.
// sudoers: a parser and explainer for user specs, aliases and Defaults, with a lint pass for risky rules.

// ------------------------------------------------------------------ modes

const CLASSES = ["user", "group", "other"];

export function parseOctal(str) {
	const s = String(str).trim();
	if (!/^[0-7]{1,4}$/.test(s)) return null;
	return parseInt(s, 8);
}

/** "rwxr-xr-x", "-rwxr-xr-x", "drwxr-sr-t" and so on. Returns the mode number or null. */
export function parseSymbolicString(str) {
	let s = String(str).trim();
	if (/^[-dlcbpsD]/.test(s) && s.length === 10) s = s.slice(1);
	if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(s)) return null;
	let m = 0;
	for (let c = 0; c < 3; c++) {
		const [r, w, x] = s.slice(c * 3, c * 3 + 3);
		if (r === "r") m |= 4 << (6 - c * 3);
		if (w === "w") m |= 2 << (6 - c * 3);
		if (x === "x" || x === "s" || x === "t") m |= 1 << (6 - c * 3);
		if (c === 0 && (x === "s" || x === "S")) m |= 0o4000;
		if (c === 1 && (x === "s" || x === "S")) m |= 0o2000;
		if (c === 2 && (x === "t" || x === "T")) m |= 0o1000;
	}
	return m;
}

export function toSymbolic(mode) {
	let out = "";
	for (let c = 0; c < 3; c++) {
		const bits = (mode >> (6 - c * 3)) & 7;
		const r = bits & 4 ? "r" : "-", w = bits & 2 ? "w" : "-";
		let x = bits & 1 ? "x" : "-";
		if (c === 0 && mode & 0o4000) x = x === "x" ? "s" : "S";
		if (c === 1 && mode & 0o2000) x = x === "x" ? "s" : "S";
		if (c === 2 && mode & 0o1000) x = x === "x" ? "t" : "T";
		out += r + w + x;
	}
	return out;
}

export const toOctal = (mode) => (mode & 0o7777).toString(8).padStart(mode & 0o7000 ? 4 : 3, "0");

/**
 * Applies a chmod expression such as "u+rwx,g=rx,o-w" or "a+X" to a mode.
 * @returns {{ok: true, mode: number, steps: {clause: string, mode: number}[], notes: string[]} | {ok: false, error: string}}
 */
export function applyChmod(expr, start, { isDir = false, umask = 0o022 } = {}) {
	let mode = start & 0o7777;
	const steps = [];
	const notes = [];
	const clauses = String(expr).split(",").map((c) => c.trim()).filter(Boolean);
	if (!clauses.length) return { ok: false, error: "The expression is empty." };
	for (const clause of clauses) {
		const m = /^([ugoa]*)(?:([-+=])([ugo]|[rwxXst]*))+$/.exec(clause);
		if (!m) return { ok: false, error: `"${clause}" is not a valid clause. Use [ugoa]*[-+=][rwxXst] such as u+x or go-w.` };
		const who = m[1];
		let whoSet = who.replace(/a/g, "ugo");
		const noWho = whoSet === "";
		if (noWho) whoSet = "ugo";
		// a clause can chain operations (u+x-w) so parse them one by one
		const re = /([-+=])([ugo]|[rwxXst]*)/g;
		const body = clause.slice(who.length);
		let om;
		while ((om = re.exec(body)) !== null) {
			const op = om[1], permStr = om[2];
			let bits = 0;
			let special = 0;
			if (/^[ugo]$/.test(permStr)) {
				const from = { u: 6, g: 3, o: 0 }[permStr];
				bits = (mode >> from) & 7;
			} else {
				for (const ch of permStr) {
					if (ch === "r") bits |= 4;
					else if (ch === "w") bits |= 2;
					else if (ch === "x") bits |= 1;
					else if (ch === "X") { if (isDir || mode & 0o111) bits |= 1; }
				}
				if (permStr.includes("s")) special |= (whoSet.includes("u") ? 0o4000 : 0) | (whoSet.includes("g") ? 0o2000 : 0);
				if (permStr.includes("t")) special |= 0o1000;
			}
			let applyMask = 0;
			for (const w of whoSet) applyMask |= { u: 0o700, g: 0o070, o: 0o007 }[w];
			let permMask = 0;
			for (const w of whoSet) permMask |= bits << { u: 6, g: 3, o: 0 }[w];
			if (noWho) {
				// with no class letter the umask filters what is set or cleared
				permMask &= ~umask;
				if (op !== "=") notes.push(`"${clause}" has no u, g, o or a, so the umask (${umask.toString(8).padStart(3, "0")}) filters which bits change.`);
			}
			const specialMask = special;
			if (op === "+") mode |= permMask | specialMask;
			else if (op === "-") mode &= ~(permMask | specialMask);
			else {
				mode = (mode & ~applyMask) | permMask;
				if (permStr.includes("s") || permStr.includes("t")) mode |= specialMask;
				else {
					if (whoSet.includes("u")) mode &= ~0o4000;
					if (whoSet.includes("g")) mode &= ~0o2000;
				}
			}
		}
		steps.push({ clause, mode });
	}
	return { ok: true, mode, steps, notes };
}

/** One entry point for the form: an octal, a symbolic string, or a chmod expression applied to `base`. */
export function parseModeInput(text, { base = 0o644, isDir = false, umask = 0o022 } = {}) {
	const t = String(text).trim();
	if (!t) return { ok: false, error: "Enter a mode." };
	const oct = parseOctal(t);
	if (oct !== null) return { ok: true, mode: oct, kind: "octal", steps: [], notes: [] };
	const sym = parseSymbolicString(t);
	if (sym !== null) return { ok: true, mode: sym, kind: "symbolic", steps: [], notes: [] };
	const r = applyChmod(t, base, { isDir, umask });
	return r.ok ? { ...r, kind: "expression" } : r;
}

export function describeMode(mode, { isDir = false } = {}) {
	const m = mode & 0o7777;
	const classes = CLASSES.map((name, i) => {
		const bits = (m >> (6 - i * 3)) & 7;
		return {
			name,
			read: !!(bits & 4),
			write: !!(bits & 2),
			exec: !!(bits & 1),
			text: [
				bits & 4 ? (isDir ? "list entries" : "read") : null,
				bits & 2 ? (isDir ? "create, rename and delete entries" : "write") : null,
				bits & 1 ? (isDir ? "enter (cd, access by name)" : "execute") : null,
			].filter(Boolean).join(", ") || "no access",
		};
	});
	const special = [];
	if (m & 0o4000) special.push({ bit: "setuid", note: isDir ? "Ignored on directories on Linux." : "The program runs with the file owner's privileges." });
	if (m & 0o2000) special.push({ bit: "setgid", note: isDir ? "New files inherit the directory's group." : "The program runs with the file group's privileges." });
	if (m & 0o1000) special.push({ bit: "sticky", note: isDir ? "Only a file's owner (or the directory owner or root) can delete or rename it." : "No effect on Linux files." });
	const warnings = [];
	if (m & 0o002 && !(m & 0o1000 && isDir)) warnings.push("World-writable: any local user can change this" + (isDir ? ", and add or remove entries." : "."));
	if (m & 0o002 && m & 0o1000 && isDir) warnings.push("World-writable with the sticky bit: shared scratch directory like /tmp. Users can only delete their own entries.");
	if (m & 0o4000 && !(m & 0o100)) warnings.push("setuid without owner execute (shown as S) has no effect and is usually a mistake.");
	if (m & 0o2000 && !(m & 0o010) && !isDir) warnings.push("setgid without group execute (shown as S) means mandatory locking on old kernels, otherwise no effect.");
	if (m & 0o4000 && !isDir) warnings.push("setuid programs are a classic privilege escalation target. Make sure the file is root-owned and not writable by others.");
	if ((m & 0o007) === 0o007) warnings.push("Others have full access (rwx).");
	if (!isDir && m & 0o111 && m & 0o022) warnings.push("Executable and writable by group or others: anyone with write access can change what runs.");
	if (isDir && !(m & 0o111) ) warnings.push("No execute bit on a directory: nobody covered by this mode can enter it, even if they can list it.");
	if (isDir && m & 0o444 && !(m & 0o111)) warnings.push("Read without execute on a directory lets you list names but not open the files.");
	return { octal: toOctal(m), octal4: (m & 0o7777).toString(8).padStart(4, "0"), symbolic: toSymbolic(m), classes, special, warnings: warnings.filter(Boolean) };
}

export function umaskResult(umask) {
	const u = umask & 0o777;
	const file = 0o666 & ~u, dir = 0o777 & ~u;
	return { umask: u.toString(8).padStart(3, "0"), file: { octal: toOctal(file), symbolic: toSymbolic(file) }, dir: { octal: toOctal(dir), symbolic: toSymbolic(dir) } };
}

export const COMMON_MODES = [
	{ mode: "644", use: "Regular file: owner writes, everyone reads." },
	{ mode: "755", use: "Program or directory: owner writes, everyone can run or enter." },
	{ mode: "600", use: "Private file: SSH keys, credentials, .env." },
	{ mode: "700", use: "Private directory or script, such as ~/.ssh." },
	{ mode: "640", use: "Config file readable by a service group, e.g. root:www-data." },
	{ mode: "750", use: "Program or directory limited to owner and group." },
	{ mode: "664", use: "Group-writable file, with a shared group and umask 002." },
	{ mode: "775", use: "Group-writable shared directory." },
	{ mode: "1777", use: "Sticky shared scratch directory such as /tmp." },
	{ mode: "2775", use: "Shared project directory: new files inherit the group." },
	{ mode: "4755", use: "setuid root program such as /usr/bin/passwd. Rare and risky." },
	{ mode: "440", use: "Sudoers files: read-only for root and group root." },
];

// ------------------------------------------------------------------ sudoers

const SHELLISH = new Set(["bash", "sh", "zsh", "dash", "csh", "ksh", "fish", "su"]);
const ESCAPABLE = new Set(["vi", "vim", "view", "nvim", "nano", "emacs", "ed", "less", "more", "man", "most", "find", "awk", "gawk", "mawk", "perl", "python", "python3", "ruby", "lua", "php", "node", "env", "xargs", "tar", "zip", "unzip", "cp", "mv", "tee", "dd", "rsync", "git", "ftp", "gdb", "nmap", "docker", "podman", "mount", "chmod", "chown", "systemctl", "journalctl", "scp", "ssh", "curl", "wget", "sed", "ex", "pico", "script", "watch", "time", "timeout", "nice", "ionice", "strace", "ltrace", "apt", "apt-get", "dpkg", "yum", "dnf", "rpm", "pip", "pip3", "crontab", "service", "mysql", "psql", "sqlite3", "screen", "tmux", "busybox", "openssl", "base64", "cat", "head", "tail", "cut", "sort", "uniq", "tr", "ls"]);
const HARD_ESCAPE = new Set(["vi", "vim", "view", "nvim", "nano", "emacs", "ed", "less", "more", "man", "most", "find", "awk", "gawk", "perl", "python", "python3", "ruby", "lua", "php", "node", "env", "xargs", "tar", "zip", "cp", "mv", "tee", "dd", "rsync", "git", "ftp", "gdb", "nmap", "docker", "podman", "mount", "chmod", "chown", "scp", "ssh", "sed", "ex", "script", "watch", "time", "timeout", "nice", "strace", "apt", "apt-get", "dpkg", "pip", "pip3", "crontab", "mysql", "psql", "screen", "tmux", "busybox", "openssl", "systemctl", "journalctl", "curl", "wget"]);

const KNOWN_DEFAULTS = {
	env_reset: "Resets the environment to a safe minimum before running commands.",
	secure_path: "Fixed PATH used for sudo commands.",
	requiretty: "Only allow sudo from a terminal (breaks cron and automation).",
	use_pty: "Run commands in a pseudo-terminal, which blocks some terminal injection tricks.",
	authenticate: "Ask the user for a password. !authenticate disables the prompt.",
	timestamp_timeout: "Minutes a password prompt stays valid. 0 always asks, negative never expires.",
	passwd_tries: "Password attempts before sudo gives up.",
	logfile: "Write a sudo log to this file.",
	log_input: "Log what the user types.",
	log_output: "Log what the command prints.",
	lecture: "When to show the first-use lecture.",
	insults: "Funny insults on a wrong password.",
	visiblepw: "Allow sudo to run even if the password is shown on screen (ssh without a tty).",
	always_set_home: "Set $HOME to the target user's home.",
	env_keep: "Variables kept from the caller's environment.",
	env_check: "Variables kept only if they look safe.",
	env_delete: "Variables always removed.",
	mail_badpass: "Mail root on a bad password.",
	setenv: "Allow the user to set environment variables on the command line.",
	noexec: "Block the command from running further programs (shell escapes).",
	umask: "Umask for the commands.",
	runas_default: "Default user to run as.",
	editor: "Editor used by sudoedit and visudo.",
	pwfeedback: "Show asterisks when typing the password.",
	rootpw: "Ask for root's password instead of the user's.",
	targetpw: "Ask for the target user's password.",
	runaspw: "Ask for the runas user's password.",
	shell_noargs: "Run a shell when sudo is given no command.",
	set_home: "Set $HOME to the target user's home when using -s.",
	stay_setuid: "Keep the real uid when running setuid.",
	syslog: "Syslog facility for sudo messages.",
	tty_tickets: "A separate password timestamp per terminal.",
	mailto: "Address that receives sudo mail.",
	closefrom: "Close open file descriptors from this number up.",
	ignore_dot: "Ignore a . in PATH.",
	exec_background: "Run the command in the background.",
	fqdn: "Match hosts by fully qualified name.",
	"ignore_local_sudoers": "Ignore the local file when using LDAP.",
};

/** Joins lines ending in a backslash. Returns [{no, text}] with the first line number of each joined entry. */
function logicalLines(text) {
	const raw = String(text).split(/\r?\n/);
	const out = [];
	let buf = null;
	raw.forEach((line, idx) => {
		if (buf) { buf.text += line.replace(/^\s+/, ""); } else buf = { no: idx + 1, text: line };
		if (/\\\s*$/.test(buf.text) && idx < raw.length - 1) { buf.text = buf.text.replace(/\\\s*$/, " "); return; }
		out.push(buf);
		buf = null;
	});
	if (buf) out.push(buf);
	return out;
}

const stripComment = (s) => {
	// a # starts a comment unless it begins a user id (#1000), directive (#include) or is escaped; only treat as comment when preceded by whitespace
	const m = /(^|\s)#(?!\d|include|includedir)/.exec(s);
	return m ? s.slice(0, m.index + m[1].length).trimEnd() : s.trimEnd();
};

function splitTop(s, sep) {
	const parts = [];
	let cur = "";
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "\\" && i + 1 < s.length) { cur += c + s[i + 1]; i++; continue; }
		if (c === sep) { parts.push(cur); cur = ""; continue; }
		cur += c;
	}
	parts.push(cur);
	return parts.map((p) => p.trim()).filter((p) => p !== "");
}

const TAGS = ["NOPASSWD", "PASSWD", "NOEXEC", "EXEC", "SETENV", "NOSETENV", "LOG_INPUT", "NOLOG_INPUT", "LOG_OUTPUT", "NOLOG_OUTPUT", "MAIL", "NOMAIL", "FOLLOW", "NOFOLLOW", "INTERCEPT", "NOINTERCEPT"];

function parseCmndSpec(rest) {
	// optional (runas) then tags then commands
	let runas = null;
	let s = rest.trim();
	const ra = /^\(([^)]*)\)\s*/.exec(s);
	if (ra) { runas = ra[1].trim(); s = s.slice(ra[0].length); }
	const cmds = [];
	let tags = [];
	for (const part of splitTop(s, ",")) {
		let p = part;
		let m;
		while ((m = /^([A-Z_]+):\s*/.exec(p)) && TAGS.includes(m[1])) { tags = tags.filter((t) => t !== m[1]); tags.push(m[1]); p = p.slice(m[0].length); }
		const rm = /^\(([^)]*)\)\s*/.exec(p);
		if (rm) { runas = rm[1].trim(); p = p.slice(rm[0].length); }
		if (p) cmds.push({ text: p, tags: tags.slice() });
	}
	return { runas, cmds };
}

/** @returns {{entries: object[], errors: {line: number, message: string}[]}} */
export function parseSudoers(text) {
	const entries = [];
	const errors = [];
	for (const { no, text: raw } of logicalLines(text)) {
		const line = stripComment(raw.trim());
		if (!line) continue;
		let m;
		if ((m = /^(?:#|@)(includedir|include)\s+(\S+)/.exec(line))) { entries.push({ kind: "include", line: no, raw: line, dir: m[1] === "includedir", path: m[2] }); continue; }
		if ((m = /^(User_Alias|Runas_Alias|Host_Alias|Cmnd_Alias)\s+(.+)$/.exec(line))) {
			for (const def of splitTop(m[2], ":")) {
				const dm = /^([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/.exec(def);
				if (!dm) { errors.push({ line: no, message: `Bad alias definition "${def}". Alias names are UPPER_CASE.` }); continue; }
				entries.push({ kind: "alias", line: no, raw: line, type: m[1], name: dm[1], members: splitTop(dm[2], ",") });
			}
			continue;
		}
		if ((m = /^Defaults(?:([:@!>])\s*(\S+))?\s+(.+)$/.exec(line))) {
			const scope = m[1] ? { ":": "user", "@": "host", "!": "command", ">": "runas" }[m[1]] : "global";
			const items = splitTop(m[3], ",").map((it) => {
				const im = /^([!]?)([A-Za-z_][A-Za-z0-9_]*)(?:\s*([+\-]?=)\s*(.*))?$/.exec(it);
				if (!im) return { raw: it, name: it, negated: false };
				return { raw: it, negated: im[1] === "!", name: im[2], op: im[3] || null, value: im[4] === undefined ? null : im[4].replace(/^"(.*)"$/, "$1") };
			});
			entries.push({ kind: "defaults", line: no, raw: line, scope, target: m[2] || null, items });
			continue;
		}
		// user spec: users hosts = [(runas)] [TAGS:] cmds [: hosts = ...]
		const eq = line.indexOf("=");
		if (eq < 0) { errors.push({ line: no, message: `Cannot read this line: "${line}". A rule needs "users hosts = commands".` }); continue; }
		const left = line.slice(0, eq).replace(/\s*,\s*/g, ",").trim().split(/\s+/);
		if (left.length < 2) { errors.push({ line: no, message: 'A rule needs users and hosts before "=", e.g. "alice ALL = ...".' }); continue; }
		if (left.length > 2) { errors.push({ line: no, message: `Too many words before "=": "${left.join(" ")}". Separate list items with commas, no spaces.` }); continue; }
		const specs = [];
		const rightFull = line.slice(eq + 1).trim();
		// more than one host group on a line is rare: " : host = cmds"
		const groups = rightFull.split(/\s+:\s+(?=\S+\s*=)/);
		const first = parseCmndSpec(groups[0]);
		specs.push({ hosts: left[1].split(","), ...first });
		for (const g of groups.slice(1)) {
			const gm = /^(\S+)\s*=\s*(.*)$/.exec(g);
			if (gm) specs.push({ hosts: gm[1].split(","), ...parseCmndSpec(gm[2]) });
		}
		if (!first.cmds.length) errors.push({ line: no, message: "No commands after the equals sign." });
		entries.push({ kind: "rule", line: no, raw: line, users: left[0].split(","), specs });
	}
	return { entries, errors };
}

function describeWho(w) {
	if (w === "ALL") return "any user";
	if (w.startsWith("%:")) return `members of the non-Unix group ${w.slice(2)}`;
	if (w.startsWith("%")) return `members of the group ${w.slice(1)}`;
	if (w.startsWith("#")) return `the user with uid ${w.slice(1)}`;
	if (w.startsWith("+")) return `members of the netgroup ${w.slice(1)}`;
	if (w.startsWith("!")) return `anyone except ${describeWho(w.slice(1))}`;
	return w;
}

export function explainEntry(e) {
	if (e.kind === "include") return e.dir ? `Reads every file in ${e.path}, skipping names with a "." or ending in "~".` : `Reads the file ${e.path}.`;
	if (e.kind === "alias") return `${e.type.replace("_Alias", "")} alias ${e.name} = ${e.members.join(", ")}.`;
	if (e.kind === "defaults") {
		const sc = { global: "For everyone", user: `For user ${e.target}`, host: `On host ${e.target}`, command: `For command ${e.target}`, runas: `When running as ${e.target}` }[e.scope];
		return `${sc}: ${e.items.map((it) => `${it.negated ? "turn off" : it.op ? "set" : "turn on"} ${it.name}${it.value !== null && it.value !== undefined ? ` ${it.op === "+=" ? "+= " : it.op === "-=" ? "-= " : "= "}${it.value}` : ""}`).join("; ")}.`;
	}
	if (e.kind === "rule") {
		return e.specs.map((s) => {
			const hosts = s.hosts.includes("ALL") ? "on any host" : `on ${s.hosts.join(", ")}`;
			const who = e.users.map(describeWho).join(" or ");
			const runas = s.runas === null || s.runas === "" ? "as root" : /^ALL(:ALL)?$/.test(s.runas) ? "as any user" + (s.runas === "ALL:ALL" ? " and any group" : "") : s.runas.startsWith(":") ? `with group ${s.runas.slice(1)}` : `as ${s.runas}`;
			const cmds = s.cmds.map((c) => `${c.tags.includes("NOPASSWD") ? "(no password) " : ""}${c.text === "ALL" ? "any command" : c.text}`).join(", ");
			return `${who} may run ${cmds} ${runas} ${hosts}.`;
		}).join(" ");
	}
	return "";
}

/** @returns {{level: "error"|"warn"|"info", line: number, message: string}[]} */
export function lintSudoers(parsed) {
	const out = [];
	const add = (level, line, message) => out.push({ level, line, message });
	const aliases = new Set(parsed.entries.filter((e) => e.kind === "alias").map((e) => e.name));
	for (const err of parsed.errors) add("error", err.line, err.message);
	for (const e of parsed.entries) {
		if (e.kind === "defaults") {
			for (const it of e.items) {
				const name = it.name;
				if (!(name in KNOWN_DEFAULTS) && !/^(sudoers_locale|iolog_|lecture_|passprompt|badpass_message|authfail_message|timestamp_type|verifypw|listpw|command_timeout|case_insensitive|rlimit_|runchroot|runcwd|intercept|log_|syslog_|maxseq|compress_io|admin_flag|exempt_group|env_file|group_plugin|sudoedit_|noexec_file|shell_noargs|mailerflags|mailerpath|mailfrom|mailsub|mail_|passwd_|pam_|path_info|preserve_groups|secure_path|stay_setuid|umask_override|use_loginclass|sudoedit_follow|selinux|role|type|apparmor|privs|limitprivs|fast_glob|ignore_audit_errors|ignore_iolog_errors|ignore_logfile_errors|netgroup_tuple|noninteractive_auth|visiblepw|zero_|ldap)/.test(name)) add("warn", e.line, `Unknown Defaults setting "${name}". A typo here makes sudo refuse the whole file.`);
				if (name === "authenticate" && it.negated) add("warn", e.line, e.scope === "global" ? "!authenticate turns the password prompt off for everyone." : "!authenticate turns off the password prompt in this scope.");
				if (name === "env_reset" && it.negated) add("warn", e.line, "!env_reset passes the caller's whole environment (including PATH, LD_PRELOAD) into privileged commands.");
				if (name === "requiretty" && !it.negated) add("info", e.line, "requiretty blocks sudo from cron, systemd units and most automation without a tty.");
				if (name === "visiblepw" && !it.negated) add("info", e.line, "visiblepw lets passwords echo on the screen when there is no hidden-input terminal.");
				if (name === "timestamp_timeout" && (Number(it.value) < 0)) add("warn", e.line, "A negative timestamp_timeout means the password never expires for the session.");
				if (name === "secure_path" && it.value && /(^|:)(\.|)(:|$)/.test(it.value)) add("error", e.line, "secure_path contains an empty or . entry, which puts the current directory in PATH.");
			}
			continue;
		}
		if (e.kind === "alias") {
			if (e.type === "Cmnd_Alias") for (const m of e.members) lintCommand(m, e.line, add, aliases, `Cmnd_Alias ${e.name}`);
			continue;
		}
		if (e.kind === "include") {
			if (e.dir) add("info", e.line, "Files in an include directory are read in alphabetical order, and a later match overrides an earlier one. Name them with a number prefix (10-web, 20-db).");
			continue;
		}
		if (e.kind !== "rule") continue;
		const everyone = e.users.some((u) => u === "ALL");
		for (const s of e.specs) {
			const runasAll = s.runas !== null && /^ALL/.test(s.runas);
			const rootLike = s.runas === null || s.runas === "" || /(^|:|,)\s*root\s*(,|$)/.test(s.runas) || runasAll;
			for (const c of s.cmds) {
				const isAll = c.text === "ALL";
				const nopass = c.tags.includes("NOPASSWD");
				if (isAll && rootLike && nopass) add("error", e.line, `${e.users.join(", ")} can run any command as ${runasAll ? "any user" : "root"} without a password. This is full root with no prompt.`);
				else if (isAll && rootLike) {
					const admin = e.users.every((u) => u === "root" || /^%(wheel|sudo|admin)$/.test(u));
					add(everyone ? "error" : admin ? "info" : "warn", e.line, `${everyone ? "Every user" : e.users.join(", ")} can run any command as ${runasAll ? "any user" : "root"}. That is full root${admin ? ", which is normal for this account or group" : ""}.`);
				}
				else if (isAll && nopass) add("warn", e.line, "ALL commands without a password.");
				if (everyone && !isAll) add("warn", e.line, "The rule applies to ALL users. Grant to a group or named users instead.");
				if (nopass && !isAll && /\*/.test(c.text)) add("warn", e.line, "NOPASSWD with a wildcard in the command. Wildcards match spaces and can let the caller add arguments.");
				if (!isAll) lintCommand(c.text, e.line, add, aliases, null, nopass);
			}
		}
	}
	// duplicate rules for one user
	const seen = new Map();
	for (const e of parsed.entries.filter((x) => x.kind === "rule")) {
		const key = e.users.join(",") + "|" + e.specs.map((s) => s.cmds.map((c) => c.text).join(";")).join("/");
		if (seen.has(key)) add("info", e.line, `Same users and commands as line ${seen.get(key)}.`);
		else seen.set(key, e.line);
	}
	return out.sort((a, b) => a.line - b.line);
}

function lintCommand(text, line, add, aliases, ctx, nopass = false) {
	let t = text.trim();
	const negated = t.startsWith("!");
	if (negated) {
		add("warn", line, `Negated command "${t}": sudoers matches by path, so a copy, a symlink or a different spelling of the program is not blocked. Negation is not a security boundary.`);
		t = t.slice(1).trim();
	}
	if (aliases.has(t) || /^[A-Z][A-Z0-9_]*$/.test(t)) return;
	if (t === "sudoedit" || t.startsWith("sudoedit ")) return;
	const bin = t.split(/\s+/)[0];
	const path = bin.replace(/\\ /g, " ");
	if (!path.startsWith("/") && !/^[A-Z][A-Z0-9_]*$/.test(path) && !path.startsWith("^") ) add("error", line, `"${path}" is not an absolute path. sudoers needs the full path to the program (for example /usr/bin/${path.split("/").pop()}).`);
	const name = path.split("/").pop();
	if (SHELLISH.has(name)) add("error", line, `${name} is a shell. Allowing it is the same as allowing ALL.`);
	else if (HARD_ESCAPE.has(name) && !/\s\S/.test(t)) add("warn", line, `${name} without fixed arguments can spawn a shell or write any file (see GTFOBins). Restrict the arguments, or use NOEXEC and sudoedit.`);
	else if (HARD_ESCAPE.has(name) && /\*/.test(t)) add("warn", line, `${name} with a wildcard argument can be turned into a shell or an arbitrary file write.`);
	else if (ESCAPABLE.has(name) && !/\s\S/.test(t)) add("info", line, `${name} without arguments lets the caller pass any arguments. Fix the arguments if possible.`);
	if (/\*/.test(t) && !HARD_ESCAPE.has(name)) add("warn", line, `Wildcard in "${t}": a * also matches spaces and slashes, so the caller can add arguments or path segments.`);
	if (/\/(tmp|var\/tmp|home)\//.test(path)) add("warn", line, `"${path}" is in a location users can write to. Anyone who can replace that file gets root.`);
}

export const SAMPLE_SUDOERS = `# Aliases
User_Alias   ADMINS = alice, bob
Cmnd_Alias   WEB    = /usr/bin/systemctl restart nginx, /usr/bin/systemctl status nginx
Cmnd_Alias   DEBUG  = /usr/bin/vim /etc/nginx/*, /bin/bash

Defaults     env_reset
Defaults     secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"
Defaults:deploy !authenticate

root         ALL=(ALL:ALL) ALL
%wheel       ALL=(ALL) ALL
ADMINS       ALL=(ALL) NOPASSWD: WEB, DEBUG
deploy       web1,web2 = (www-data) NOPASSWD: /opt/app/deploy.sh, /usr/bin/rsync -a /srv/build/ /var/www/
ci           ALL = NOPASSWD: ALL
backup       ALL = /usr/bin/tar *, systemctl stop db

@includedir /etc/sudoers.d
`;
