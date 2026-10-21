// Arch Linux install script generator and fstab builder. Pure functions, no DOM.
// The generated script is destructive by design (it partitions a disk) and asks the operator to retype the disk path.
// Every value that reaches the script is checked against a strict allowlist and single-quoted, so nothing is interpreted by the shell.

export const DEFAULTS = {
	disk: "/dev/nvme0n1",
	boot: "uefi",
	fs: "btrfs",
	espSize: "1G",
	luks: false,
	swap: "zram",
	swapSize: "8G",
	bootloader: "systemd-boot",
	kernel: "linux",
	microcode: "amd",
	hostname: "archbox",
	timezone: "Asia/Kolkata",
	locale: "en_US.UTF-8",
	keymap: "us",
	username: "user",
	network: "networkmanager",
	extraPackages: "vim git",
	mount: { noatime: true, compress: "zstd:3", discard: "async", ssd: true },
	subvolumes: [
		{ name: "@", mount: "/" },
		{ name: "@home", mount: "/home" },
		{ name: "@log", mount: "/var/log" },
		{ name: "@pkg", mount: "/var/cache/pacman/pkg" },
		{ name: "@snapshots", mount: "/.snapshots" },
	],
};

const RE = {
	disk: /^\/dev\/[A-Za-z0-9/_-]+$/,
	host: /^[a-z0-9][a-z0-9-]{0,62}$/,
	user: /^[a-z_][a-z0-9_-]{0,31}$/,
	tz: /^[A-Za-z0-9_+/-]+$/,
	locale: /^[a-z]{2,3}_[A-Z]{2}\.UTF-8$/,
	keymap: /^[A-Za-z0-9._-]+$/,
	pkg: /^[a-z0-9@._+-]+$/,
	size: /^[1-9][0-9]{0,3}[MGT]$/,
	mountpoint: /^\/[A-Za-z0-9._/-]*$/,
	subvol: /^@[A-Za-z0-9._-]*$/,
};

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** Validate and normalise a config. Returns {cfg, errors, warnings}. */
export function validateConfig(input) {
	const cfg = { ...DEFAULTS, ...input, mount: { ...DEFAULTS.mount, ...(input.mount || {}) } };
	const errors = [];
	const warnings = [];
	const bad = (m) => errors.push(m);
	if (!RE.disk.test(cfg.disk)) bad("Disk must look like /dev/sda or /dev/nvme0n1.");
	if (!["uefi", "bios"].includes(cfg.boot)) bad("Boot mode must be uefi or bios.");
	if (!["ext4", "btrfs", "xfs"].includes(cfg.fs)) bad("Filesystem must be ext4, btrfs or xfs.");
	if (!RE.size.test(cfg.espSize)) bad("Boot partition size must look like 512M or 1G.");
	if (!["none", "zram", "file", "partition"].includes(cfg.swap)) bad("Swap must be none, zram, file or partition.");
	if (["file", "partition"].includes(cfg.swap) && !RE.size.test(cfg.swapSize)) bad("Swap size must look like 8G.");
	if (!["systemd-boot", "grub"].includes(cfg.bootloader)) bad("Bootloader must be systemd-boot or grub.");
	if (cfg.bootloader === "systemd-boot" && cfg.boot === "bios") bad("systemd-boot needs UEFI. Use GRUB for BIOS.");
	if (!["linux", "linux-lts", "linux-zen", "linux-hardened"].includes(cfg.kernel)) bad("Unknown kernel package.");
	if (!["intel", "amd", "none"].includes(cfg.microcode)) bad("Microcode must be intel, amd or none.");
	if (!RE.host.test(cfg.hostname)) bad("Hostname: lowercase letters, digits and hyphens, starting with a letter or digit.");
	if (!RE.user.test(cfg.username)) bad("Username: lowercase letters, digits, - and _, starting with a letter or _.");
	if (!RE.tz.test(cfg.timezone)) bad("Time zone must look like Europe/London.");
	if (!RE.locale.test(cfg.locale)) bad("Locale must look like en_US.UTF-8.");
	if (!RE.keymap.test(cfg.keymap)) bad("Console keymap contains invalid characters.");
	if (!["networkmanager", "systemd-networkd", "none"].includes(cfg.network)) bad("Network must be networkmanager, systemd-networkd or none.");
	const extra = String(cfg.extraPackages || "").split(/\s+/).filter(Boolean);
	for (const p of extra) if (!RE.pkg.test(p)) bad(`Package name "${p}" is not valid.`);
	cfg.extra = extra;
	if (cfg.fs === "btrfs") {
		if (!Array.isArray(cfg.subvolumes) || !cfg.subvolumes.length) bad("Btrfs needs at least the @ root subvolume.");
		else {
			const seen = new Set();
			for (const s of cfg.subvolumes) {
				if (!RE.subvol.test(s.name)) bad(`Subvolume name "${s.name}" must start with @ and use letters, digits . _ -`);
				if (!RE.mountpoint.test(s.mount)) bad(`Mount point "${s.mount}" must be an absolute path.`);
				if (seen.has(s.mount)) bad(`Two subvolumes mount at ${s.mount}.`);
				seen.add(s.mount);
			}
			if (!cfg.subvolumes.some((s) => s.mount === "/")) bad("One subvolume must mount at /.");
		}
		if (cfg.mount.compress && !/^(zstd(:\d{1,2})?|lzo|zlib(:\d)?)$/.test(cfg.mount.compress)) bad("Compression must be zstd, zstd:N, lzo or zlib.");
	}
	if (cfg.mount.discard && !["none", "async", "sync"].includes(cfg.mount.discard)) bad("discard must be none, async or sync.");
	if (cfg.mount.discard === "sync") warnings.push("Continuous discard (sync) can slow writes on some SSDs; most guides prefer a weekly fstrim.timer or discard=async on btrfs.");
	if (cfg.luks && cfg.bootloader === "grub" && cfg.boot === "uefi") warnings.push("With LUKS the kernel and initramfs stay on the unencrypted boot partition, which is expected here.");
	if (cfg.swap === "file" && cfg.fs === "xfs") warnings.push("Swap files on XFS work but cannot be on a reflink-enabled file without care; consider zram or a swap partition.");
	if (cfg.swap === "file" && cfg.fs === "btrfs") warnings.push("The btrfs swap file uses btrfs filesystem mkswapfile (btrfs-progs 6.1 or newer, which current Arch ISOs ship). It lives in its own uncompressed @swap subvolume.");
	if (cfg.swap !== "none" && cfg.swap !== "zram" && cfg.luks) warnings.push("Swap on the encrypted volume is encrypted too. Hibernation needs extra resume= configuration that this script does not add.");
	return { cfg, errors, warnings };
}

