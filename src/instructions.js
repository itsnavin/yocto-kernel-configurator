import { context as c } from './catalog.js';

export const instructions = `PI 5 KERNEL LAB - PINNED SCARTHGAP INTEGRATION

This is a curated fragment, NOT a full .config or defconfig.
Keep default means omitted: it does not force y, n, or the upstream default.
No board detection, dependency solving, build execution or flashing is performed.

REFERENCE (inspect your actual build before using)
Yocto ${c.release}
Poky annotated tag object ${c.pokyTag}
Poky resolved commit ${c.poky}
meta-raspberrypi ${c.bsp}
MACHINE ${c.machine}, direct firmware boot (RPI_USE_U_BOOT = "0")
Default provider ${c.provider}, LINUX_VERSION ${c.version}
PV uses 1:6.6.63+git... (epoch 1); do not expect PV to be just 6.6.63.
Branch ${c.branch}, SRCREV_machine ${c.kernel}
Kernel cache ${c.cacheBranch}, SRCREV_meta ${c.cache}
Baseline arch/arm64/configs/${c.defconfig}, KCONFIG_MODE --alldefconfig.
This is the Raspberry Pi downstream tree, with its Pi-specific changes, plus
Yocto kernel-cache metadata/features and BSP .cfg files. It is not vanilla
Linux 6.6.63, Raspberry Pi OS, or the linux-yocto provider. No additional .patch
URIs occur in the inspected default 6.6 recipe/include; other layers can add them.

0. USE A LINUX YOCTO HOST
Use an existing working yocto-rpi-builder Scarthgap checkout and build directory.
Windows serves this website, not a native BitBake host. See Yocto 5.0.13 supported
host requirements. Do not run these shell commands in Windows PowerShell.
Do not replace your existing conf files or meta-custom/conf/layer.conf: merge
carefully if meta-custom already exists. Keep a known-good image and separate
bootable recovery media. These selections can remove networking or peripherals.

If you need to inspect the reference checkouts (outside your active build):
git clone https://git.yoctoproject.org/poky
git -C poky checkout --detach ${c.poky}
git clone https://github.com/agherzan/meta-raspberrypi.git
git -C meta-raspberrypi checkout --detach ${c.bsp}
The tag object above is not a commit; use the resolved commit for checkout.

1. ADD THE LAYER
Extract pi5-kernel-layer.tar in the directory containing poky/ and
meta-raspberrypi/. It contains meta-custom/, this guide and compare-config.py.
From that directory, initialize your EXISTING build directory:
source poky/oe-init-build-env build
If your layout differs, adapt the paths. From build/:
bitbake-layers add-layer ../meta-raspberrypi
bitbake-layers add-layer ../meta-custom
Skip add-layer for layers already registered. This updates conf/bblayers.conf
(BBLAYERS). Do not add a layer twice. Check conf/local.conf:
MACHINE = "raspberrypi5"
RPI_USE_U_BOOT = "0"
PREFERRED_PROVIDER_virtual/kernel = "linux-raspberrypi"
PREFERRED_VERSION_linux-raspberrypi = "6.6.%"
Do not paste BitBake assignments into Bash. They belong in conf/local.conf.
The supplied append is linux-raspberrypi_6.6.bbappend (recipe filename, NOT
linux-raspberrypi_6.6.63.bbappend). Fragment URI is scoped to raspberrypi5.
There is no linux-yocto append and no replacement defconfig.

2. VERIFY WHAT BITBAKE ACTUALLY SELECTS
bitbake-layers show-layers
bitbake-layers show-recipes linux-raspberrypi
bitbake-layers show-appends
bitbake -e virtual/kernel > kernel-environment.txt
grep -E '^(PN|PV|PE|MACHINE|LINUX_VERSION|LINUX_RPI_BRANCH|SRCREV_machine|SRCREV_meta|KBUILD_DEFCONFIG|KCONFIG_MODE|SRC_URI|S|B)=' kernel-environment.txt
bitbake -c listtasks virtual/kernel
Confirm all pins above and that pi5-custom.cfg and your append appear.
STOP on a different provider, machine, source revision, branch or version.
The BSP also contains 6.1 and 6.12 recipes; they are outside this catalog.
Scarthgap is a Yocto release, not a kernel version. Other metadata/patches can
change the supported symbols; re-audit Kconfig instead of renaming the append.

3. NORMALIZE, INSPECT, COMPARE - MANDATORY
The pinned linux-raspberrypi.inc requires linux-yocto.inc, which inherits
kernel-yocto. That class gathers .cfg from SRC_URI and defines configme/check.
Check listtasks first. Only if present, run:
bitbake -c kernel_configme -f virtual/kernel
bitbake -c kernel_configcheck -f virtual/kernel
Read warnings and task logs; a successful exit alone is not proof of a match.
From kernel-environment.txt, record actual absolute S and B directories.
Copy the final B/.config to a convenient file, e.g. FINAL.config. Do NOT
guess paths or assume B is exported into your ordinary shell. Compare:
python3 ../compare-config.py ../meta-custom/recipes-kernel/linux/files/pi5-custom.cfg FINAL.config
This reports every request, including MODULES=y, and fails on mismatches.
Absent is NOT accepted as disabled: it could be an unknown/invisible symbol.
Use the website's final .config comparison as a browser-only second check.
Requests can be dropped, limited to m by modular parents, or re-enabled by
selects/defaults/other fragments. Inspect Kconfig and resolve the real cause.
The simple website warnings are advisory, never dependency validation.

If listed by listtasks and your Linux host has an interactive terminal:
bitbake -c menuconfig virtual/kernel
bitbake -c diffconfig virtual/kernel
Inspect the reported fragment and persist relevant changes into your layer.
Do not overwrite the fragment with a full .config. Re-run normalization/check
and comparison after edits. Temporary changes in WORKDIR are not durable.
If tasks are missing, stop: this is a scope mismatch, not a reason to invent
tasks or assume arbitrary recipes consume .cfg files.

4. BUILD AND INCLUDE MODULES
bitbake virtual/kernel
For each m choice, ensure its kernel-module-* package enters your image.
For a learning image you may deliberately use this in conf/local.conf:
IMAGE_INSTALL:append = " kernel-modules"
This installs all packaged modules and increases image size. For production,
inspect packages with oe-pkgdata-util list-pkgs and select only needed packages.
BSP MACHINE_EXTRA_RRECOMMENDS already recommends kernel-modules, but image
policy such as NO_RECOMMENDATIONS can exclude recommendations. Verify the
image manifest; compilation is NOT the same as installing or loading a module.
Autoload is separate. If needed, add reviewed KERNEL_MODULE_AUTOLOAD entries
in the kernel append using actual module names, e.g. "i2c-dev", not CONFIG names.
Do not autoload blindly; hardware matching often loads modules automatically.
Firmware (and its licenses), regulatory data, BlueZ/ALSA/FUSE userspace,
device-tree overlays and config.txt bus settings are separate. CONFIG does not
create peripherals, grant permissions or enable buses in firmware.

5. REBUILD YOUR IMAGE AND KEEP RECOVERY
bitbake core-image-minimal
Use your existing image recipe instead if it is not core-image-minimal.
Inspect tmp/deploy/images/raspberrypi5/ for the image .wic.bz2 and .wic.bmap,
kernel Image, bcm2712-rpi-5-b.dtb, overlays and image manifest as applicable.
Use the artifacts/symlinks produced by YOUR build, not guessed filenames.
The direct firmware setup places Image as kernel_2712.img on the boot partition.
Deploy a coherent image with matching kernel, modules, DTBs and firmware.
Back up and identify recovery media before any separate manual flashing.
No flashing command or automatic device selection is provided.
Physical Pi 5 boot, networking, accessories and recovery must be tested on hardware.

LIMITS
Catalog symbol names/types were checked against the exact downstream source.
No JavaScript Kconfig solver, exhaustive kernel menu, runtime board detection,
security-update guarantee, BitBake build success or hardware support claim.
Source Kconfig smoke tests do not reproduce all Yocto kernel-cache features,
BSP fragments, patches, compiler environment or image policy.

SOURCES
https://github.com/agherzan/meta-raspberrypi/tree/${c.bsp}
https://github.com/raspberrypi/linux/tree/${c.kernel}
https://github.com/yoctoproject/poky/tree/${c.poky}
https://docs.yoctoproject.org/5.0.13/kernel-dev/common.html
https://docs.yoctoproject.org/5.0.13/ref-manual/tasks.html
https://docs.yoctoproject.org/5.0.13/ref-manual/system-requirements.html
https://www.raspberrypi.com/documentation/computers/configuration.html
https://itsnavin.github.io/yocto-rpi-builder/
`;
