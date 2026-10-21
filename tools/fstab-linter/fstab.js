// fstab parser and linter. Pure functions, no DOM.
// Checks fields, device specs, mount points, options against the filesystem, fsck pass numbers, duplicates, ordering and security hints.

import { OPTION_HELP } from "../arch-installer/archgen.js";

const PSEUDO = new Set(["proc", "sysfs", "devtmpfs", "devpts", "tmpfs", "cgroup", "cgroup2", "securityfs", "debugfs", "tracefs", "configfs", "fusectl", "mqueue", "hugetlbfs", "pstore", "bpf", "efivarfs", "ramfs", "autofs", "binfmt_misc", "selinuxfs"]);
const DISK_FS = new Set(["ext2", "ext3", "ext4", "xfs", "btrfs", "f2fs", "jfs", "reiserfs", "nilfs2", "bcachefs", "zfs", "vfat", "fat", "msdos", "exfat", "ntfs", "ntfs3", "ntfs-3g", "hfsplus", "udf", "iso9660", "swap", "crypto_LUKS"]);
const NET_FS = new Set(["nfs", "nfs4", "cifs", "smb3", "smbfs", "sshfs", "fuse.sshfs", "glusterfs", "ceph", "9p", "davfs", "afs"]);
const OTHER_FS = new Set(["auto", "overlay", "squashfs", "erofs", "fuse", "none", "bind", "rbind", "virtiofs"]);
const FSCK_FS = new Set(["ext2", "ext3", "ext4", "jfs", "reiserfs"]);
const UNIX_PERM_LESS = new Set(["vfat", "fat", "msdos", "exfat", "ntfs", "ntfs3", "ntfs-3g", "hfsplus", "udf", "iso9660", "cifs", "smb3"]);

const OPTION_NOTES = {
	noauto: "Not mounted at boot.",
	user: "Any user may mount it (implies noexec, nosuid, nodev unless later options override).",
	users: "Any user may mount and unmount it.",
	owner: "The device owner may mount it.",
	nofail: "A missing device does not stop the boot.",
	sync: "Writes are synchronous: safe for removable media but slow and wears flash.",
	async: "Writes go through the cache (default).",
	"x-systemd.device-timeout": "How long systemd waits for the device before giving up.",
	"x-systemd.requires": "Another unit this mount needs.",
	"x-systemd.automount": "Mount on first access.",
	"x-systemd.mount-timeout": "How long systemd waits for the mount to finish.",
	"x-gvfs-show": "Show in file managers.",
	commit: "ext4: seconds between journal commits.",
	errors: "What to do on a filesystem error: continue, remount-ro or panic.",
	barrier: "Write barriers.",
	data: "ext4 journal mode: ordered, writeback or journal.",
	hidepid: "proc: hide other users' process directories (2 hides them entirely).",
	gid: "proc: group allowed to see all processes (with hidepid).",
	pri: "Swap priority.",
	discard: "Continuous TRIM.",
	lazytime: "Update inode timestamps in memory and flush later.",
	relatime: "Update access time only when older than modify time (default).",
	strictatime: "Always update access time.",
	nodiratime: "Do not update directory access times.",
	mode: "Permission bits of the mount point (tmpfs).",
	nr_inodes: "Maximum inode count (tmpfs).",
	fsc: "Use local FS-Cache for this network mount.",
	vers: "NFS or CIFS protocol version.",
	hard: "NFS: retry forever (default). Safe for data, can hang programs if the server is gone.",
	soft: "NFS: give up after retries. Can corrupt data on timeouts.",
	intr: "NFS: obsolete; ignored by modern kernels.",
	actimeo: "NFS attribute cache time.",
	credentials: "CIFS: file holding username and password.",
	username: "CIFS username.",
	password: "CIFS password. Do not put it in fstab, which anyone can read.",
	sec: "NFS or CIFS security flavour.",
	iocharset: "Character set for file names (vfat).",
	codepage: "Code page for short names (vfat).",
	shortname: "How vfat short names are handled.",
	utf8: "Use UTF-8 for names (vfat).",
	flush: "Flush data more often (vfat).",
	subvolid: "Btrfs: mount the subvolume with this id.",
	autodefrag: "Btrfs: background defragmentation of small random writes.",
	noatime: "No access time updates.",
	ro: "Read-only.",
	rw: "Read-write.",
};

