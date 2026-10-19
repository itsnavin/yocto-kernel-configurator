"""Desktop/mobile interaction and real download checks. Requires playwright."""
import os
import tarfile
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("SITE_URL", "http://127.0.0.1:4173").rstrip("/") + "/"

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def exercise(self, width, height):
        context = self.browser.new_context(viewport={"width": width, "height": height},
                                          permissions=["clipboard-read", "clipboard-write"])
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            response = page.goto(BASE)
            self.assertEqual(response.status, 200)
            page.locator("#state-FUSE_FS").wait_for()
            self.assertEqual(page.locator(".feature").count(), 12)
            self.assertTrue(page.locator("#download-all").is_disabled())
            self.assertNotIn('value="m"', page.locator("#state-DEBUG_FS").inner_html())
            self.assertNotIn("CONFIG_FUSE_FS=", page.locator("#preview").inner_text())
            page.locator("#state-FUSE_FS").select_option("m")
            page.locator("#state-DEBUG_FS").select_option("n")
            self.assertIn("CONFIG_FUSE_FS=m", page.locator("#preview").inner_text())
            self.assertIn("CONFIG_MODULES=y", page.locator("#preview").inner_text())
            self.assertIn("# CONFIG_DEBUG_FS is not set", page.locator("#preview").inner_text())
            page.locator("#copy").click()
            self.assertEqual(page.evaluate("navigator.clipboard.readText()").replace("\r\n", "\n"), page.locator("#preview").inner_text())
            with page.expect_download() as downloaded:
                page.locator("#download-all").click()
            download = downloaded.value
            self.assertEqual(download.suggested_filename, "pi5-kernel-layer.tar")
            with tarfile.open(download.path()) as archive:
                self.assertEqual(len(archive.getnames()), 5)
                fragment = archive.extractfile("meta-custom/recipes-kernel/linux/files/pi5-custom.cfg").read().decode()
                self.assertIn("CONFIG_FUSE_FS=m", fragment)
                append = archive.extractfile("meta-custom/recipes-kernel/linux/linux-raspberrypi_6.6.bbappend").read().decode()
                self.assertIn("SRC_URI:append:raspberrypi5", append)
            with page.expect_download() as downloaded:
                page.locator("#download-file").click()
            self.assertEqual(Path(downloaded.value.path()).read_text(), fragment)
            page.locator("#config-upload").set_input_files({
                "name": ".config", "mimeType": "text/plain",
                "buffer": b"CONFIG_FUSE_FS=m\nCONFIG_MODULES=y\n# CONFIG_DEBUG_FS is not set\n"
            })
            page.wait_for_function("document.querySelector('#comparison-status').textContent.includes('All 3')")
            page.locator("#state-FUSE_FS").select_option("y")
            self.assertIn("1 of 2 requests differ", page.locator("#comparison-status").inner_text())
            page.locator("#config-upload").set_input_files({
                "name": "bad.config", "mimeType": "text/plain", "buffer": b"<script>alert(1)</script>"
            })
            page.wait_for_function("document.querySelector('#comparison-status').textContent.includes('Could not read')")
            self.assertEqual(page.locator("#comparison-results tr").count(), 0)
            page.locator("#search").fill("<script>")
            self.assertEqual(page.locator(".feature").count(), 0)
            self.assertIn("No matches", page.locator("#result-count").inner_text())
            page.locator("#search").fill("")
            page.locator("#group").select_option("Wireless & Bluetooth")
            self.assertEqual(page.locator(".feature").count(), 4)
            page.locator("#state-BRCMFMAC").select_option("n")
            page.locator("#state-BRCMFMAC_SDIO").select_option("y")
            self.assertIn("Conflict:", page.locator("#warnings").inner_text())
            page.locator("#group").select_option("")
            page.locator("#reset").click()
            self.assertTrue(page.locator("#download-all").is_disabled())
            self.assertNotIn("CONFIG_MODULES=y", page.locator("#preview").inner_text())
            for select in page.locator(".feature select").all():
                self.assertEqual(select.input_value(), "keep")
            self.assertFalse(page.evaluate("document.documentElement.scrollWidth > innerWidth"))
            page.reload()
            page.locator("#state-FUSE_FS").wait_for()
            page.keyboard.press("Tab")
            self.assertTrue(page.locator(".skip").evaluate("(el) => el === document.activeElement"))
            self.assertFalse(errors, errors)
        finally:
            context.close()

    def test_desktop(self):
        self.exercise(1440, 1000)

    def test_mobile(self):
        self.exercise(390, 844)

if __name__ == "__main__":
    unittest.main()
