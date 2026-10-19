import { catalog, context } from './catalog.js';
import { instructions } from './instructions.js';

export function validate(selection) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) throw new Error('Selections must be a symbol-to-state object.');
  for (const [symbol, value] of Object.entries(selection)) {
    const item = catalog.find(entry => entry.symbol === symbol);
    if (!item) throw new Error(`Unknown symbol: ${symbol}`);
    if (!['keep', 'y', 'n', ...(item.type === 'tristate' ? ['m'] : [])].includes(value)) {
      throw new Error(`Invalid state ${value} for CONFIG_${symbol} (${item.type}).`);
    }
  }
}

export function requests(selection) {
  validate(selection);
  const result = Object.fromEntries(catalog.filter(item => selection[item.symbol] && selection[item.symbol] !== 'keep')
    .map(item => [item.symbol, selection[item.symbol]]));
  if (Object.values(result).includes('m')) result.MODULES = 'y';
  return result;
}

export function fragment(selection) {
  const entries = Object.entries(requests(selection));
  return `# Pi 5 learning fragment - requests, not final configuration
# ${context.provider} ${context.version} / ${context.kernel}
# MACHINE=raspberrypi5; validate against the final BitBake-generated .config
${entries.length ? entries.map(([key, value]) => value === 'n' ? `# CONFIG_${key} is not set` : `CONFIG_${key}=${value}`).join('\n') : '# Keep default: no symbols requested.'}
`;
}

export function diagnostics(selection) {
  validate(selection);
  const notes = [];
  for (const item of catalog) {
    const state = selection[item.symbol];
    if (!state || state === 'keep') continue;
    notes.push(`${item.name}: ${item.risk}`);
    if (state === 'y' || state === 'm') {
      for (const dep of item.prerequisites) {
        if (selection[dep] === 'n') notes.push(`Conflict: CONFIG_${item.symbol}=${state} requests a disabled CONFIG_${dep}. Kconfig will decide the result.`);
        else if (item.type === 'tristate' && state === 'y' && selection[dep] === 'm' && catalog.find(i => i.symbol === dep)?.type === 'tristate') {
          notes.push(`Dependency limit: CONFIG_${item.symbol}=y has modular CONFIG_${dep}; the built-in request may not survive.`);
        }
      }
      notes.push(`CONFIG_${item.symbol}: verify prerequisites in menuconfig: ${item.dependencies}`);
    }
  }
  if (Object.values(requests(selection)).includes('m')) {
    notes.unshift('CONFIG_MODULES=y is added because you requested modules. Compilation, module packaging and autoload are separate steps.');
  }
  if (!notes.length) notes.push('Keep default emits no symbol assignments. Existing BSP defaults, fragments and other layers remain in effect.');
  return notes;
}

export function parseConfig(text) {
  if (typeof text !== 'string' || text.length > 5 * 1024 * 1024) throw new Error('Use a text .config smaller than 5 MiB.');
  const result = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const unset = /^# CONFIG_([A-Z0-9_]+) is not set$/.exec(line);
    const set = /^CONFIG_([A-Z0-9_]+)=(y|m|n|[0-9]+|0x[0-9a-fA-F]+|"(?:[^"\\]|\\.)*")$/.exec(line);
    const key = unset?.[1] || set?.[1];
    if (key) {
      if (Object.hasOwn(result, key)) throw new Error(`Duplicate CONFIG_${key}; upload a normalized full .config.`);
      result[key] = unset ? 'n' : set[2];
    } else if (line && !line.startsWith('#')) {
      throw new Error('Invalid .config line. Upload the final plain-text kernel .config, not a recipe or binary.');
    }
  }
  if (!Object.keys(result).length) throw new Error('No CONFIG symbols found in this file.');
  return result;
}

export function compare(selection, config) {
  return Object.entries(requests(selection)).map(([symbol, wanted]) => ({
    symbol, wanted, actual: config[symbol] ?? 'absent',
    matches: config[symbol] === wanted
  }));
}

export function files(selection) {
  validate(selection);
  return {
    'meta-custom/conf/layer.conf': `BBPATH .= ":\${LAYERDIR}"
BBFILES += "\${LAYERDIR}/recipes-*/*/*.bb \${LAYERDIR}/recipes-*/*/*.bbappend"
BBFILE_COLLECTIONS += "custom"
BBFILE_PATTERN_custom = "^\${LAYERDIR}/"
BBFILE_PRIORITY_custom = "10"
LAYERSERIES_COMPAT_custom = "scarthgap"
LAYERDEPENDS_custom = "core raspberrypi"
`,
    'meta-custom/recipes-kernel/linux/linux-raspberrypi_6.6.bbappend': `# Scoped to the verified provider, recipe series and machine.
FILESEXTRAPATHS:prepend := "\${THISDIR}/files:"
SRC_URI:append:raspberrypi5 = " file://pi5-custom.cfg"
`,
    'meta-custom/recipes-kernel/linux/files/pi5-custom.cfg': fragment(selection),
    'integration.txt': instructions,
    'compare-config.py': compareScript
  };
}

export const compareScript = `#!/usr/bin/env python3
"""Compare fragment requests with the final normalized .config, including absent n."""
import re
import sys
from pathlib import Path

def read(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        match = re.fullmatch(r"CONFIG_([A-Z0-9_]+)=(y|m|n)", line)
        unset = re.fullmatch(r"# CONFIG_([A-Z0-9_]+) is not set", line)
        if match or unset:
            key = (match or unset)[1]
            if key in values:
                raise ValueError("Duplicate CONFIG_" + key)
            values[key] = match[2] if match else "n"
    if not values:
        raise ValueError("No tristate/bool CONFIG values in " + str(path))
    return values

if len(sys.argv) != 3:
    sys.exit("Usage: python3 compare-config.py fragment.cfg FINAL.config")
requested, final = read(sys.argv[1]), read(sys.argv[2])
failed = False
for symbol, wanted in requested.items():
    actual = final.get(symbol, "absent")
    print(f"CONFIG_{symbol}: requested {wanted}, final {actual}")
    failed |= actual != wanted
sys.exit(1 if failed else 0)
`;

// Deterministic USTAR for small UTF-8 text files with fixed, short ASCII paths.
export function archive(entries) {
  const encoder = new TextEncoder();
  const blocks = [];
  function field(header, offset, size, text) {
    const data = encoder.encode(text);
    if (data.length > size) throw new Error('Archive field exceeds supported size.');
    header.set(data, offset);
  }
  for (const [path, text] of Object.entries(entries)) {
    const bytes = encoder.encode(text);
    const header = new Uint8Array(512);
    field(header, 0, 100, path);
    field(header, 100, 8, '0000644\0');
    field(header, 108, 8, '0000000\0');
    field(header, 116, 8, '0000000\0');
    field(header, 124, 12, `${bytes.length.toString(8).padStart(11, '0')}\0`);
    field(header, 136, 12, '00000000000\0');
    header.fill(32, 148, 156);
    header[156] = 48;
    field(header, 257, 6, 'ustar\0');
    field(header, 263, 2, '00');
    field(header, 148, 8, `${header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0')}\0 `);
    const body = new Uint8Array(Math.ceil(bytes.length / 512) * 512);
    body.set(bytes);
    blocks.push(header, body);
  }
  blocks.push(new Uint8Array(1024));
  const result = new Uint8Array(blocks.reduce((length, block) => length + block.length, 0));
  let offset = 0;
  for (const block of blocks) { result.set(block, offset); offset += block.length; }
  return result;
}