// ------------------------------------------------------------------ plan (partition table)

export function partitionPlan(cfg) {
	const parts = [];
	let n = 1;
	if (cfg.boot === "uefi") parts.push({ n: n++, role: "esp", size: cfg.espSize, type: "ef00", label: "ESP", fs: "vfat", mount: "/boot" });
	else {
		parts.push({ n: n++, role: "bios", size: "1M", type: "ef02", label: "BIOSBOOT", fs: "none", mount: "" });
		parts.push({ n: n++, role: "boot", size: cfg.espSize, type: "8300", label: "BOOT", fs: "ext4", mount: "/boot" });
	}
	if (cfg.swap === "partition") parts.push({ n: n++, role: "swap", size: cfg.swapSize, type: "8200", label: "SWAP", fs: "swap", mount: "" });
	parts.push({ n: n++, role: "root", size: "rest", type: cfg.luks ? "8309" : "8304", label: cfg.luks ? "CRYPTROOT" : "ROOT", fs: cfg.luks ? "luks2" : cfg.fs, mount: "/" });
	return parts;
}

function mountOpts(cfg, subvol) {
	const m = cfg.mount;
	const o = [];
	if (m.noatime) o.push("noatime");
	if (cfg.fs === "btrfs") {
		if (m.compress) o.push(`compress=${m.compress}`);
		if (m.ssd) o.push("ssd");
		if (m.discard && m.discard !== "none") o.push(`discard=${m.discard}`);
		o.push("space_cache=v2");
		if (subvol) o.push(`subvol=${subvol}`);
	} else if (cfg.fs === "ext4" || cfg.fs === "xfs") {
		if (m.discard === "sync") o.push("discard");
	}
	return o.length ? o.join(",") : "defaults";
}

