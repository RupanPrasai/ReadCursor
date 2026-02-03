import { config as baseConfig } from './wdio.conf.js';
import { getChromeExtensionPath, getFirefoxExtensionPath } from '../utils/extension-path.js';
import { IS_CI as ENV_IS_CI, IS_FIREFOX } from '@extension/env';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { readdir, readFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const IS_CI = ENV_IS_CI || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

const findSystemChrome = () => {
  if (process.env.CHROME_BINARY) return process.env.CHROME_BINARY;

  try {
    return execFileSync(
      'bash',
      [
        '-lc',
        'command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser',
      ],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return '';
  }
};

const systemChrome = !IS_FIREFOX ? findSystemChrome() : '';
if (!IS_FIREFOX && !systemChrome) {
  throw new Error(
    'No system Chrome/Chromium found. Install google-chrome-stable or chromium, or set CHROME_BINARY=/path/to/chrome',
  );
}

// Per-process uniqueness (works whether WDIO runs 1 or N workers)
const uniq = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`;

const extName = IS_FIREFOX ? '.xpi' : '.zip';
const distZipDir = join(import.meta.dirname, '../../../dist-zip');

const entries = (await readdir(distZipDir)).filter(f => extname(f) === extName);
if (!entries.length) throw new Error(`No ${extName} found in ${distZipDir}`);

const withTimes = await Promise.all(
  entries.map(async f => ({
    f,
    mtimeMs: (await stat(join(distZipDir, f))).mtimeMs,
  })),
);

withTimes.sort((a, b) => a.mtimeMs - b.mtimeMs);
const latestExtension = withTimes.at(-1)!.f;

const extPath = join(distZipDir, latestExtension);

// Only needed for Firefox
const bundledExtension = IS_FIREFOX ? (await readFile(extPath)).toString('base64') : '';

const chromeUserDataDir = join(import.meta.dirname, `../.tmp/chrome-profile-${uniq}`);

// Unpack for Chrome so capabilities don't include a giant base64 string
const unpackDir = join(import.meta.dirname, `../.tmp/unpacked-extension-${uniq}`);

// Ensure a deterministic-per-run key for Chrome extension ID.
// We generate a new keypair if none is set; we only need the public key (DER -> base64).
const ensureE2EKey = () => {
  const existing = (process.env.RC_E2E_EXTENSION_KEY ?? '').trim();
  if (existing) return existing;

  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, // unused, but required by API
  });

  const b64 = Buffer.from(publicKey).toString('base64');
  process.env.RC_E2E_EXTENSION_KEY = b64;
  return b64;
};

const patchManifestForE2E = async (dir: string) => {
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  // Mark as E2E so background can safely enable E2E-only hooks.
  manifest.version_name = `${manifest.version ?? '0.0.0'}-e2e`;

  manifest.host_permissions = Array.from(
    new Set([...(manifest.host_permissions ?? []), 'http://127.0.0.1/*', 'http://localhost/*']),
  );

  // required for background to read tab.url and locate fixture tab by URL prefix
  manifest.permissions = Array.from(new Set([...(manifest.permissions ?? []), 'tabs']));

  // Critical: make Chrome extension ID deterministic-per-run (avoids chrome://extensions scraping in CI).
  // This is safe because it's only applied to the unpacked temp extension.
  manifest.key = ensureE2EKey();

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
};

if (!IS_FIREFOX) {
  await rm(unpackDir, { recursive: true, force: true });
  await mkdir(unpackDir, { recursive: true });

  // unzip must exist on ubuntu-latest; if you ever run locally without it, install unzip.
  execFileSync('unzip', ['-q', extPath, '-d', unpackDir]);

  await patchManifestForE2E(unpackDir);
}

const chromeCapabilities = {
  browserName: 'chrome',
  acceptInsecureCerts: true,
  'goog:chromeOptions': {
    binary: systemChrome,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-popup-blocking',

      // Avoid tiny headless viewport weirdness
      '--window-size=1920,1080',

      // critical: avoids profile lock / corrupted temp profile crashes
      `--user-data-dir=${chromeUserDataDir}`,

      // load ONLY our unpacked extension
      `--disable-extensions-except=${unpackDir}`,
      `--load-extension=${unpackDir}`,

      ...(IS_CI ? ['--headless=new'] : []),
    ],
    prefs: { 'extensions.ui.developer_mode': true },
  },
};

const firefoxCapabilities = {
  browserName: 'firefox',
  acceptInsecureCerts: true,
  'moz:firefoxOptions': {
    args: [...(IS_CI ? ['--headless'] : [])],
  },
};

export const config: WebdriverIO.Config = {
  ...baseConfig,
  capabilities: IS_FIREFOX ? [firefoxCapabilities] : [chromeCapabilities],

  // Keep stable and readable
  maxInstances: 1,
  logLevel: 'error',
  reporters: [['spec', { onlyFailures: true } as any]],

  // Don’t accidentally enable inspector in CI (your logs show it was happening)
  execArgv: IS_CI ? [] : ['--inspect'],

  before: async ({ browserName }: WebdriverIO.Capabilities, _specs, browser: WebdriverIO.Browser) => {
    if (browserName === 'firefox') {
      await browser.installAddOn(bundledExtension, true);
      browser.addCommand('getExtensionPath', async () => getFirefoxExtensionPath(browser));
    } else if (browserName === 'chrome') {
      browser.addCommand('getExtensionPath', async () => getChromeExtensionPath(browser));
    }
  },

  afterTest: async () => {
    if (!IS_CI) await browser.pause(200);
  },
};
