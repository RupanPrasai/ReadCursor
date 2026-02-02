/**
 * Returns the Chrome/Firefox extension base URL:
 *  - Chrome:  chrome-extension://<id>
 *  - Firefox: moz-extension://<uuid>
 *
 * CI-safe strategy:
 *   1) RC_EXTENSION_ID / EXTENSION_ID env override
 *   2) Parse Chrome profile Preferences (from --user-data-dir) and match --load-extension path
 *   3) Fallback to chrome://extensions scraping (best-effort; often fails in CI/headless)
 */

import fs from 'node:fs/promises';
import path from 'node:path';

let cachedChromeExtensionPath: string | null = null;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

function normalizeDir(p: string): string {
  return path.resolve(p).replace(/[/\\]+$/, '');
}

function getChromeArgs(browser: WebdriverIO.Browser): string[] {
  const caps: any = (browser as any).capabilities ?? {};
  const opts: any = caps['goog:chromeOptions'] ?? caps['ms:edgeOptions'] ?? {};
  const args = opts.args;
  if (!Array.isArray(args)) return [];
  return args.map(String);
}

function getArgValue(args: string[], name: string): string | null {
  // supports "--flag=value" and "--flag value"
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === name) return args[i + 1] ?? null;
    if (a.startsWith(name + '=')) return a.slice(name.length + 1);
  }
  return null;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function findPreferencesFile(userDataDir: string): Promise<string | null> {
  // Chrome usually writes to Default/Preferences for a fresh profile.
  const candidates = [
    path.join(userDataDir, 'Default', 'Preferences'),
    path.join(userDataDir, 'Profile 1', 'Preferences'),
    path.join(userDataDir, 'Preferences'),
  ];

  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }

  // Chrome writes Preferences shortly after startup; poll briefly.
  for (let i = 0; i < 50; i++) {
    for (const c of candidates) {
      if (await fileExists(c)) return c;
    }
    await sleep(100);
  }

  return null;
}

function parseLoadExtensionPaths(args: string[]): string[] {
  const raw = getArgValue(args, '--load-extension');
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(normalizeDir);
}

async function tryResolveChromeExtensionIdViaPreferences(browser: WebdriverIO.Browser): Promise<string | null> {
  const args = getChromeArgs(browser);

  const userDataDirRaw = getArgValue(args, '--user-data-dir');
  if (!userDataDirRaw) return null;

  const userDataDir = normalizeDir(userDataDirRaw);
  const prefsPath = await findPreferencesFile(userDataDir);
  if (!prefsPath) return null;

  const loadExtRoots = parseLoadExtensionPaths(args);

  let prefs: any;
  try {
    prefs = JSON.parse(await fs.readFile(prefsPath, 'utf8'));
  } catch {
    return null;
  }

  const settings = prefs?.extensions?.settings;
  if (!settings || typeof settings !== 'object') return null;

  // Best: match entry.path to one of the --load-extension dirs.
  if (loadExtRoots.length) {
    for (const [id, entry] of Object.entries<any>(settings)) {
      const entryPath = typeof entry?.path === 'string' ? normalizeDir(entry.path) : null;
      if (!entryPath) continue;

      if (loadExtRoots.includes(entryPath)) return id;

      // Sometimes Chrome stores a subdir; allow prefix match.
      for (const root of loadExtRoots) {
        if (entryPath.startsWith(root + path.sep)) return id;
      }
    }
  }

  // Next best: if only one MV3 extension exists, use it.
  const mv3: string[] = [];
  for (const [id, entry] of Object.entries<any>(settings)) {
    const mv = entry?.manifest?.manifest_version;
    const sw = entry?.manifest?.background?.service_worker;
    if (mv === 3 && typeof sw === 'string') mv3.push(id);
  }
  if (mv3.length === 1) return mv3[0];

  return null;
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

  const extensionsManager = await $('extensions-manager').getElement();
  const itemList = await extensionsManager.shadow$('#container > #viewManager > extensions-item-list');
  const firstItem = await itemList.shadow$('extensions-item');

  const extensionId = (await firstItem.getAttribute('id')) ?? '';

  await browser.closeWindow();
  await browser.switchToWindow(originalHandle);

  if (!extensionId) throw new Error('Extension ID not found on chrome://extensions (UI scrape failed)');
  return extensionId;
}

export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
  if (cachedChromeExtensionPath) return cachedChromeExtensionPath;

  // Explicit override always wins (useful if multiple extensions loaded)
  const forced = (process.env.RC_EXTENSION_ID ?? process.env.EXTENSION_ID ?? '').trim();
  if (forced) {
    cachedChromeExtensionPath = `chrome-extension://${forced}`;
    return cachedChromeExtensionPath;
  }

  // CI-safe: read Preferences from --user-data-dir and match --load-extension
  const prefId = await tryResolveChromeExtensionIdViaPreferences(browser);
  if (prefId) {
    cachedChromeExtensionPath = `chrome-extension://${prefId}`;
    return cachedChromeExtensionPath;
  }

  // Last resort: UI scrape (often fails in CI/headless)
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