// ------------------------------------------------------------------ fstab preview

/** The fstab the script will end up with (genfstab -U writes the real one with real UUIDs). */
export function previewFstab(cfg) {
	const root = cfg.luks ? "/dev/mapper/cryptroot" : "UUID=<root-uuid>";
	const entries = [];
	if (cfg.fs === "btrfs") {
		const rootUuidSpec = cfg.luks ? "UUID=<root-fs-uuid>" : root;
		for (const s of cfg.subvolumes) entries.push({ spec: rootUuidSpec, mount: s.mount, type: "btrfs", options: mountOpts(cfg, s.name), dump: 0, pass: 0 });
	} else entries.push({ spec: cfg.luks ? "UUID=<root-fs-uuid>" : root, mount: "/", type: cfg.fs, options: mountOpts(cfg), dump: 0, pass: cfg.fs === "ext4" ? 1 : 0 });
	const bootSpec = "UUID=<boot-uuid>";
	entries.push({ spec: bootSpec, mount: "/boot", type: cfg.boot === "uefi" ? "vfat" : "ext4", options: cfg.boot === "uefi" ? "rw,relatime,fmask=0022,dmask=0022,codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro" : "defaults,noatime", dump: 0, pass: cfg.boot === "uefi" ? 0 : 2 });
	if (cfg.swap === "partition") entries.push({ spec: "UUID=<swap-uuid>", mount: "none", type: "swap", options: "defaults", dump: 0, pass: 0 });
	if (cfg.swap === "file") entries.push({ spec: cfg.fs === "btrfs" ? "/swap/swapfile" : "/swapfile", mount: "none", type: "swap", options: "defaults", dump: 0, pass: 0 });
	return buildFstab(entries, { header: "Preview only: genfstab -U writes the real file with real UUIDs." });
}

// ------------------------------------------------------------------ script

