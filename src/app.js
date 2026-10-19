import { catalog, context as c, sourceUrl } from './catalog.js';
import { files, diagnostics, requests, parseConfig, compare, archive } from './core.js';
import { instructions } from './instructions.js';

const $ = id => document.getElementById(id);
let selection = {};
let generated = {};
let finalConfig = null;
let uploadSequence = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

for (const group of new Set(catalog.map(item => item.group))) {
  const option = element('option', group);
  option.value = group;
  $('group').append(option);
}

function renderCatalog() {
  const query = $('search').value.trim().toLowerCase();
  const group = $('group').value;
  const filtered = catalog.filter(item => (!group || item.group === group)
    && [item.name, `CONFIG_${item.symbol}`, item.description, item.group].join(' ').toLowerCase().includes(query));
  $('catalog').replaceChildren();
  let lastGroup;
  for (const item of filtered) {
    if (item.group !== lastGroup) {
      $('catalog').append(element('h3', item.group, 'group-heading'));
      lastGroup = item.group;
    }
    const card = element('article', undefined, 'feature');
    const top = element('div', undefined, 'feature-top');
    const heading = element('div');
    const title = element('h4', item.name);
    title.append(element('span', item.type === 'bool' ? 'BOOL' : 'TRISTATE', 'type'));
    heading.append(title, element('code', `CONFIG_${item.symbol}`));
    const label = element('label', 'Requested state');
    const select = element('select');
    select.id = `state-${item.symbol}`;
    select.setAttribute('aria-label', `${item.name} requested state`);
    for (const [value, text] of [['keep', 'Keep default'], ['y', 'Built-in (y)'], ...(item.type === 'tristate' ? [['m', 'Module (m)']] : []), ['n', 'Disabled (n)']]) {
      const option = element('option', text);
      option.value = value;
      select.append(option);
    }
    select.value = selection[item.symbol] || 'keep';
    select.addEventListener('change', () => {
      selection[item.symbol] = select.value;
      updateOutput();
    });
    label.append(select);
    top.append(heading, label);
    const detail = element('details');
    detail.append(element('summary', 'Dependencies, risks & source'));
    detail.append(element('p', item.dependencies), element('p', item.risk));
    detail.append(element('p', item.module ? `Module name if built as m: ${item.module}` : 'Boolean subfeature: no standalone m state.'));
    const link = element('a', `Pinned source: ${item.source}`);
    link.href = sourceUrl(item);
    detail.append(link);
    card.append(top, element('p', item.description), detail);
    $('catalog').append(card);
  }
  $('result-count').textContent = `${filtered.length} of ${catalog.length} curated features shown. ${filtered.length ? 'All start at Keep default.' : 'No matches. Try another search or category.'}`;
}

function updatePreview() {
  $('preview').textContent = generated[$('file').value];
}

function updateComparison() {
  $('comparison-results').replaceChildren();
  if (!finalConfig) return;
  const rows = compare(selection, finalConfig);
  if (!rows.length) {
    $('comparison-status').textContent = 'No explicit requests to compare. Keep default does not assert a final state.';
    return;
  }
  const mismatches = rows.filter(row => !row.matches).length;
  $('comparison-status').textContent = mismatches
    ? `${mismatches} of ${rows.length} requests differ. Resolve these in your build; no exact match is claimed.`
    : `All ${rows.length} requested values match this file. This is not a provider, build or hardware validation.`;
  const table = element('table');
  const head = element('thead');
  const titles = element('tr');
  for (const title of ['Symbol', 'Wanted', 'Final']) {
    const th = element('th', title);
    th.scope = 'col';
    titles.append(th);
  }
  head.append(titles);
  const body = element('tbody');
  for (const row of rows) {
    const tr = element('tr', undefined, row.matches ? 'match' : 'mismatch');
    for (const value of [`CONFIG_${row.symbol}`, row.wanted, row.actual]) tr.append(element('td', value));
    body.append(tr);
  }
  table.append(head, body);
  $('comparison-results').append(table);
}