const KNOWN_OPTS = new Set([
	"sw", 	...Object.keys(OPTION_HELP), ...Object.keys(OPTION_NOTES),
	"suid", "nosuid", "dev", "nodev", "exec", "noexec", "auto", "nouser", "diratime", "atime", "norelatime", "nostrictatime", "mand", "nomand", "silent", "loud", "iversion", "noiversion",
	"nobarrier", "nodiscard", "nobh", "usrquota", "grpquota", "prjquota", "quota", "noquota", "acl", "noacl", "user_xattr", "nouser_xattr", "bind", "rbind", "remount", "move", "private", "shared", "slave", "unbindable",
	"inode64", "inode32", "logbufs", "logbsize", "largeio", "nolargeio", "swalloc", "nouuid", "noalign", "wsync", "attr2", "noattr2", "uquota", "gquota", "pquota", "uqnoenforce", "gqnoenforce", "pqnoenforce",
	"nodatasum", "datasum", "datacow", "nodatacow", "ssd", "nossd", "ssd_spread", "space_cache", "nospace_cache", "clear_cache", "thread_pool", "flushoncommit", "noflushoncommit", "skip_balance", "degraded", "enospc_debug",
	"nofail", "relatime", "fmask", "dmask", "umask", "uid", "gid", "iocharset", "nls", "windows_names", "case", "discard", "prealloc", "force", "sys_immutable", "nohidden", "hidden", "sparse", "showmeta", "noacsrules",
	"_netdev", "rsize", "wsize", "timeo", "retrans", "proto", "port", "nolock", "lock", "tcp", "udp", "nfsvers", "mountproto", "local_lock", "nconnect", "rdirplus", "cto", "nocto", "ac", "noac", "sharecache", "nosharecache",
	"serverino", "noserverino", "file_mode", "dir_mode", "forceuid", "forcegid", "cache", "rw", "seal", "nounix", "mfsymlinks", "domain", "ip", "noperm", "noblocksend", "nobrl", "multiuser", "noacl",
	"lowerdir", "upperdir", "workdir", "index", "redirect_dir", "metacopy", "xino", "volatile", "trans", "version", "msize", "access", "dfltuid", "dfltgid",
]);

const OPT_PREFIXES = ["x-systemd.", "x-mount.", "x-initrd.", "x-gvfs-", "x-udisks-", "x-", "comment="];

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const FAT_UUID_RE = /^[0-9a-fA-F]{4}-[0-9a-fA-F]{4}$/;
const NTFS_UUID_RE = /^[0-9a-fA-F]{16}$/;

const unescapeField = (s) => s.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));

/** @returns {{entries: object[], comments: number}} each entry: {line, raw, fields, spec, mount, type, options, dump, pass, optionList} */
export function parseFstab(text) {
	const entries = [];
	let comments = 0;
	String(text).split(/\r?\n/).forEach((raw, idx) => {
		const t = raw.trim();
		if (!t) return;
		if (t.startsWith("#")) { comments++; return; }
		const fields = t.split(/\s+/);
		const e = {
			line: idx + 1,
			raw,
			fields,
			spec: fields[0],
			mount: fields[1] === undefined ? undefined : unescapeField(fields[1]),
			mountRaw: fields[1],
			type: fields[2],
			options: fields[3],
			dump: fields[4],
			pass: fields[5],
		};
		e.optionList = e.options ? e.options.split(",").filter((o) => o !== "") : [];
		entries.push(e);
	});
	return { entries, comments };
}

export function optionHelp(opt) {
	const [key, value] = opt.split("=");
	const text = OPTION_HELP[opt] || OPTION_HELP[key] || OPTION_NOTES[opt] || OPTION_NOTES[key];
	if (text) return text;
	if (OPT_PREFIXES.some((p) => opt.startsWith(p))) return "A mount helper or systemd option, passed through and not checked here.";
	if (/^(uid|gid)$/.test(key) && value) return `Owner ${key} for files on this filesystem.`;
	return "";
}

