import { mkdir, writeFile } from 'node:fs/promises';
import { catalog } from '../src/catalog.js';
import { requests, fragment, compareScript } from '../src/core.js';
const examples = [
  ['keep default', {}, {}],
  ['modules with support', { I2C_CHARDEV: 'm', SPI_SPIDEV: 'm', FUSE_FS: 'm', NTFS3_FS: 'm', USB_SERIAL_CP210X: 'm', USB_SERIAL_FTDI_SIO: 'm', SND_USB_AUDIO: 'm' },
    { I2C_CHARDEV: 'm', SPI_SPIDEV: 'm', FUSE_FS: 'm', NTFS3_FS: 'm', USB_SERIAL_CP210X: 'm', USB_SERIAL_FTDI_SIO: 'm', SND_USB_AUDIO: 'm', MODULES: 'y' }],
  ['wireless modules with bool protocols', { BRCMFMAC: 'm', BRCMFMAC_SDIO: 'y', BT_HCIUART: 'm', BT_HCIUART_BCM: 'y' },
    { BRCMFMAC: 'm', BRCMFMAC_SDIO: 'y', BT_HCIUART: 'm', BT_HCIUART_BCM: 'y', MODULES: 'y' }],
  ['leaf built-ins and bool', { FUSE_FS: 'y', NTFS3_FS: 'y', DEBUG_FS: 'y' }, { FUSE_FS: 'y', NTFS3_FS: 'y', DEBUG_FS: 'y' }],
  ['disabled optional leaves', { FUSE_FS: 'n', NTFS3_FS: 'n', USB_SERIAL_CP210X: 'n' }, { FUSE_FS: 'n', NTFS3_FS: 'n', USB_SERIAL_CP210X: 'n' }],
  ['Wi-Fi disabled defeats SDIO request', { BRCMFMAC: 'n', BRCMFMAC_SDIO: 'y' }, { BRCMFMAC: 'n', BRCMFMAC_SDIO: 'absent' }],
  ['USB modular parent caps built-in child', { USB_SERIAL_CP210X: 'y' }, { USB_SERIAL_CP210X: 'm' }],
  ['Bluetooth disabled transport defeats protocol', { BT_HCIUART: 'n', BT_HCIUART_BCM: 'y' }, { BT_HCIUART: 'n', BT_HCIUART_BCM: 'absent' }]
];
await mkdir('test-results', { recursive: true });
await writeFile('test-results/kconfig-fixtures.json', JSON.stringify({
  catalog: catalog.map(({ symbol, type }) => ({ symbol, type })),
  cases: examples.map(([name, selection, expected]) => ({ name, requests: requests(selection), fragment: fragment(selection), expected }))
}, null, 2));
await writeFile('test-results/compare-config.py', compareScript);
console.log('Generated Kconfig smoke fixtures from actual generator.');
