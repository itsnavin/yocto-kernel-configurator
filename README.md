# Pi Kernel Lab

A static, beginner-friendly **Raspberry Pi 5 Yocto kernel fragment configurator**.
Choose Keep default, built-in `y`, module `m` (tristates only), or disabled `n`
for 12 curated features, with source links, dependencies and risks.

**Live app:** <https://itsnavin.github.io/yocto-kernel-configurator/>

No backend, runtime dependencies, analytics, remote scripts, board detection,
automatic flashing or JavaScript Kconfig solver. Files selected for comparison
stay in your browser. Nothing is uploaded or stored.

## Exact supported context

This uses the same release reference as
[yocto-rpi-builder](https://itsnavin.github.io/yocto-rpi-builder/), with an
important correction: the originally described Poky SHA is an **annotated tag
object**, not a commit. Check out its resolved commit below.

| Input | Verified pin |
| --- | --- |
| Yocto / Poky | 5.0.13, Scarthgap, tag `yocto-5.0.13` |
| Annotated tag object | `529843b1c189ab7b133b7fdf197d4b2a4b71a6db` |
| Resolved Poky commit | `f16cffd030d21d12dd57bb95cfc310bda41f8a1f` |
| meta-raspberrypi commit | `018d44467c4f09eb63f8ea5e86e85d755250cf89` |
| MACHINE / boot | `raspberrypi5`, 64-bit, direct firmware, `RPI_USE_U_BOOT = "0"` |
| Default kernel provider | `linux-raspberrypi`, preference `6.6.%` |
| Recipe / downstream version | `linux-raspberrypi_6.6.bb`, `LINUX_VERSION = "6.6.63"` |
| Source branch / revision | `rpi-6.6.y`, `e442e5c1ab6bff5b5460b4fc949beb72aaf77970` |
| Kernel-cache branch / revision | `yocto-6.6`, `52ff0d75713ce61962b325a2090bd55e216f0cf3` |
| Baseline / mode | `arch/arm64/configs/bcm2712_defconfig`, `--alldefconfig` |

Source inspection: **2026-10-19 UTC**. Scarthgap is a Yocto release, **not**
a kernel version. The BSP also contains 6.1 and 6.12 recipes; this app does not
support them. This is Raspberry Pi's downstream tree (including Pi-specific
changes), not vanilla Linux, Raspberry Pi OS, Ubuntu's installed kernel or the
`linux-yocto` provider. Yocto kernel-cache features and BSP `.cfg` inputs further
affect the result. No additional `.patch` URIs were found in the pinned default
6.6 recipe/include; other layers may introduce patches or override pins.
An old reproducible snapshot is not a guarantee of current security fixes.

## What it generates

Download individual preview files or a deterministic USTAR archive:

```text
meta-custom/
  conf/layer.conf
  recipes-kernel/linux/linux-raspberrypi_6.6.bbappend
  recipes-kernel/linux/files/pi5-custom.cfg
integration.txt
compare-config.py
```

The append uses `FILESEXTRAPATHS:prepend := "${THISDIR}/files:"` and
`SRC_URI:append:raspberrypi5 = " file://pi5-custom.cfg"`.
The recipe filename is `_6.6.bbappend`, **not** `_6.6.63.bbappend`.
`LAYERSERIES_COMPAT_custom = "scarthgap"` and dependencies on `core raspberrypi`
are declared. Merge with an existing `meta-custom` layer rather than overwriting
it; collection names must remain unique.

**Fragment support is verified, not assumed:** `linux-raspberrypi.inc` requires
Poky's `linux-yocto.inc`, which inherits `kernel-yocto`. That class discovers
`.cfg` inputs from `SRC_URI` and defines `kernel_configme` / `kernel_configcheck`.
This does not mean any arbitrary kernel recipe consumes fragments.

Keep default emits **no assignment** for that symbol. Disabled emits
`# CONFIG_X is not set`. A requested module automatically adds `CONFIG_MODULES=y`;
no other parents are silently changed. A boolean cannot be set to `m`.
The archive button requires at least one explicit choice.

Curated groups cover Broadcom Wi-Fi/SDIO and Bluetooth UART/protocol, I2C/SPI
userspace interfaces, CP210x/FTDI USB serial, USB audio, FUSE, NTFS3 and debugfs.
Essential RP1, PCIe, clocks, pinctrl, storage, ext4 rootfs, USB host and PL011
console controls are intentionally excluded. Optional features can still be
essential to your own image or management connection.

