"""Run actual pinned kernel conf against generated fragment fixtures.

Usage: python3 tests/kconfig.py /path/to/linux /path/to/built/conf
Host compiler feature probes are NOT the Yocto target toolchain.
No kernel source files are modified; outputs use a temporary directory.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]).resolve()
CONF = Path(sys.argv[2]).resolve()
fixtures = json.loads((ROOT / "test-results" / "kconfig-fixtures.json").read_text())
environment = dict(os.environ, srctree=str(SOURCE), ARCH="arm64", SRCARCH="arm64",
                   CC="gcc", LD="ld", HOSTCC="gcc", KERNELVERSION="6.6.63",
                   CC_VERSION_TEXT=subprocess.check_output(["gcc", "--version"], text=True).splitlines()[0])
# Do not import the command-line comparator: use its generated parser only.
namespace = {}
script = (ROOT / "test-results/compare-config.py").read_text()
exec(script.split("if len(sys.argv)")[0], namespace)

for case in fixtures["cases"]:
    with tempfile.TemporaryDirectory(prefix="pi-kconfig-") as directory:
        config = Path(directory) / ".config"
        env = dict(environment, KCONFIG_CONFIG=str(config))
        subprocess.run([str(CONF), "--defconfig=" + str(SOURCE / "arch/arm64/configs/bcm2712_defconfig"),
                        str(SOURCE / "Kconfig")], cwd=directory, env=env, check=True, stdout=subprocess.DEVNULL)
        baseline = config.read_text()
        requested = case["requests"]
        lines = []
        for line in baseline.splitlines():
            key = line.removeprefix("# ").split("=")[0].split(" ")[0].removeprefix("CONFIG_")
            if key not in requested:
                lines.append(line)
        config.write_text("\n".join(lines) + "\n" + case["fragment"])
        subprocess.run([str(CONF), "--olddefconfig", str(SOURCE / "Kconfig")],
                       cwd=directory, env=env, check=True, stdout=subprocess.DEVNULL)
        final = namespace["read"](config)
        for key, expected in case["expected"].items():
            assert final.get(key, "absent") == expected, (case["name"], key, expected, final.get(key))
        if requested:
            fragment = Path(directory) / "fragment.cfg"
            fragment.write_text(case["fragment"])
            result = subprocess.run([sys.executable, str(ROOT / "test-results/compare-config.py"),
                                     str(fragment), str(config)], capture_output=True, text=True)
            matches = all(final.get(key) == value for key, value in requested.items())
            assert result.returncode == (0 if matches else 1), result.stdout + result.stderr
        print("PASS:", case["name"], json.dumps({key: final.get(key, "absent") for key in requested}, sort_keys=True))
print("Native conf smoke passed; no Yocto kernel-cache/BSP fragments, target compilation, BitBake or board validation.")