const isKnownOption = (o) => {
	const key = o.split("=")[0];
	return KNOWN_OPTS.has(o) || KNOWN_OPTS.has(key) || OPT_PREFIXES.some((p) => o.startsWith(p)) || /^no[a-z_]+$/.test(key) && KNOWN_OPTS.has(key.slice(2));
};

const kindOfSpec = (spec) => {
	if (/^UUID=/i.test(spec)) return "uuid";
	if (/^PARTUUID=/i.test(spec)) return "partuuid";
	if (/^LABEL=/i.test(spec)) return "label";
	if (/^PARTLABEL=/i.test(spec)) return "partlabel";
	if (/^\/dev\/(sd|hd|vd|xvd)[a-z]+\d*$/.test(spec) || /^\/dev\/nvme\d+n\d+(p\d+)?$/.test(spec) || /^\/dev\/mmcblk\d+(p\d+)?$/.test(spec) || /^\/dev\/sr\d+$/.test(spec)) return "kernel-name";
	if (/^\/dev\/mapper\//.test(spec) || /^\/dev\/disk\/by-/.test(spec) || /^\/dev\/[a-z0-9_-]+\/[a-z0-9_.+-]+$/i.test(spec)) return "stable-path";
	if (/^\/\/[^/\s]+\/\S+/.test(spec)) return "smb";
	if (/^[A-Za-z0-9._-]+:\/\S*$/.test(spec) || /^\[[0-9a-fA-F:]+\]:\/\S*$/.test(spec)) return "nfs";
	if (spec.startsWith("/")) return "path";
	if (/^[A-Za-z][A-Za-z0-9_.-]*$/.test(spec)) return "pseudo";
	return "unknown";
};

/** @returns {{level: "error"|"warn"|"info", line: number, message: string}[]} */
export function lintFstab(parsed) {
	const out = [];
	const add = (level, line, message) => out.push({ level, line, message });
	const { entries } = parsed;
	if (!entries.length) return [{ level: "info", line: 0, message: "No entries found." }];

	const mounts = new Map();
	const specs = new Map();
	let rootEntry = null;
	let pass1 = [];

	for (const e of entries) {
		const L = e.line;
		const f = e.fields;
		if (f.length < 4) { add("error", L, `Only ${f.length} field${f.length === 1 ? "" : "s"}: expected "spec mountpoint type options [dump pass]".`); if (f.length < 3) continue; }
		if (f.length > 6) add("error", L, `${f.length} fields. A path with spaces must be written with \\040 (and a comment must start with #).`);
		const type = e.type || "";
		const opts = e.optionList;
		const hasOpt = (o) => opts.includes(o);
		const optVal = (k) => { const o = opts.find((x) => x.startsWith(`${k}=`)); return o ? o.slice(k.length + 1) : null; };
		const isSwap = type === "swap";
		const isNet = NET_FS.has(type);
		const isPseudo = PSEUDO.has(type);
		const kind = kindOfSpec(e.spec);

		// --- type
		if (type && !DISK_FS.has(type) && !NET_FS.has(type) && !PSEUDO.has(type) && !OTHER_FS.has(type) && !/^fuse\./.test(type)) add("warn", L, `Unknown filesystem type "${type}". Check the spelling (ext4, xfs, btrfs, vfat, tmpfs, nfs ...).`);
		if (type === "ext3" || type === "ext2" || type === "reiserfs" || type === "msdos") add("info", L, `${type} is old. ext4 or xfs is the usual choice today.`);
		if (type === "ntfs") add("info", L, "type ntfs uses the old read-only-leaning driver on many systems. ntfs3 (kernel 5.15+) or ntfs-3g gives write support.");
		if (type === "auto" && !hasOpt("noauto")) add("info", L, "type auto lets mount probe the filesystem. Fine for removable media, but a fixed disk should name its type.");

		// --- spec
		if (e.spec) {
			if (kind === "unknown") add("error", L, `"${e.spec}" is not a recognised device spec. Use UUID=, LABEL=, PARTUUID=, a /dev path, host:/path or //host/share.`);
			if (kind === "kernel-name" && !isSwap) add("warn", L, `${e.spec} is a kernel name. It can change when disks are added, removed or probed in a different order. Use UUID= or PARTUUID= (see blkid).`);
			if (kind === "kernel-name" && isSwap) add("warn", L, `${e.spec} is a kernel name. Use UUID= for swap too.`);
			if (kind === "uuid") {
				const v = e.spec.slice(5).replace(/^"|"$/g, "");
				if (!UUID_RE.test(v) && !FAT_UUID_RE.test(v) && !NTFS_UUID_RE.test(v)) add("error", L, `UUID "${v}" is not a valid UUID, FAT serial (XXXX-XXXX) or NTFS serial (16 hex digits).`);
				if (type === "vfat" && UUID_RE.test(v)) add("warn", L, "A vfat filesystem has an XXXX-XXXX serial, not a full UUID.");
				if (/^UUID=/.test(e.spec) === false) add("info", L, "Write UUID in capitals as UUID=.");
			}
			if (kind === "label" && /\s/.test(e.spec)) add("error", L, "A label with spaces cannot be written in fstab. Use UUID=.");
			if (isPseudo && !["pseudo", "path"].includes(kind) && kind !== "unknown") add("info", L, `${type} usually uses its own name (${type}) as the device field.`);
			if (isNet && !["nfs", "smb", "pseudo", "path"].includes(kind) && !/^fuse/.test(type)) add("warn", L, `${type} needs a network source like host:/export or //host/share.`);
			if ((type === "nfs" || type === "nfs4") && kind !== "nfs") add("error", L, `${type} needs host:/path as its source.`);
			if ((type === "cifs" || type === "smb3") && kind !== "smb") add("error", L, `${type} needs //host/share as its source.`);
			if (DISK_FS.has(type) && !isSwap && ["nfs", "smb"].includes(kind)) add("error", L, `A network source with type ${type}. Use nfs or cifs.`);
			const prev = specs.get(e.spec);
			if (prev && !isSwap && !(type === "btrfs" && opts.some((o) => o.startsWith("subvol"))) && !isPseudo && !["none", "bind"].includes(type)) add("warn", L, `${e.spec} is also used on line ${prev.line}. Two mounts of the same device need subvolumes or a bind mount.`);
			specs.set(e.spec, specs.get(e.spec) || e);
		}

		// --- mount point
		if (e.mountRaw !== undefined) {
			if (isSwap) { if (e.mountRaw !== "none" && e.mountRaw !== "swap") add("error", L, 'A swap entry uses "none" as its mount point.'); }
			else if (!e.mount.startsWith("/")) add("error", L, `Mount point "${e.mountRaw}" must be an absolute path.`);
			else {
				if (e.mount.length > 1 && e.mount.endsWith("/")) add("info", L, "No trailing slash needed on the mount point.");
				if (mounts.has(e.mount) && !hasOpt("bind")) add("error", L, `${e.mount} is already mounted on line ${mounts.get(e.mount)}. The later entry hides the earlier one.`);
				mounts.set(e.mount, mounts.get(e.mount) ?? L);
			}
			if (e.mount === "/") rootEntry = e;
		}

		// --- options
		if (f.length >= 4) {
			if (!e.options) add("warn", L, "The options field is empty. Write defaults.");
			if (/\s/.test(e.options || "")) add("error", L, "Options must not contain spaces.");
			if (/,,|^,|,$/.test(e.options || "")) add("error", L, "Empty option in the list (check the commas).");
			const seenOpt = new Set();
			for (const o of opts) {
				if (seenOpt.has(o)) add("warn", L, `Option "${o}" is listed twice.`);
				seenOpt.add(o);
				if (!isKnownOption(o)) add("warn", L, `Unknown option "${o}". If it is a typo, mount fails and the system may drop to emergency mode at boot.`);
			}
			const conflict = (a, b, msg) => { if (hasOpt(a) && hasOpt(b)) add("error", L, msg || `"${a}" and "${b}" contradict each other.`); };
			conflict("ro", "rw"); conflict("sync", "async"); conflict("exec", "noexec"); conflict("suid", "nosuid"); conflict("dev", "nodev"); conflict("auto", "noauto"); conflict("atime", "noatime");
			conflict("relatime", "noatime", '"relatime" and "noatime" overlap: noatime already stops access-time updates.');
			if (hasOpt("defaults") && opts.length > 1 && opts.indexOf("defaults") > 0) add("info", L, "defaults resets earlier options; put it first.");
			if (hasOpt("discard") && optVal("discard")) add("info", L, "discard=async is a btrfs option. Other filesystems take plain discard.");
			if (hasOpt("discard") && !isSwap) add("info", L, "Continuous discard can slow some SSDs. A weekly fstrim.timer is the usual recommendation.");
			if (hasOpt("nofail") && hasOpt("noauto")) add("info", L, "noauto already keeps this out of boot; nofail adds nothing unless x-systemd.automount is used.");
			if ((hasOpt("user") || hasOpt("users")) && hasOpt("exec") && !hasOpt("noexec")) add("info", L, "user implies noexec; the later exec turns it back on for a mount any user can trigger.");

			// filesystem specific
			if (opts.some((o) => o.startsWith("subvol=") || o.startsWith("subvolid=")) && type !== "btrfs") add("error", L, "subvol= and subvolid= only apply to btrfs.");
			if (opts.some((o) => o.startsWith("compress")) && type !== "btrfs") add("error", L, `compress= is a btrfs option, not valid for ${type || "this type"}.`);
			if (hasOpt("nodatacow") && opts.some((o) => o.startsWith("compress"))) add("error", L, "nodatacow disables compression: do not combine with compress.");
			if (hasOpt("nodatacow")) add("info", L, "nodatacow also disables checksums and compression for new files. It is mostly used on VM images and databases.");
			if (opts.some((o) => /^(uid|gid|umask|fmask|dmask)=/.test(o)) && !UNIX_PERM_LESS.has(type) && type !== "tmpfs") add("warn", L, `uid, gid and the masks only apply to filesystems without Unix permissions (vfat, exfat, ntfs...). ${type} stores its own.`);
			if (opts.some((o) => o.startsWith("size=")) && !["tmpfs", "ramfs", "hugetlbfs"].includes(type)) add("warn", L, "size= applies to tmpfs.");
			if (type === "tmpfs" && !opts.some((o) => o.startsWith("size="))) add("warn", L, "tmpfs without size= can grow to half of RAM. Set size=.");
			if (type === "ext4" && !optVal("errors") && e.mount === "/") add("info", L, "Root on ext4 commonly adds errors=remount-ro.");
			if ((type === "vfat" || type === "exfat") && !opts.some((o) => /^(umask|fmask|dmask)=/.test(o))) add("warn", L, `${type} without umask or fmask/dmask makes every file world-accessible (default is open).`);
			if (e.mount && /^\/boot\/efi$|^\/efi$|^\/boot$/.test(e.mount) && type === "vfat" && !opts.some((o) => /^(umask|fmask)=/.test(o))) add("warn", L, "The EFI system partition should be private to root: umask=0077.");
			if (type === "vfat" && e.mount === "/boot/efi") { /* ok */ }
			if (e.mount === "/boot/efi" && type && type !== "vfat") add("error", L, "The EFI system partition must be FAT32 (vfat).");
			if (type === "nfs" || type === "nfs4") {
				if (!hasOpt("_netdev") && !opts.some((o) => o.startsWith("x-systemd.automount"))) add("warn", L, "NFS needs _netdev so boot waits for the network (systemd adds it automatically only for known network types).");
				if (hasOpt("soft") && !hasOpt("hard")) add("warn", L, "soft NFS mounts return errors on a timeout, which can silently corrupt writes. Prefer hard.");
				if (!hasOpt("nofail") && !hasOpt("noauto") && !opts.some((o) => o.startsWith("x-systemd.automount"))) add("warn", L, "If the server is down at boot, the machine waits and may drop to emergency mode. Add nofail, or noauto,x-systemd.automount.");
			}
			if (type === "cifs" || type === "smb3") {
				if (opts.some((o) => o.startsWith("password="))) add("error", L, "password= in fstab is readable by every user. Use credentials=/root/.smbcred with mode 600.");
				if (!hasOpt("_netdev") && !opts.some((o) => o.startsWith("x-systemd.automount"))) add("warn", L, "Network mount without _netdev.");
				if (!opts.some((o) => o.startsWith("credentials=")) && !hasOpt("guest")) add("info", L, "No credentials= file or guest option.");
			}
			if (isSwap) {
				if (hasOpt("noauto")) add("info", L, "noauto swap is not enabled by swapon -a at boot.");
				if (opts.some((o) => /^(ro|noexec|nosuid|nodev|noatime)$/.test(o))) add("info", L, "Mount options other than defaults, sw and pri= do nothing for swap.");
			}
			// security hardening hints for well-known mounts
			const sec = (mnt, want, why) => { if (e.mount === mnt) { const miss = want.filter((w) => !hasOpt(w)); if (miss.length) add("info", L, `${mnt}: consider ${miss.join(",")}. ${why}`); } };
			if (!isSwap) {
				sec("/tmp", ["nodev", "nosuid"], "/tmp should not hold devices or setuid programs. noexec is a further step but breaks some installers.");
				sec("/dev/shm", ["nodev", "nosuid", "noexec"], "Shared memory is a common place to stage malware.");
				sec("/var/tmp", ["nodev", "nosuid"], "Same reasoning as /tmp.");
				sec("/home", ["nodev", "nosuid"], "User directories should not carry devices or setuid files.");
				sec("/boot", ["nodev", "nosuid"], "Boot files do not need devices or setuid binaries.");
				if (e.mount === "/proc" && !opts.some((o) => o.startsWith("hidepid="))) add("info", L, "/proc: hidepid=2 hides other users' processes.");
			}
		}

		// --- dump / pass
		const dump = e.dump === undefined ? 0 : Number(e.dump);
		const pass = e.pass === undefined ? 0 : Number(e.pass);
		if (e.dump !== undefined && !/^\d+$/.test(e.dump)) add("error", L, `dump must be 0 or 1 (got "${e.dump}").`);
		else if (dump > 1) add("warn", L, "dump is almost always 0 (the dump tool is rarely used).");
		if (e.pass !== undefined && !/^\d+$/.test(e.pass)) add("error", L, `pass must be 0, 1 or 2 (got "${e.pass}").`);
		else if (pass > 2) add("error", L, "pass must be 0, 1 or 2.");
		else {
			if (pass === 1) pass1.push(e);
			if (e.mount === "/" && FSCK_FS.has(type) && pass !== 1) add("warn", L, "The root filesystem on a journaled fsck filesystem normally has pass 1.");
			if (e.mount === "/" && !FSCK_FS.has(type) && pass > 0 && type) add("warn", L, `${type} has no fsck at boot (it checks itself or uses its own tools). Use pass 0.`);
			if (e.mount !== "/" && pass === 1) add("warn", L, "Only the root filesystem should have pass 1. Others use 2.");
			if (pass > 0 && (isSwap || isPseudo || isNet || ["btrfs", "xfs", "vfat", "exfat", "ntfs", "ntfs3", "f2fs", "bcachefs", "zfs"].includes(type))) add("warn", L, `${type} is not checked by fsck at boot: pass should be 0.`);
			if (pass === 0 && FSCK_FS.has(type) && e.mount && e.mount !== "/") add("info", L, `${type} with pass 0 is never checked at boot. Use 2 if you want automatic fsck.`);
			if (e.dump === undefined || e.pass === undefined) add("info", L, "dump and pass are optional and default to 0, but writing both makes the file clearer.");
		}
	}

	if (!rootEntry) add("warn", 0, 'No entry mounts "/". That is fine on systems using systemd-gpt-auto-generator or a kernel root= option, but the usual setup lists the root filesystem.');
	if (pass1.length > 1) add("warn", pass1[1].line, "More than one entry has pass 1. Only the root filesystem should.");

	// ordering: a mount point listed before one of its parents
	const seenMounts = [];
	for (const e of entries) {
		if (!e.mount || !e.mount.startsWith("/") || e.type === "swap") continue;
		const parent = [...mounts.keys()].filter((m) => m !== e.mount && m !== "/" && e.mount.startsWith(m + "/"));
		for (const p of parent) {
			const pl = mounts.get(p);
			if (pl > e.line) add("info", e.line, `${e.mount} is listed before its parent ${p} (line ${pl}). systemd orders mounts itself, but classic mount -a processes lines top to bottom and would mount this over the root first.`);
		}
		seenMounts.push(e.mount);
	}
	return out.sort((a, b) => a.line - b.line || ({ error: 0, warn: 1, info: 2 }[a.level] - { error: 0, warn: 1, info: 2 }[b.level]));
}

/** Describes one entry in plain words. */
export function explainEntry(e) {
	const kind = kindOfSpec(e.spec || "");
	const src = {
		uuid: "the filesystem with that UUID",
		partuuid: "the partition with that PARTUUID",
		label: "the filesystem labelled " + (e.spec || "").replace(/^LABEL=/i, ""),
		partlabel: "the partition labelled " + (e.spec || "").replace(/^PARTLABEL=/i, ""),
		"kernel-name": `the device ${e.spec} (a kernel name that can change)`,
		"stable-path": `the device ${e.spec}`,
		path: `${e.spec}`,
		nfs: `the NFS export ${e.spec}`,
		smb: `the SMB share ${e.spec}`,
		pseudo: `the ${e.spec} pseudo source`,
		unknown: e.spec,
	}[kind];
	if (e.type === "swap") return `Use ${src} as swap space.`;
	return `Mount ${src} (${e.type || "?"}) at ${e.mount}, ${e.pass && Number(e.pass) > 0 ? `checked by fsck at boot ${Number(e.pass) === 1 ? "first" : "after root"}` : "not checked by fsck at boot"}.`;
}

/** Re-prints entries as aligned columns, keeping comments out (they are not parsed). */
export function formatFstab(text) {
	const lines = String(text).split(/\r?\n/);
	const rows = lines.map((l) => {
		const t = l.trim();
		if (!t || t.startsWith("#")) return { keep: l };
		const f = t.split(/\s+/);
		if (f.length < 3 || f.length > 6) return { keep: l };
		while (f.length < 6) f.push(f.length === 3 ? "defaults" : "0");
		return { f };
	});
	const w = [0, 1, 2, 3].map((c) => Math.max(0, ...rows.filter((r) => r.f).map((r) => r.f[c].length)));
	return rows.map((r) => (r.f ? `${r.f[0].padEnd(w[0])}  ${r.f[1].padEnd(w[1])}  ${r.f[2].padEnd(w[2])}  ${r.f[3].padEnd(w[3])}  ${r.f[4]}  ${r.f[5]}` : r.keep)).join("\n");
}

export const SAMPLE_FSTAB = `# <file system>                              <mount point>  <type>  <options>                          <dump> <pass>
UUID=5f2b9c1e-3a47-4d88-9d0a-2f6c1b7e9a10   /              ext4    defaults,noatime                   0      1
/dev/sda2                                   /home          ext4    defaults,discard                   0      2
UUID=ABCD-1234                              /boot/efi      vfat    defaults                           0      2
/dev/sdb1                                   /data          btrfs   subvol=@data,compress=zstd,rw,ro   0      1
tmpfs                                       /tmp           tmpfs   defaults                           0      0
server:/export/share                        /mnt/nas       nfs     defaults,soft                      0      0
//nas/media                                 /mnt/media     cifs    password=hunter2,uid=1000          0      0
UUID=0d3e1c11-7a9f-4a7c-b1d4-5e9a0e2f6b33   none           swap    sw,noauto                          0      0
`;