## Integration and mandatory validation

The app's **Learn & integrate** section and exported `integration.txt` provide
the full Linux-host workflow, pinned checkout references, layer registration,
module/image guidance and recovery cautions. Read them before running commands.
This app runs on Windows, but BitBake needs a supported Linux build host.

1. Start with the working pinned Pi 5 image setup and recovery media. Add or
   merge `meta-custom`, register it in `BBLAYERS` via `bitbake-layers add-layer`,
   and keep `MACHINE = "raspberrypi5"`.
2. Inspect `bitbake-layers show-recipes linux-raspberrypi`, `show-appends`,
   `bitbake -e virtual/kernel` and `bitbake -c listtasks virtual/kernel`.
   Confirm provider, version, both source revisions, branch, baseline and
   fragment URI. **Stop on a scope mismatch.**
3. Only when listed, run `bitbake -c kernel_configme -f virtual/kernel` and
   `bitbake -c kernel_configcheck -f virtual/kernel`. Inspect warnings/logs.
   Read the expanded `B` path from `bitbake -e`; compare its final `.config`
   with the generated fragment using `compare-config.py` or the app.
4. Inspect `menuconfig`/`diffconfig` only if those tasks are available. Persist
   reviewed changes in the layer; re-normalize and compare. A full `.config`
   or defconfig is **not** a small fragment.
5. Build `virtual/kernel` and your actual image recipe. Check the image
   manifest for module packages. `kernel-modules` can deliberately include all
   modules for a learning image; specific packages are preferable for production.
   BSP recommendations can be excluded by image policy.
6. Inspect `tmp/deploy/images/raspberrypi5/` for your image, kernel, DTBs,
   overlays and manifests. Deploy a coherent set, not an isolated kernel with
   mismatched modules. Preserve separate bootable recovery media. No flashing
   commands or guessed storage device paths are provided.

Kconfig can drop a request, cap `y` to `m`, or re-enable `n` through `select`,
dependencies and other inputs. **An absent symbol is not accepted as disabled**:
it could be unknown/invisible. Both comparators flag that as a mismatch.
The browser's 5 MiB text-only `.config` comparison is a value check, not pin,
source, image or hardware verification. Uploaded data is not a trusted baseline
for dependency solving.

Modules being compiled, packaged and loaded are separate concerns. Firmware
and licensing, regulatory data, userspace tools, device-tree overlays and
firmware `config.txt` bus settings are separate too. CONFIG alone enables none
of these. Do not disable Wi-Fi without another management/recovery connection.

## Local preview and tests

Use Node.js 22+; no npm install is needed for the site or Node tests.

```sh
npm test
npm run build
npm start
```

Open <http://127.0.0.1:4173/>. `build` copies only static assets to `dist`.
All assets use relative URLs for GitHub Pages project subpaths. Use HTTP, not
`file://`. Preview server binds to loopback only; stop it with Ctrl+C.
Clipboard needs localhost or HTTPS; failure displays manual-copy guidance.

Browser checks use development-only Python Playwright:

```sh
python -m pip install playwright==1.64.0
python -m playwright install chromium
# With the preview server running:
python tests/browser.py
# PowerShell can set $env:SITE_URL for the live app; Bash:
SITE_URL=https://itsnavin.github.io/yocto-kernel-configurator/ python tests/browser.py
```

For Linux CI, use `python -m playwright install --with-deps chromium`.
The suite exercises desktop (1440 px) and mobile (390 px), actual clipboard,
individual/USTAR downloads and extraction, bool restrictions, warnings, filters,
reset, keyboard skip link, uploaded config errors/matches/stale results,
JavaScript errors and horizontal overflow.

Run `npm run verify:sources` for network-based checks of every symbol/type and
the pinned provider, default recipe, source version, baseline and fragment class.
It fetches immutable upstream text; failure is explicit, not skipped.

### Real source Kconfig smoke

On a Linux host with `gcc`, `bison`, `flex`, `m4`, Python 3, Node 22 and normal
C development headers, fetch the exact kernel source and build only its host
configuration frontend:

