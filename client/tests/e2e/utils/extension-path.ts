/**
 * Returns the Chrome/Firefox extension base URL:
 *  - Chrome:  chrome-extension://<id>
 *  - Firefox: moz-extension://<uuid>
 *
 * CI-safe strategy:
 *   1) env override (RC_EXTENSION_ID / EXTENSION_ID)
 *   2) resolve ID from Chrome profile Preferences using:
 *        - --user-data-dir
 *        - --load-extension (or --disable-extensions-except)
 *   3) optional CDP Target.getTargets (if available)
 *   4) last-resort: chrome://extensions scraping (kept for local/manual fallback)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
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

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function getChromeArgs(browser: WebdriverIO.Browser): string[] {
  const caps: any = browser.capabilities ?? {};
  const opts = caps['goog:chromeOptions'] ?? caps['chromeOptions'] ?? {};
  const args = Array.isArray(opts.args) ? opts.args : [];
  return args;
}

function pickArgValue(args: string[], prefix: string): string | null {
  const hit = args.find(a => typeof a === 'string' && a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length).trim() || null;
}

function normalizeFsPath(p: string): string {
  // Normalize for Linux/Windows paths and remove trailing slashes.
  return path.resolve(p).replace(/[\\\/]+$/, '');
}

function resolveUserDataDir(browser: WebdriverIO.Browser): string | null {
  const env = (
    process.env.RC_USER_DATA_DIR ??
    process.env.USER_DATA_DIR ??
    process.env.CHROME_USER_DATA_DIR ??
    ''
  ).trim();
  if (env) return env;

  const args = getChromeArgs(browser);
  const fromArg = pickArgValue(args, '--user-data-dir=');
  return fromArg;
}

function resolveLoadedExtensionDir(browser: WebdriverIO.Browser): string | null {
  const env = (
    process.env.RC_EXTENSION_DIR ??
    process.env.EXTENSION_DIR ??
    process.env.EXTENSION_PATH ??
    process.env.RC_EXTENSION_PATH ??
    ''
  ).trim();
  if (env) return env;

  const args = getChromeArgs(browser);

  const load = pickArgValue(args, '--load-extension=');
  if (load) return load.split(',')[0]?.trim() || null;

  const except = pickArgValue(args, '--disable-extensions-except=');
  if (except) return except.split(',')[0]?.trim() || null;

  return null;
}

async function findPreferencesPath(userDataDir: string): Promise<string | null> {
  // Chrome profiles commonly live in these dirs.
  const candidates = [
    path.join(userDataDir, 'Default', 'Preferences'),
    path.join(userDataDir, 'Profile 1', 'Preferences'),
    path.join(userDataDir, 'Profile 2', 'Preferences'),
  ];

  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue
    }
  }

  // Sometimes userDataDir already points at a profile dir.
  const direct = path.join(userDataDir, 'Preferences');
  try {
    await fs.access(direct);
    return direct;
  } catch {
    return null;
  }
}

function looksLikeReadCursorManifest(m: any): boolean {
  // Heuristic: match stable fields in your MV3 manifest.
  // (These should be true for your extension and unlikely for random others.)
  return (
    m &&
    m.manifest_version === 3 &&
    m.background?.service_worker === 'background.js' &&
    m.action?.default_popup === 'popup/index.html' &&
    m.options_page === 'options/index.html'
  );
}

async function resolveChromeExtensionIdViaPreferences(browser: WebdriverIO.Browser): Promise<string | null> {
  const userDataDir = resolveUserDataDir(browser);
  if (!userDataDir) return null;

  const prefsPath = await findPreferencesPath(userDataDir);
  if (!prefsPath) return null;

  const extDirRaw = resolveLoadedExtensionDir(browser);
  const extDir = extDirRaw ? normalizeFsPath(extDirRaw) : null;

  const started = Date.now();
  const timeoutMs = 15_000;

  while (Date.now() - started < timeoutMs) {
    try {
      const raw = await fs.readFile(prefsPath, 'utf8');
      const prefs = JSON.parse(raw);

      const settings: Record<string, any> | undefined = prefs?.extensions?.settings;
      if (!settings) {
        await delay(250);
        continue;
      }

      // 1) Best: match by unpacked extension path.
      if (extDir) {
        for (const [id, entry] of Object.entries(settings)) {
          const p = entry?.path;
          if (typeof p === 'string' && normalizeFsPath(p) === extDir) {
            return id;
          }
        }
      }

      // 2) Fallback: if only one extension matches our manifest signature, use it.
      const candidates: string[] = [];
      for (const [id, entry] of Object.entries(settings)) {
        const m = entry?.manifest;
        if (looksLikeReadCursorManifest(m)) candidates.push(id);
      }
      if (candidates.length === 1) return candidates[0];

      await delay(250);
    } catch {
      await delay(250);
    }
  }

  // If we got here, it’s either not loaded or paths don’t match.
  // Return null and let downstream fallbacks run (CDP / chrome://extensions).
  return null;
}

async function tryResolveChromeExtensionIdViaCdp(browser: WebdriverIO.Browser): Promise<string | null> {
  const forced = (process.env.RC_EXTENSION_ID ?? process.env.EXTENSION_ID ?? '').trim();
  if (forced) return forced;

  const cdp = (browser as any)?.cdp;
  if (typeof cdp !== 'function') return null;

  try {
    const res = (await (browser as any).cdp('Target', 'getTargets', {})) as GetTargetsResult;
    const infos = res.targetInfos ?? [];

    const extTargets = infos
      .filter(t => typeof t.url === 'string' && t.url.startsWith('chrome-extension://'))
      .map(t => ({ ...t, id: hostFromUrl(t.url) }))
      .filter(t => !!t.id) as Array<TargetInfo & { id: string }>;

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

  await browser.closeWindow();
  await browser.switchToWindow(originalHandle);

  if (!extensionId) {
    const args = getChromeArgs(browser);
    const debug = await browser.execute(() => {
      const mgr = document.querySelector('extensions-manager') as any;
      if (!mgr?.shadowRoot) return { hasManager: !!mgr, hasShadowRoot: false };
      const itemList = mgr.shadowRoot.querySelector('#viewManager > extensions-item-list') as any;
      return { hasManager: true, hasShadowRoot: true, hasItemList: !!itemList };
    });

    throw new Error(
      `Extension ID not found on chrome://extensions. Debug=${JSON.stringify(debug)} chromeArgs=${JSON.stringify(args)}`,
    );
  }

  return extensionId;
}

export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
  if (cachedChromeExtensionPath) return cachedChromeExtensionPath;

  // 0) Explicit override
  const forced = (process.env.RC_EXTENSION_ID ?? process.env.EXTENSION_ID ?? '').trim();
  if (forced) {
    cachedChromeExtensionPath = `chrome-extension://${forced}`;
    return cachedChromeExtensionPath;
  }

  // 1) CI-safe: read from Preferences (does not require chrome:// pages or CDP)
  const prefsId = await resolveChromeExtensionIdViaPreferences(browser);
  if (prefsId) {
    cachedChromeExtensionPath = `chrome-extension://${prefsId}`;
    return cachedChromeExtensionPath;
  }

  // 2) Optional: CDP (if enabled in your WDIO setup)
  const cdpId = await tryResolveChromeExtensionIdViaCdp(browser);
  if (cdpId) {
    cachedChromeExtensionPath = `chrome-extension://${cdpId}`;
    return cachedChromeExtensionPath;
  }

  // 3) Last resort: UI scraping (kept for local fallback)
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