export function generateInstall(input) {
	const { cfg, errors, warnings } = validateConfig(input);
	if (errors.length) return { ok: false, errors, warnings, files: [] };
	const parts = partitionPlan(cfg);
	const P = (role) => parts.find((p) => p.role === role);
	const L = [];
	const w = (s = "") => L.push(s);

	w("#!/usr/bin/env bash");
	w("# Arch Linux install script generated by the arch-installer tool.");
	w("# Run it from the official Arch ISO as root. It ERASES the whole disk named below.");
	w("# Read it before you run it: nothing here is magic, and you are responsible for the result.");
	w("set -euo pipefail");
	w("");
	w(`DISK=${q(cfg.disk)}`);
	w(`BOOT_MODE=${q(cfg.boot)}`);
	w("");
	w('part() { if [[ "$DISK" == *[0-9] ]]; then echo "${DISK}p$1"; else echo "${DISK}$1"; fi; }');
	w("");
	w('[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }');
	w('[[ -b "$DISK" ]] || { echo "$DISK is not a block device." >&2; exit 1; }');
	if (cfg.boot === "uefi") w('[[ -d /sys/firmware/efi/efivars ]] || { echo "This script is set for UEFI but the system booted in BIOS mode." >&2; exit 1; }');
	w('lsblk -o NAME,SIZE,MODEL,MOUNTPOINTS "$DISK"');
	w('echo');
	w('echo "Everything on $DISK will be destroyed."');
	w('read -r -p "Type the disk path again to continue: " CONFIRM');
	w('[[ "$CONFIRM" == "$DISK" ]] || { echo "Aborted."; exit 1; }');
	w("");
	w("timedatectl set-ntp true");
	w("");
	w("# --- partitioning ---------------------------------------------------");
	w('wipefs --all --force "$DISK"');
	w('sgdisk --zap-all "$DISK"');
	for (const p of parts) {
		const size = p.size === "rest" ? "0" : `+${p.size}`;
		w(`sgdisk -n ${p.n}:0:${size} -t ${p.n}:${p.type} -c ${p.n}:${p.label} "$DISK"`);
	}
	w('partprobe "$DISK"; sleep 1');
	for (const p of parts) w(`PART_${p.role.toUpperCase()}=$(part ${p.n})`);
	w("");
	w("# --- filesystems ----------------------------------------------------");
	if (cfg.boot === "uefi") w('mkfs.fat -F32 -n ESP "$PART_ESP"');
	else w('mkfs.ext4 -F -L BOOT "$PART_BOOT"');
	if (P("swap")) w('mkswap -L SWAP "$PART_SWAP"');
	if (cfg.luks) {
		w("");
		w("echo 'Choose the disk encryption passphrase:'");
		w('cryptsetup luksFormat --type luks2 "$PART_ROOT"');
		w('cryptsetup open "$PART_ROOT" cryptroot');
		w('ROOT_DEV=/dev/mapper/cryptroot');
	} else w('ROOT_DEV="$PART_ROOT"');
	w("");
	if (cfg.fs === "btrfs") {
		w('mkfs.btrfs -f -L arch "$ROOT_DEV"');
		w('mount "$ROOT_DEV" /mnt');
		const subs = [...cfg.subvolumes];
		if (cfg.swap === "file") subs.push({ name: "@swap", mount: "/swap", swap: true });
		for (const s of subs) w(`btrfs subvolume create /mnt/${s.name}`);
		w("umount /mnt");
		const root = subs.find((s) => s.mount === "/");
		w(`mount -o ${mountOpts(cfg, root.name)} "$ROOT_DEV" /mnt`);
		for (const s of subs.filter((x) => x.mount !== "/")) {
			w(`mkdir -p ${q("/mnt" + s.mount)}`);
			w(`mount -o ${s.swap ? "noatime,subvol=@swap" : mountOpts(cfg, s.name)} "$ROOT_DEV" ${q("/mnt" + s.mount)}`);
		}
	} else if (cfg.fs === "ext4") {
		w('mkfs.ext4 -F -L ROOT "$ROOT_DEV"');
		w(`mount -o ${mountOpts(cfg)} "$ROOT_DEV" /mnt`);
	} else {
		w('mkfs.xfs -f -L ROOT "$ROOT_DEV"');
		w(`mount -o ${mountOpts(cfg)} "$ROOT_DEV" /mnt`);
	}
	w("mkdir -p /mnt/boot");
	w(`mount "$PART_${cfg.boot === "uefi" ? "ESP" : "BOOT"}" /mnt/boot${cfg.boot === "uefi" ? " -o umask=0077" : ""}`);
	if (P("swap")) w('swapon "$PART_SWAP"');
	if (cfg.swap === "file") {
		w("");
		if (cfg.fs === "btrfs") w(`btrfs filesystem mkswapfile --size ${cfg.swapSize.toLowerCase()} --uuid clear /mnt/swap/swapfile`);
		else w(`mkswap -U clear --size ${cfg.swapSize} --file /mnt/swapfile`);
		w(`swapon ${cfg.fs === "btrfs" ? "/mnt/swap/swapfile" : "/mnt/swapfile"}`);
	}
	w("");
	w("# --- base system ----------------------------------------------------");
	const pk = ["base", cfg.kernel, "linux-firmware", "sudo", "man-db"];
	if (cfg.microcode !== "none") pk.push(`${cfg.microcode}-ucode`);
	if (cfg.fs === "btrfs") pk.push("btrfs-progs");
	if (cfg.fs === "xfs") pk.push("xfsprogs");
	if (cfg.bootloader === "grub") pk.push("grub", ...(cfg.boot === "uefi" ? ["efibootmgr"] : []));
	if (cfg.network === "networkmanager") pk.push("networkmanager");
	if (cfg.swap === "zram") pk.push("zram-generator");
	pk.push(...cfg.extra);
	w(`pacstrap -K /mnt ${[...new Set(pk)].join(" ")}`);
	w("genfstab -U /mnt >> /mnt/etc/fstab");
	w("");
	w("# --- configuration inside the new system ----------------------------");
	w('ROOT_UUID=$(blkid -s UUID -o value "$PART_ROOT")');
	w("cat > /mnt/root/chroot-setup.sh <<'CHROOT_EOF'");
	w("#!/usr/bin/env bash");
	w("set -euo pipefail");
	w(`ln -sf /usr/share/zoneinfo/${cfg.timezone} /etc/localtime`);
	w("hwclock --systohc");
	w(`sed -i 's/^#${cfg.locale} UTF-8/${cfg.locale} UTF-8/' /etc/locale.gen`);
	w("locale-gen");
	w(`echo 'LANG=${cfg.locale}' > /etc/locale.conf`);
	w(`echo 'KEYMAP=${cfg.keymap}' > /etc/vconsole.conf`);
	w(`echo '${cfg.hostname}' > /etc/hostname`);
	w("cat > /etc/hosts <<'HOSTS'");
	w("127.0.0.1 localhost");
	w("::1       localhost");
	w(`127.0.1.1 ${cfg.hostname}.localdomain ${cfg.hostname}`);
	w("HOSTS");
	if (cfg.luks) {
		w("# unlock the encrypted root before the root filesystem is mounted");
		w("sed -i 's/^HOOKS=.*/HOOKS=(base udev autodetect microcode modconf kms keyboard keymap consolefont block encrypt filesystems fsck)/' /etc/mkinitcpio.conf");
	}
	w("mkinitcpio -P");
	if (cfg.swap === "zram") {
		w("cat > /etc/systemd/zram-generator.conf <<'ZRAM'");
		w("[zram0]");
		w("zram-size = min(ram / 2, 8192)");
		w("compression-algorithm = zstd");
		w("ZRAM");
	}
	const cmdlineParts = [];
	if (cfg.luks) cmdlineParts.push("cryptdevice=UUID=@ROOT_UUID@:cryptroot", "root=/dev/mapper/cryptroot");
	else cmdlineParts.push("root=UUID=@ROOT_UUID@");
	if (cfg.fs === "btrfs") {
		const root = cfg.subvolumes.find((s) => s.mount === "/");
		cmdlineParts.push(`rootflags=subvol=${root.name}`);
	}
	cmdlineParts.push("rw");
	const cmdline = cmdlineParts.join(" ");
	w(`CMDLINE="${cmdline.replace("@ROOT_UUID@", "$ROOT_UUID")}"`);
	if (cfg.bootloader === "systemd-boot") {
		w("bootctl install");
		w("cat > /boot/loader/loader.conf <<'LOADER'");
		w("default arch.conf");
		w("timeout 3");
		w("console-mode max");
		w("editor no");
		w("LOADER");
		w("# microcode is loaded by the mkinitcpio microcode hook, so there is no separate ucode initrd line");
		w("{");
		w("  echo 'title Arch Linux'");
		w(`  echo 'linux /vmlinuz-${cfg.kernel}'`);
		w(`  echo 'initrd /initramfs-${cfg.kernel}.img'`);
		w('  echo "options $CMDLINE"');
		w("} > /boot/loader/entries/arch.conf");
	} else {
		w(`sed -i "s|^GRUB_CMDLINE_LINUX=.*|GRUB_CMDLINE_LINUX=\\"$CMDLINE\\"|" /etc/default/grub`);
		if (cfg.boot === "uefi") w("grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=GRUB");
		else w(`grub-install --target=i386-pc ${q(cfg.disk)}`);
		w("grub-mkconfig -o /boot/grub/grub.cfg");
	}
	w(`useradd -m -G wheel -s /bin/bash ${cfg.username}`);
	w("sed -i 's/^# %wheel ALL=(ALL:ALL) ALL/%wheel ALL=(ALL:ALL) ALL/' /etc/sudoers");
	w("systemctl enable fstrim.timer");
	if (cfg.network === "networkmanager") w("systemctl enable NetworkManager");
	if (cfg.network === "systemd-networkd") {
		w("cat > /etc/systemd/network/20-wired.network <<'NET'");
		w("[Match]");
		w("Name=en*");
		w("[Network]");
		w("DHCP=yes");
		w("NET");
		w("systemctl enable systemd-networkd systemd-resolved");
	}
	w("echo 'Set the root password:'");
	w("passwd");
	w(`echo 'Set the password for ${cfg.username}:'`);
	w(`passwd ${cfg.username}`);
	w("CHROOT_EOF");
	w("");
	w("# The command line needs the real root UUID, so pass it in:");
	w('arch-chroot /mnt env ROOT_UUID="$ROOT_UUID" bash /root/chroot-setup.sh');
	w("rm /mnt/root/chroot-setup.sh");
	w("");
	w("sync");
	w("umount -R /mnt");
	w(`${cfg.luks ? "cryptsetup close cryptroot; " : ""}echo "Done. Remove the install medium and reboot."`);
	const script = L.join("\n") + "\n";

	const notes = [
		"# Install notes",
		"",
		`Disk ${cfg.disk}, ${cfg.boot.toUpperCase()}, ${cfg.fs}${cfg.luks ? " on LUKS2" : ""}, ${cfg.bootloader}, kernel ${cfg.kernel}.`,
		"",
		"## Partition layout",
		...parts.map((p) => `- ${p.n}: ${p.label} ${p.size === "rest" ? "(rest of disk)" : p.size}, type ${p.type}${p.mount ? `, mounted at ${p.mount}` : ""}`),
		"",
		"## Before you run it",
		"1. Boot the official Arch ISO and get online (iwctl for Wi-Fi).",
		"2. Copy install.sh over (curl, scp or a USB stick) and read it.",
		"3. `bash install.sh` and retype the disk path when asked.",
		"",
		...(warnings.length ? ["## Warnings", ...warnings.map((x) => `- ${x}`), ""] : []),
	].join("\n");

	return {
		ok: true,
		errors: [],
		warnings,
		parts,
		files: [
			{ path: "install.sh", content: script },
			{ path: "fstab.preview", content: previewFstab(cfg) },
			{ path: "NOTES.md", content: notes + "\n" },
		],
	};
}