```sh
curl --fail --location https://codeload.github.com/raspberrypi/linux/tar.gz/e442e5c1ab6bff5b5460b4fc949beb72aaf77970 -o linux.tar.gz
tar -xzf linux.tar.gz
node scripts/kconfig-fixtures.js
bash tests/build-conf.sh "$PWD/linux-e442e5c1ab6bff5b5460b4fc949beb72aaf77970" "$PWD/test-results/conf-build"
python3 tests/kconfig.py "$PWD/linux-e442e5c1ab6bff5b5460b4fc949beb72aaf77970" "$PWD/test-results/conf-build/conf"
```

Prefer downloading/extracting source outside this repository; adapt the paths.
The optional **Verify pinned upstream source** workflow reproduces this check.
Fixtures are generated from the actual app generator and cover all 12 controls,
Keep/y/m/n, module support, disappeared dependency children and a built-in child
capped by its modular USB_SERIAL parent. The generated comparison script is
also executed against normalized output and must flag intentional mismatches.

**Executed validation:** 9 Node unit/static tests; 2 desktop/mobile browser
scenarios; upstream source verification; 8 native `conf` smoke fixtures against
the pinned arm64 Kconfig and bcm2712_defconfig on WSL Ubuntu 24.04.
The native frontend used host GCC for compiler feature probes; it did **not**
cross-compile a kernel or reproduce Yocto's target toolchain, kernel-cache
features, BSP fragments or other layers. No full BitBake task execution,
image boot, Wi-Fi/Bluetooth runtime or physical Pi 5 hardware test is claimed.

## Publish

`.github/workflows/pages.yml` tests, builds and publishes `dist/` on pushes to
`main`; pull requests test without deploying. It uses GitHub Pages artifact
deployment with least job-scoped `pages:write` and `id-token:write` permissions.
In repository **Settings → Pages**, choose **GitHub Actions** as source.
No hosting credentials or third-party service is needed. Repository or
environment policies may require owner approval.

The production URL is <https://itsnavin.github.io/yocto-kernel-configurator/>.
After deployment, verify HTML, CSS and module URLs and run browser tests with
`SITE_URL` set to the live subpath. No service worker or browser persistence is
used, so stale selections cannot silently reappear.

## Authoritative provenance

- [Pinned BSP machine](https://github.com/agherzan/meta-raspberrypi/blob/018d44467c4f09eb63f8ea5e86e85d755250cf89/conf/machine/raspberrypi5.conf)
- [Default provider](https://github.com/agherzan/meta-raspberrypi/blob/018d44467c4f09eb63f8ea5e86e85d755250cf89/conf/machine/include/rpi-default-providers.inc) and [default version](https://github.com/agherzan/meta-raspberrypi/blob/018d44467c4f09eb63f8ea5e86e85d755250cf89/conf/machine/include/rpi-default-versions.inc)
- [6.6 recipe](https://github.com/agherzan/meta-raspberrypi/blob/018d44467c4f09eb63f8ea5e86e85d755250cf89/recipes-kernel/linux/linux-raspberrypi_6.6.bb) and [shared include](https://github.com/agherzan/meta-raspberrypi/blob/018d44467c4f09eb63f8ea5e86e85d755250cf89/recipes-kernel/linux/linux-raspberrypi.inc)
- [Poky tag object and resolved commit](https://api.github.com/repos/yoctoproject/poky/git/tags/529843b1c189ab7b133b7fdf197d4b2a4b71a6db)
- [Poky linux-yocto include](https://github.com/yoctoproject/poky/blob/f16cffd030d21d12dd57bb95cfc310bda41f8a1f/meta/recipes-kernel/linux/linux-yocto.inc) and [kernel-yocto class](https://github.com/yoctoproject/poky/blob/f16cffd030d21d12dd57bb95cfc310bda41f8a1f/meta/classes-recipe/kernel-yocto.bbclass)
- [Pinned Pi source](https://github.com/raspberrypi/linux/tree/e442e5c1ab6bff5b5460b4fc949beb72aaf77970); each catalog entry in `src/catalog.js` links its defining Kconfig file
- [Yocto 5.0.13 kernel development](https://docs.yoctoproject.org/5.0.13/kernel-dev/common.html), [tasks](https://docs.yoctoproject.org/5.0.13/ref-manual/tasks.html), [host requirements](https://docs.yoctoproject.org/5.0.13/ref-manual/system-requirements.html)
- [Raspberry Pi configuration / overlays](https://www.raspberrypi.com/documentation/computers/configuration.html)

MIT licensed. Independent educational project; not affiliated with Raspberry Pi
or the Yocto Project. Kernel source remains under its upstream licenses and is
not bundled with this app.
