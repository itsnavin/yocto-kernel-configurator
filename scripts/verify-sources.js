import assert from 'node:assert/strict';
import { catalog, context as c } from '../src/catalog.js';
const cache = new Map();
async function source(repo, revision, path) {
  const url = `https://raw.githubusercontent.com/${repo}/${revision}/${path}`;
  if (!cache.has(url)) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    cache.set(url, await response.text());
  }
  return cache.get(url);
}
for (const item of catalog) {
  const text = await source('raspberrypi/linux', c.kernel, item.source);
  const declaration = new RegExp(`^(?:menu)?config ${item.symbol}\\s*\\n([\\s\\S]*?)(?=\\n(?:menu)?config |$)`, 'm').exec(text);
  assert.ok(declaration, `Missing ${item.symbol}`);
  assert.match(declaration[1], new RegExp(`^\\s+${item.type}(?:\\s|$)`, 'm'), item.symbol);
  console.log(`Verified ${item.symbol} ${item.type}: ${item.source}`);
}
const bsp = path => source('agherzan/meta-raspberrypi', c.bsp, path);
assert.match(await bsp('conf/machine/include/rpi-default-providers.inc'), /PREFERRED_PROVIDER_virtual\/kernel \?\?= "linux-raspberrypi"/);
assert.match(await bsp('conf/machine/include/rpi-default-versions.inc'), /PREFERRED_VERSION_linux-raspberrypi \?\?= "6\.6\.%"/);
const recipe = await bsp('recipes-kernel/linux/linux-raspberrypi_6.6.bb');
for (const pin of [c.version, c.branch, c.kernel, c.cache, c.cacheBranch]) assert.ok(recipe.includes(pin), pin);
const include = await bsp('recipes-kernel/linux/linux-raspberrypi.inc');
assert.match(include, /require recipes-kernel\/linux\/linux-yocto.inc/);
assert.match(include, /KBUILD_DEFCONFIG:raspberrypi5 \?= "bcm2712_defconfig"/);
assert.match(include, /KCONFIG_MODE = "--alldefconfig"/);
assert.doesNotMatch(recipe + include, /file:\/\/[^\s"]+\.patch/);
assert.match(await bsp('conf/machine/raspberrypi5.conf'), /include conf\/machine\/include\/rpi-base.inc/);
const poky = path => source('yoctoproject/poky', c.poky, path);
assert.match(await poky('meta/recipes-kernel/linux/linux-yocto.inc'), /inherit kernel-yocto/);
const kernelClass = await poky('meta/classes-recipe/kernel-yocto.bbclass');
for (const task of ['do_kernel_configme', 'do_kernel_configcheck']) assert.ok(kernelClass.includes(task));
assert.ok(kernelClass.includes('[".scc", ".cfg"]'));
const makefile = await source('raspberrypi/linux', c.kernel, 'Makefile');
assert.match(makefile, /^VERSION = 6$/m);
assert.match(makefile, /^PATCHLEVEL = 6$/m);
assert.match(makefile, /^SUBLEVEL = 63$/m);
console.log('Verified pinned provider, recipe, baseline, fragment consumption, tasks and downstream version.');