// ------------------------------------------------------------------ fstab builder

export const FS_PRESETS = {
	ext4: { options: "defaults,noatime", pass: 2, note: "Use pass 1 for the root filesystem, 2 for the others." },
	btrfs: { options: "noatime,compress=zstd:3,ssd,discard=async,space_cache=v2", pass: 0, note: "pass 0: btrfs has no fsck at boot. Add subvol=@name for a subvolume." },
	xfs: { options: "defaults,noatime", pass: 0, note: "pass 0: xfs repairs itself at mount time." },
	vfat: { options: "umask=0077", pass: 0, note: "umask=0077 keeps the ESP private to root." },
	swap: { options: "defaults", pass: 0, note: "mount point is none." },
	tmpfs: { options: "size=2G,mode=1777,nosuid,nodev", pass: 0, note: "Memory-backed; contents vanish on reboot." },
	nfs: { options: "_netdev,noauto,x-systemd.automount,x-systemd.idle-timeout=60,nofail", pass: 0, note: "noauto plus x-systemd.automount mounts on first access and avoids boot hangs." },
	cifs: { options: "_netdev,noauto,x-systemd.automount,nofail,credentials=/etc/samba/creds,uid=1000,gid=1000", pass: 0, note: "Keep credentials in a root-only file, never in fstab." },
	ntfs3: { options: "noatime,uid=1000,gid=1000,nofail", pass: 0, note: "Windows data disk; nofail so a missing disk does not block boot." },
	auto: { options: "defaults,nofail", pass: 0, note: "Removable or optional disk." },
};

