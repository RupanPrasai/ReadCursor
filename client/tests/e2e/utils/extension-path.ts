/**
 * Returns the Chrome/Firefox extension base URL:
 *  - Chrome:  chrome-extension://<id>
 *  - Firefox: moz-extension://<uuid>
 *
 * Chrome strategy:
 *   1) RC_EXTENSION_ID / EXTENSION_ID override
 *   2) RC_E2E_EXTENSION_KEY -> compute extension ID (CI-safe, no scraping)
 *   3) Fallback: scrape chrome://extensions (local-only)
 */

import { createHash } from 'node:crypto';

let cachedChromeExtensionPath: string | null = null;

function extensionIdFromPublicKeyBase64(keyB64: string): string {
  const der = Buffer.from(keyB64, 'base64');
  const hash = createHash('sha256').update(der).digest();

  // Chrome extension ID is derived from the first 128 bits of sha256(publicKey),
  // encoded as letters a-p (nibble 0-15 => a-p).
  const first16 = hash.subarray(0, 16);
  const a = 'a'.charCodeAt(0);

  let out = '';
  for (const b of first16) {
    out += String.fromCharCode(a + ((b >> 4) & 0xf));
    out += String.fromCharCode(a + (b & 0xf));
  }
  return out;
}

export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
  if (cachedChromeExtensionPath) return cachedChromeExtensionPath;

  const forcedId = (process.env.RC_EXTENSION_ID ?? process.env.EXTENSION_ID ?? '').trim();
  if (forcedId) {
    cachedChromeExtensionPath = `chrome-extension://${forcedId}`;
    return cachedChromeExtensionPath;
  }

  const keyB64 = (process.env.RC_E2E_EXTENSION_KEY ?? '').trim();
  if (keyB64) {
    const id = extensionIdFromPublicKeyBase64(keyB64);
    cachedChromeExtensionPath = `chrome-extension://${id}`;
    return cachedChromeExtensionPath;
  }

  const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  if (isCi) {
    throw new Error(
      'Cannot resolve Chrome extension ID in CI without RC_E2E_EXTENSION_KEY or RC_EXTENSION_ID. ' +
        'Fix: patch manifest.key in wdio.browser.conf.ts and set RC_E2E_EXTENSION_KEY (see recommended config).',
    );
  }

  // ---- Local fallback only (brittle by nature) ----
  const originalHandle = await browser.getWindowHandle();

  await browser.newWindow('chrome://extensions/', { type: 'tab' });
  const mgrHandle = await browser.getWindowHandle();
  await browser.switchToWindow(mgrHandle);

  await browser.waitUntil(async () => (await $('extensions-manager').isExisting()) === true, {
    timeout: 15_000,
    timeoutMsg: 'chrome://extensions did not load extensions-manager',
  });

  // Wait for at least one item to appear (virtualized UI can be late)
  await browser.waitUntil(
    async () => {
      try {
        const itemList = await mgr.shadow$('#container > #viewManager > extensions-item-list');
        const item = await itemList.shadow$('extensions-item');
        return await item.isExisting();
      } catch {
        return false;
      }
    },
    { timeout: 15_000, timeoutMsg: 'No extensions-item rendered on chrome://extensions' },
  );

  const extensionId = await browser.execute(() => {
    const mgr = document.querySelector('extensions-manager') as any;
    const sr1 = mgr?.shadowRoot;
    const itemList = sr1?.querySelector('#container > #viewManager > extensions-item-list') as any;
    const sr2 = itemList?.shadowRoot;
    const item = sr2?.querySelector('extensions-item') as any;
    return item?.getAttribute?.('id') || '';
  });

  if (!extensionId) {
    throw new Error('Extension ID not found on chrome://extensions (local fallback failed).');
  }

  cachedChromeExtensionPath = `chrome-extension://${extensionId}`;

  await browser.closeWindow();
  await browser.switchToWindow(originalHandle);

  return cachedChromeExtensionPath;
};

export const getFirefoxExtensionPath = async (browser: WebdriverIO.Browser) => {
  await browser.url('about:debugging#/runtime/this-firefox');

  const uuidElement = await browser.$('//dt[contains(text(), "Internal UUID")]/following-sibling::dd').getElement();
  const internalUUID = await uuidElement.getText();
  if (!internalUUID) throw new Error('Internal UUID not found');

  return `moz-extension://${internalUUID}`;
};

