export const context = Object.freeze({
  release: 'Yocto 5.0.13 / Scarthgap',
  pokyTag: '529843b1c189ab7b133b7fdf197d4b2a4b71a6db',
  poky: 'f16cffd030d21d12dd57bb95cfc310bda41f8a1f',
  bsp: '018d44467c4f09eb63f8ea5e86e85d755250cf89',
  machine: 'raspberrypi5',
  provider: 'linux-raspberrypi',
  version: '6.6.63',
  branch: 'rpi-6.6.y',
  kernel: 'e442e5c1ab6bff5b5460b4fc949beb72aaf77970',
  cache: '52ff0d75713ce61962b325a2090bd55e216f0cf3',
  cacheBranch: 'yocto-6.6',
  defconfig: 'bcm2712_defconfig',
  inspected: '2026-10-19'
});

// Dependencies below are explanatory, not an implementation of Kconfig.
export const catalog = [
  {
    symbol: 'BRCMFMAC', type: 'tristate', group: 'Wireless & Bluetooth',
    name: 'Broadcom Wi-Fi', module: 'brcmfmac',
    description: 'FullMAC Wi-Fi driver used by onboard wireless. Disabling it can remove your remote connection.',
    dependencies: 'WLAN, WLAN_VENDOR_BROADCOM, CFG80211; selects BRCMUTIL. Onboard SDIO also needs BRCMFMAC_SDIO and MMC.',
    prerequisites: ['WLAN', 'WLAN_VENDOR_BROADCOM', 'CFG80211'],
    risk: 'Have a wired connection or local console before changing Wi-Fi. Firmware and regulatory data must also be packaged.',
    source: 'drivers/net/wireless/broadcom/brcm80211/brcmfmac/Kconfig'
  },
  {
    symbol: 'BRCMFMAC_SDIO', type: 'bool', group: 'Wireless & Bluetooth',
    name: 'Broadcom Wi-Fi SDIO bus', module: null,
    description: 'Bus support inside the Wi-Fi driver, not a separate loadable module.',
    dependencies: 'BRCMFMAC && (MMC=y || MMC=BRCMFMAC); selects firmware loader and BCDC protocol. Inherits wireless menu gates.',
    prerequisites: ['BRCMFMAC', 'MMC'],
    risk: 'Disabling this can break onboard Wi-Fi even when BRCMFMAC is enabled.',
    source: 'drivers/net/wireless/broadcom/brcm80211/brcmfmac/Kconfig'
  },
  {
    symbol: 'BT_HCIUART', type: 'tristate', group: 'Wireless & Bluetooth',
    name: 'Bluetooth UART transport', module: 'hci_uart',
    description: 'Bluetooth over a serial interface. Onboard Bluetooth additionally needs the Broadcom protocol.',
    dependencies: 'BT, TTY, (SERIAL_DEV_BUS || !SERIAL_DEV_BUS), (NVMEM || !NVMEM). Modular parents can cap this at m.',
    prerequisites: ['BT', 'TTY'],
    risk: 'BlueZ userspace, firmware and correct UART/device tree setup are separate requirements.',
    source: 'drivers/bluetooth/Kconfig'
  },
  {
    symbol: 'BT_HCIUART_BCM', type: 'bool', group: 'Wireless & Bluetooth',
    name: 'Broadcom Bluetooth protocol', module: null,
    description: 'Broadcom protocol inside the UART transport; this boolean cannot be a module on its own.',
    dependencies: 'BT_HCIUART, BT_HCIUART_SERDEV, GPIOLIB, (!ACPI || SERIAL_DEV_CTRL_TTYPORT); selects BT_HCIUART_H4 and BT_BCM.',
    prerequisites: ['BT_HCIUART', 'BT_HCIUART_SERDEV', 'GPIOLIB'],
    risk: 'Disabling this may remove onboard Bluetooth. Firmware licensing and installation remain separate.',
    source: 'drivers/bluetooth/Kconfig'
  },
  {
    symbol: 'I2C_CHARDEV', type: 'tristate', group: 'I2C & SPI',
    name: 'I2C userspace interface', module: 'i2c-dev',
    description: 'Provides /dev/i2c-* access for userspace tools. Does not enable a physical bus or a sensor.',
    dependencies: 'Inside if I2C. A board-specific controller, pin configuration and device tree are still needed.',
    prerequisites: ['I2C'],
    risk: 'Raw bus writes can disturb connected devices. Use suitable permissions and correct electrical wiring.',
    source: 'drivers/i2c/Kconfig'
  },
  {
    symbol: 'SPI_SPIDEV', type: 'tristate', group: 'I2C & SPI',
    name: 'SPI userspace interface', module: 'spidev',
    description: 'Provides /dev/spidev* for appropriately described SPI peripherals.',
    dependencies: 'Inside SPI and SPI_MASTER. Requires the controller and a supported device-tree binding.',
    prerequisites: ['SPI', 'SPI_MASTER'],
    risk: 'CONFIG alone does not create a device. Do not add a generic spidev compatible to bypass binding checks.',
    source: 'drivers/spi/Kconfig'
  },
  {
    symbol: 'USB_SERIAL_CP210X', type: 'tristate', group: 'USB accessories',
    name: 'CP210x USB serial adapters', module: 'cp210x',
    description: 'USB-to-UART adapters using Silicon Labs CP210x chips.',
    dependencies: 'USB_SUPPORT, USB, USB_SERIAL and TTY through enclosing menus. USB_SERIAL=m caps children at m.',
    prerequisites: ['USB_SUPPORT', 'USB', 'USB_SERIAL', 'TTY'],
    risk: 'If your management console uses this adapter, disabling it removes that connection.',
    source: 'drivers/usb/serial/Kconfig'
  },
  {
    symbol: 'USB_SERIAL_FTDI_SIO', type: 'tristate', group: 'USB accessories',
    name: 'FTDI USB serial adapters', module: 'ftdi_sio',
    description: 'Common FTDI USB-to-UART adapters; not the Pi onboard serial console driver.',
    dependencies: 'USB_SUPPORT, USB, USB_SERIAL and TTY through enclosing menus. USB_SERIAL=m caps children at m.',
    prerequisites: ['USB_SUPPORT', 'USB', 'USB_SERIAL', 'TTY'],
    risk: 'Keep enabled if this adapter is your recovery or management connection.',
    source: 'drivers/usb/serial/Kconfig'
  },
  {
    symbol: 'SND_USB_AUDIO', type: 'tristate', group: 'Sound',
    name: 'USB audio & MIDI', module: 'snd-usb-audio',
    description: 'External USB sound cards and MIDI devices. Not a selector for all Pi HDMI or HAT audio.',
    dependencies: 'SOUND, SND, SND_USB and USB through menus. Selects PCM, RAWMIDI, HWDEP and other helpers.',
    prerequisites: ['SOUND', 'SND', 'SND_USB', 'USB'],
    risk: 'ALSA userspace and device permissions are separate. Built-in requests can be capped by modular sound parents.',
    source: 'sound/usb/Kconfig'
  },
  {
    symbol: 'FUSE_FS', type: 'tristate', group: 'Filesystems & diagnostics',
    name: 'FUSE userspace filesystems', module: 'fuse',
    description: 'Kernel interface for userspace filesystems such as SSHFS. Not the ext4 root filesystem.',
    dependencies: 'Selects FS_POSIX_ACL. Userspace filesystem implementation and libraries must be installed separately.',
    prerequisites: [],
    risk: 'Keep default if your boot or application storage depends on a userspace filesystem.',
    source: 'fs/fuse/Kconfig'
  },
  {
    symbol: 'NTFS3_FS', type: 'tristate', group: 'Filesystems & diagnostics',
    name: 'NTFS3 removable storage', module: 'ntfs3',
    description: 'Read/write NTFS support, for example on an external data drive.',
    dependencies: 'Selects BUFFER_HEAD, NLS and LEGACY_DIRECT_IO.',
    prerequisites: [],
    risk: 'Back up data before filesystem experiments. This app does not change your root filesystem or mount policy.',
    source: 'fs/ntfs3/Kconfig'
  },
  {
    symbol: 'DEBUG_FS', type: 'bool', group: 'Filesystems & diagnostics',
    name: 'Kernel debug filesystem', module: null,
    description: 'Developer diagnostics, not a normal persistent filesystem. Boolean: only y or n.',
    dependencies: 'Other features may select this symbol. Disabling it can be reversed during Kconfig normalization.',
    prerequisites: [],
    risk: 'Debug interfaces may expose sensitive state. Do not mount debugfs for untrusted users.',
    source: 'lib/Kconfig.debug'
  }
];

export function sourceUrl(item) {
  return `https://github.com/raspberrypi/linux/blob/${context.kernel}/${item.source}`;
}