const SPEC_RE = /^(UUID=[A-Fa-f0-9-]+|PARTUUID=[A-Fa-f0-9-]+|LABEL=\S+|PARTLABEL=\S+|\/dev\/\S+|\/\S+|[A-Za-z0-9._-]+:\/\S*|\/\/[^\s]+|tmpfs|none)$/;

/** @param {{spec:string, mount:string, type:string, options:string, dump?:number, pass?:number, comment?:string}[]} entries */
export function validateFstab(entries) {
	const problems = [];
	const add = (level, line, message) => problems.push({ level, line, message });
	const seen = new Map();
	entries.forEach((e, i) => {
		const line = i + 1;
		if (!e.spec) add("error", line, "Device (spec) is empty.");
		else if (!SPEC_RE.test(e.spec) || /\s/.test(e.spec)) add("error", line, `"${e.spec}" is not a recognised device spec. Use UUID=..., LABEL=..., PARTUUID=... or a path.`);
		if (!e.type) add("error", line, "Filesystem type is empty.");
		if (e.type === "swap") { if (e.mount !== "none") add("error", line, 'A swap entry needs the mount point "none".'); }
		else if (!e.mount || !(e.mount.startsWith("/"))) add("error", line, `Mount point "${e.mount}" must be an absolute path.`);
		if (/\s/.test(e.mount || "") && e.mount !== undefined) add("error", line, "Spaces in a mount point must be written as \\040.");
		if (e.options && /\s/.test(e.options)) add("error", line, "Options must not contain spaces (comma separated).");
		if (e.type !== "swap" && e.mount) {
			if (seen.has(e.mount)) add("error", line, `Mount point ${e.mount} already used on line ${seen.get(e.mount)}.`);
			seen.set(e.mount, line);
		}
		const opts = (e.options || "").split(",").filter(Boolean);
		if (!opts.length) add("warn", line, "No options: write defaults.");
		if (!Number.isInteger(Number(e.pass ?? 0)) || Number(e.pass ?? 0) < 0 || Number(e.pass ?? 0) > 2) add("error", line, "pass must be 0, 1 or 2.");
		if (!Number.isInteger(Number(e.dump ?? 0)) || ![0, 1].includes(Number(e.dump ?? 0))) add("warn", line, "dump is almost always 0.");
		if (e.mount === "/" && Number(e.pass) !== 1 && e.type === "ext4") add("warn", line, "The root filesystem on ext4 normally has pass 1.");
		if (e.mount !== "/" && Number(e.pass) === 1) add("warn", line, "Only the root filesystem should use pass 1.");
		if (["btrfs", "xfs", "vfat", "swap", "tmpfs", "nfs", "cifs"].includes(e.type) && Number(e.pass) > 0) add("warn", line, `${e.type} is not checked by fsck at boot: use pass 0.`);
		if (opts.some((o) => o.startsWith("subvol=")) && e.type !== "btrfs") add("error", line, "subvol= only applies to btrfs.");
		if (opts.some((o) => o.startsWith("compress")) && e.type !== "btrfs") add("warn", line, "compress= is a btrfs option.");
		if (opts.includes("nodatacow") && opts.some((o) => o.startsWith("compress"))) add("error", line, "nodatacow and compress cannot be combined.");
		if (opts.includes("discard") && ["ext4", "xfs", "btrfs"].includes(e.type)) add("warn", line, "Continuous discard can slow some SSDs; a weekly fstrim.timer is the usual recommendation.");
		if ((e.type === "nfs" || e.type === "cifs") && !opts.includes("_netdev")) add("warn", line, "Network filesystems should have _netdev so boot waits for the network.");
		if (e.type === "vfat" && !opts.some((o) => o.startsWith("umask") || o.startsWith("fmask"))) add("warn", line, "vfat without umask/fmask makes every file world-accessible.");
		if (e.type === "tmpfs" && !opts.some((o) => o.startsWith("size="))) add("warn", line, "tmpfs without size= can grow to half of RAM.");
	});
	const btrfsRoots = entries.filter((e) => e.type === "btrfs");
	const compressVals = new Set(btrfsRoots.map((e) => ((e.options || "").split(",").find((o) => o.startsWith("compress")) || "")));
	if (btrfsRoots.length > 1 && compressVals.size > 1) add("warn", 0, "Btrfs subvolumes of one filesystem have different compress= options. Most mount options apply to the whole filesystem and the per-subvolume differences may be ignored.");
	return problems;
}