function updateOutput() {
  generated = files(selection);
  const previous = $('file').value;
  $('file').replaceChildren();
  for (const path of Object.keys(generated)) {
    const option = element('option', path);
    option.value = path;
    $('file').append(option);
  }
  $('file').value = Object.hasOwn(generated, previous) ? previous : 'meta-custom/recipes-kernel/linux/files/pi5-custom.cfg';
  updatePreview();
  const count = Object.keys(selection).filter(key => selection[key] !== 'keep').length;
  $('change-count').textContent = `${count} ${count === 1 ? 'change' : 'changes'}`;
  const notes = diagnostics(selection);
  $('warnings').replaceChildren(...notes.map(note => element('li', note)));
  $('warning-count').textContent = `(${notes.length})`;
  $('status').textContent = '';
  $('download-all').disabled = !Object.keys(requests(selection)).length;
  $('download-all').title = count ? 'Download the complete starter layer' : 'Choose at least one explicit state before exporting a layer';
  updateComparison();
}

function download(data, filename, mime) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const link = element('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('status').textContent = `Download prepared: ${filename}`;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    $('status').textContent = 'Copied to clipboard.';
  } catch {
    $('status').textContent = 'Clipboard unavailable. Focus the preview, select its text and copy manually.';
    $('preview').parentElement.focus();
  }
}

$('search').addEventListener('input', renderCatalog);
$('group').addEventListener('change', renderCatalog);
$('file').addEventListener('change', updatePreview);
$('reset').addEventListener('click', () => {
  selection = {};
  renderCatalog();
  updateOutput();
  $('status').textContent = 'All features reset to Keep default.';
});
$('copy').addEventListener('click', () => copy(generated[$('file').value]));
$('copy-guide').addEventListener('click', () => copy(instructions));
$('download-file').addEventListener('click', () => download(generated[$('file').value], $('file').value.split('/').pop(), 'text/plain;charset=utf-8'));
$('download-all').addEventListener('click', () => download(archive(generated), 'pi5-kernel-layer.tar', 'application/x-tar'));
$('config-upload').addEventListener('change', async () => {
  const sequence = ++uploadSequence;
  finalConfig = null;
  $('comparison-results').replaceChildren();
  const file = $('config-upload').files[0];
  if (!file) {
    $('comparison-status').textContent = 'No final .config loaded.';
    return;
  }
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('File is too large. Use a text .config up to 5 MiB.');
    const text = await file.text();
    if (sequence !== uploadSequence) return;
    finalConfig = parseConfig(text);
    updateComparison();
  } catch (error) {
    if (sequence !== uploadSequence) return;
    $('comparison-status').textContent = `Could not read .config: ${error.message}`;
  }
});
$('guide').textContent = instructions;
const pins = [
  ['Yocto / Poky release', c.release],
  ['Poky annotated tag object', c.pokyTag, `https://github.com/yoctoproject/poky/releases/tag/yocto-5.0.13`],
  ['Poky resolved commit', c.poky, `https://github.com/yoctoproject/poky/tree/${c.poky}`],
  ['meta-raspberrypi commit', c.bsp, `https://github.com/agherzan/meta-raspberrypi/tree/${c.bsp}`],
  ['Default provider / preference', 'linux-raspberrypi / 6.6.%', `https://github.com/agherzan/meta-raspberrypi/blob/${c.bsp}/conf/machine/include/rpi-default-versions.inc`],
  ['Recipe / version', 'linux-raspberrypi_6.6.bb / 6.6.63', `https://github.com/agherzan/meta-raspberrypi/blob/${c.bsp}/recipes-kernel/linux/linux-raspberrypi_6.6.bb`],
  ['Kernel source / branch', `${c.kernel} / ${c.branch}`, `https://github.com/raspberrypi/linux/tree/${c.kernel}`],
  ['Kernel-cache revision / branch', `${c.cache} / ${c.cacheBranch}`],
  ['Machine / baseline', 'raspberrypi5 / bcm2712_defconfig', `https://github.com/agherzan/meta-raspberrypi/blob/${c.bsp}/recipes-kernel/linux/linux-raspberrypi.inc`],
  ['Fragment processing', 'linux-yocto.inc → inherit kernel-yocto', `https://github.com/yoctoproject/poky/blob/${c.poky}/meta/classes-recipe/kernel-yocto.bbclass`],
  ['Source inspection date', c.inspected]
];
for (const [label, value, href] of pins) {
  const dd = element('dd');
  if (href) { const a = element('a', value); a.href = href; dd.append(a); }
  else dd.textContent = value;
  $('pins').append(element('dt', label), dd);
}
renderCatalog();
updateOutput();
