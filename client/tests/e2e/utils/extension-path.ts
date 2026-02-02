/**
 * Returns the Chrome/Firefox extension base URL:
 *  - Chrome:  chrome-extension://<id>
 *  - Firefox: moz-extension://<uuid>
 *
 * CI fix:
 *   Prefer CDP Target.getTargets (works in headless CI) and fall back to chrome://extensions scraping.
 */

import { URL } from 'node:url';

let cachedChromeExtensionPath: string | null = null;

type TargetInfo = { type: string; url: string; title?: string };
type GetTargetsResult = { targetInfos?: TargetInfo[] };

function hostFromUrl(raw: string): string | null {
  try {
    return new URL(raw).host || null;
  } catch {
    return null;
  }
}

async function tryResolveChromeExtensionIdViaCdp(browser: WebdriverIO.Browser): Promise<string | null> {
  // Allow explicit override (useful if multiple extensions are loaded).
  const forced = (process.env.RC_EXTENSION_ID ?? process.env.EXTENSION_ID ?? '').trim();
  if (forced) return forced;

  // browser.cdp may not be available depending on WDIO services/driver; treat as optional.
  const cdp = (browser as any)?.cdp;
  if (typeof cdp !== 'function') return null;

  try {
    const res = (await (browser as any).cdp('Target', 'getTargets', {})) as GetTargetsResult;
    const infos = res.targetInfos ?? [];

    const extTargets = infos
      .filter(t => typeof t.url === 'string' && t.url.startsWith('chrome-extension://'))
      .map(t => ({ ...t, id: hostFromUrl(t.url) }))
      .filter(t => !!t.id) as Array<TargetInfo & { id: string }>;

    // Prefer MV3 service worker pointing to background.js
    const preferred =
      extTargets.find(t => t.type === 'service_worker' && /\/background\.js(\?|$)/.test(t.url)) ??
      extTargets.find(t => t.type === 'service_worker') ??
      extTargets[0];

    return preferred?.id ?? null;
  } catch {
    return null;
  }
}

async function resolveChromeExtensionIdViaExtensionsPage(browser: WebdriverIO.Browser): Promise<string> {
  const originalHandle = await browser.getWindowHandle();

  // Open extensions manager in a TAB (not a new window), so it’s less disruptive.
  await browser.newWindow('chrome://extensions/', { type: 'tab' });

  const mgrHandle = await browser.getWindowHandle();
  await browser.switchToWindow(mgrHandle);

  await browser.waitUntil(async () => (await $('extensions-manager').isExisting()) === true, {
    timeout: 10_000,
    timeoutMsg: 'chrome://extensions did not load extensions-manager',
  });

  const extensionId = await (async () => {
    const extensionsManager = await $('extensions-manager').getElement();

    const itemList = await extensionsManager.shadow$('#container > #viewManager > extensions-item-list');
    const firstItem = await itemList.shadow$('extensions-item');

    const id = await firstItem.getAttribute('id');
    return id ?? '';
  })();

  if (!extensionId) {
    const debug = await browser.execute(() => {
      const mgr = document.querySelector('extensions-manager') as any;
      if (!mgr?.shadowRoot) return { hasManager: !!mgr, hasShadowRoot: false };
      const itemList = mgr.shadowRoot.querySelector('#viewManager > extensions-item-list') as any;
      return { hasManager: true, hasShadowRoot: true, hasItemList: !!itemList };
    });

    throw new Error(`Extension ID not found on chrome://extensions. Debug: ${JSON.stringify(debug)}`);
  }

  // Close chrome://extensions tab and go back
  await browser.closeWindow();
  await browser.switchToWindow(originalHandle);

  return extensionId;
}

export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
  if (cachedChromeExtensionPath) return cachedChromeExtensionPath;

  // CI-safe path first
  const cdpId = await tryResolveChromeExtensionIdViaCdp(browser);
  if (cdpId) {
    cachedChromeExtensionPath = `chrome-extension://${cdpId}`;
    return cachedChromeExtensionPath;
  }

  // Fallback for local environments where CDP might not be available
  const uiId = await resolveChromeExtensionIdViaExtensionsPage(browser);
  cachedChromeExtensionPath = `chrome-extension://${uiId}`;
  return cachedChromeExtensionPath;
};

export const getFirefoxExtensionPath = async (browser: WebdriverIO.Browser) => {
  await browser.url('about:debugging#/runtime/this-firefox');

  const uuidElement = await browser.$('//dt[contains(text(), "Internal UUID")]/following-sibling::dd').getElement();

  const internalUUID = await uuidElement.getText();
  if (!internalUUID) throw new Error('Internal UUID not found');

  return `moz-extension://${internalUUID}`;
};