export function buildFstab(entries, { header = "" } = {}) {
	const rows = entries.map((e) => [e.spec || "", e.mount || "", e.type || "", e.options || "defaults", String(e.dump ?? 0), String(e.pass ?? 0)]);
	const widths = [0, 1, 2, 3].map((c) => Math.max(...rows.map((r) => r[c].length), 4));
	const L = ["# Static information about the filesystems. See fstab(5).", ...(header ? [`# ${header}`] : []), "# <file system> <dir> <type> <options> <dump> <pass>"];
	entries.forEach((e, i) => {
		if (e.comment) L.push(`# ${e.comment}`);
		const r = rows[i];
		L.push(`${r[0].padEnd(widths[0])}  ${r[1].padEnd(widths[1])}  ${r[2].padEnd(widths[2])}  ${r[3].padEnd(widths[3])}  ${r[4]}  ${r[5]}`);
	});
	return L.join("\n") + "\n";
}

/** Plain-English explanation of each option in a list, for the UI. */
export const OPTION_HELP = {
	defaults: "rw, suid, dev, exec, auto, nouser, async",
	noatime: "Do not update access times: fewer writes.",
	relatime: "Update access time only when older than the modify time (kernel default).",
	nofail: "Do not fail the boot if the device is missing.",
	noauto: "Do not mount at boot; mount manually or via automount.",
	discard: "Continuous TRIM; many guides prefer fstrim.timer.",
	"discard=async": "Btrfs asynchronous TRIM, batched in the background.",
	ssd: "Btrfs allocation tweaks for SSDs (usually auto-detected).",
	space_cache: "Btrfs free-space cache; v2 is the modern tree-based version.",
	_netdev: "Network device: wait for the network before mounting.",
	"x-systemd.automount": "Mount on first access via a systemd automount unit.",
	"x-systemd.idle-timeout": "Unmount after this idle time (needs automount).",
	nosuid: "Ignore setuid/setgid bits.",
	nodev: "Do not interpret device files.",
	noexec: "Do not allow executing binaries.",
	ro: "Read-only.",
	rw: "Read-write.",
	umask: "Permission mask applied to all files on filesystems without Unix permissions (vfat).",
	fmask: "Mask for files (vfat).",
	dmask: "Mask for directories (vfat).",
	uid: "Owner user id for files on filesystems without Unix permissions.",
	gid: "Owner group id for files on filesystems without Unix permissions.",
	subvol: "Btrfs: mount this subvolume as the filesystem root.",
	compress: "Btrfs transparent compression (zstd:3 is a common balance).",
	nodatacow: "Btrfs: disable copy-on-write for new files (also disables checksums and compression).",
	size: "tmpfs maximum size.",
	mode: "tmpfs permission bits for the mount point.",
};
export function explainOptions(opts) {
	return String(opts || "").split(",").filter(Boolean).map((o) => {
		const key = o in OPTION_HELP ? o : o.split("=")[0];
		return { option: o, help: OPTION_HELP[o] || OPTION_HELP[key] || "" };
	});
}
