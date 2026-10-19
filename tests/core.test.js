import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catalog, context, sourceUrl } from '../src/catalog.js';
import { validate, fragment, files, requests, diagnostics, parseConfig, compare, archive, compareScript } from '../src/core.js';
import { instructions } from '../src/instructions.js';

test('catalog has pinned provenance and explanatory dependencies/risks', () => {
  assert.equal(catalog.length, 12);
  assert.equal(new Set(catalog.map(i => i.symbol)).size, catalog.length);
  for (const item of catalog) {
    assert.match(item.symbol, /^[A-Z0-9_]+$/);
    assert.ok(['bool', 'tristate'].includes(item.type));
    for (const key of ['description', 'dependencies', 'risk', 'source', 'group']) assert.ok(item[key], key);
    assert.ok(sourceUrl(item).includes(context.kernel));
  }
  assert.equal(context.version, '6.6.63');
  assert.equal(context.poky, 'f16cffd030d21d12dd57bb95cfc310bda41f8a1f');
});

test('Keep default omits all assignments, including MODULES', () => {
  const kept = Object.fromEntries(catalog.map(item => [item.symbol, 'keep']));
  assert.deepEqual(requests(kept), {});
  assert.doesNotMatch(fragment(kept), /^CONFIG_|^# CONFIG_/m);
  assert.deepEqual(compare(kept, {}), []);
});

test('each symbol supports exactly its verified Kconfig states', () => {
  for (const item of catalog) {
    for (const state of ['y', 'n', ...(item.type === 'tristate' ? ['m'] : [])]) {
      const output = fragment({ [item.symbol]: state });
      assert.ok(output.includes(state === 'n' ? `# CONFIG_${item.symbol} is not set` : `CONFIG_${item.symbol}=${state}`));
      assert.equal(output.includes('CONFIG_MODULES=y'), state === 'm');
    }
    if (item.type === 'bool') assert.throws(() => validate({ [item.symbol]: 'm' }), /Invalid state/);
  }
  assert.throws(() => validate({ PCI: 'n' }), /Unknown symbol/);
  assert.throws(() => validate({ FUSE_FS: 'y\nCONFIG_PCI=n' }), /Invalid state/);
  for (const invalid of [null, [], 'x']) assert.throws(() => validate(invalid));
});

test('module support is added once, keep symbols are never changed', () => {
  const output = fragment({ I2C_CHARDEV: 'm', FUSE_FS: 'm', DEBUG_FS: 'keep' });
  assert.equal((output.match(/CONFIG_MODULES=y/g) || []).length, 1);
  assert.doesNotMatch(output, /CONFIG_DEBUG_FS/);
  assert.ok(diagnostics({ FUSE_FS: 'm' }).some(note => note.includes('packaging')));
});

test('dependency conflicts, modular limits and boot/connection warnings are explicit', () => {
  assert.ok(diagnostics({ BRCMFMAC: 'n', BRCMFMAC_SDIO: 'y' }).some(note => note.startsWith('Conflict:')));
  assert.ok(diagnostics({ BT_HCIUART: 'n', BT_HCIUART_BCM: 'y' }).some(note => note.includes('disabled CONFIG_BT_HCIUART')));
  assert.ok(diagnostics({ BRCMFMAC: 'n' }).some(note => note.includes('wired connection')));
  assert.ok(diagnostics({ USB_SERIAL_CP210X: 'y' }).some(note => note.includes('caps children at m')));
  assert.ok(!diagnostics({ BRCMFMAC: 'm', BRCMFMAC_SDIO: 'y', BT_HCIUART: 'm', BT_HCIUART_BCM: 'y' })
    .some(note => note.startsWith('Dependency limit:')));
});

test('layer output has correct recipe filename, paths, override syntax and compatibility', () => {
  const output = files({ I2C_CHARDEV: 'm' });
  assert.deepEqual(Object.keys(output), [
    'meta-custom/conf/layer.conf',
    'meta-custom/recipes-kernel/linux/linux-raspberrypi_6.6.bbappend',
    'meta-custom/recipes-kernel/linux/files/pi5-custom.cfg', 'integration.txt', 'compare-config.py'
  ]);
  const append = output[Object.keys(output)[1]];
  assert.match(append, /FILESEXTRAPATHS:prepend := "\$\{THISDIR\}\/files:"/);
  assert.match(append, /SRC_URI:append:raspberrypi5 = " file:\/\/pi5-custom.cfg"/);
  assert.match(output['meta-custom/conf/layer.conf'], /LAYERSERIES_COMPAT_custom = "scarthgap"/);
  assert.match(output['meta-custom/conf/layer.conf'], /LAYERDEPENDS_custom = "core raspberrypi"/);
  for (const pin of [context.poky, context.bsp, context.kernel, context.cache]) assert.ok(instructions.includes(pin));
  for (const phrase of ['listtasks', 'show-recipes', 'show-appends', 'kernel_configme', 'kernel_configcheck', 'menuconfig', 'diffconfig', 'FINAL.config', 'NO_RECOMMENDATIONS']) assert.ok(instructions.includes(phrase));
});

test('comparison catches dropped requests, re-enabled n, module support and stale results', () => {
  const config = parseConfig('CONFIG_FUSE_FS=m\r\nCONFIG_MODULES=y\r\n# CONFIG_DEBUG_FS is not set\r\nCONFIG_NAME="quoted value"\nCONFIG_NR_CPUS=8\n');
  assert.ok(compare({ FUSE_FS: 'm', DEBUG_FS: 'n' }, config).every(row => row.matches));
  assert.equal(compare({ FUSE_FS: 'y' }, config)[0].matches, false);
  assert.equal(compare({ BRCMFMAC: 'n' }, config)[0].actual, 'absent');
  assert.equal(compare({ FUSE_FS: 'n' }, config)[0].matches, false);
  assert.throws(() => parseConfig('CONFIG_FUSE_FS=y\nCONFIG_FUSE_FS=m'), /Duplicate/);
  for (const text of ['', '<script>alert(1)</script>', 'hello', 'CONFIG_FUSE_FS=maybe', 'x'.repeat(5 * 1024 * 1024 + 1)]) assert.throws(() => parseConfig(text));
});

test('archive round-trips every text file, checksum, padding and terminator', () => {
  const output = files({ FUSE_FS: 'm', DEBUG_FS: 'n' });
  const tar = archive(output);
  assert.deepEqual(tar, archive(output));
  const decoder = new TextDecoder();
  let offset = 0;
  for (const [path, text] of Object.entries(output)) {
    const header = tar.slice(offset, offset + 512);
    assert.equal(decoder.decode(header.slice(0, 100)).replace(/\0.*$/, ''), path);
    const size = parseInt(decoder.decode(header.slice(124, 136)), 8);
    assert.equal(size, new TextEncoder().encode(text).length);
    const checksum = parseInt(decoder.decode(header.slice(148, 156)), 8);
    header.fill(32, 148, 156);
    assert.equal(checksum, header.reduce((sum, byte) => sum + byte, 0));
    assert.equal(decoder.decode(tar.slice(offset + 512, offset + 512 + size)), text);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.equal(tar.length - offset, 1024);
  assert.ok(tar.slice(offset).every(byte => byte === 0));
});

test('static app accessibility and privacy contracts', async () => {
  const html = await readFile('index.html', 'utf8');
  const app = await readFile('src/app.js', 'utf8');
  assert.match(html, /lang="en"/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /class="skip"/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /<script[^>]+src="https:/);
  assert.doesNotMatch(app, /\.innerHTML|localStorage|fetch\(/);
  assert.ok(compareScript.includes('actual != wanted'));
});
