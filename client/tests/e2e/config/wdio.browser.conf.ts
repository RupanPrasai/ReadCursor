import { config as baseConfig } from './wdio.conf.js';
import { getChromeExtensionPath, getFirefoxExtensionPath } from '../utils/extension-path.js';
import { IS_CI, IS_FIREFOX } from '@extension/env';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

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

const chromeUserDataDir = join(
  import.meta.dirname,
  `../.tmp/chrome-profile-${Date.now()}-${Math.random().toString(16).slice(2)}`,
);

// Unpack for Chrome so capabilities don't include a giant base64 string
const unpackDir = join(import.meta.dirname, '../.tmp/unpacked-extension');

const patchManifestForE2E = async (dir: string) => {
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  manifest.host_permissions = Array.from(
    new Set([...(manifest.host_permissions ?? []), 'http://127.0.0.1/*', 'http://localhost/*']),
  );

  // optional but helpful (tab.url access etc.)
  manifest.permissions = Array.from(new Set([...(manifest.permissions ?? []), 'tabs']));

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
};

if (!IS_FIREFOX) {
  await rm(unpackDir, { recursive: true, force: true });
  await mkdir(unpackDir, { recursive: true });
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

      // critical: avoids profile lock / corrupted temp profile crashes
      `--user-data-dir=${chromeUserDataDir}`,

      // load unpacked extension
      `--load-extension=${unpackDir}`,

      // '--enable-logging=stderr',
      // '--v=1',

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

  // keep output readable while stabilizing
  maxInstances: 1,
  logLevel: 'error',

  // make spec output not drown in noise
  reporters: [['spec', { onlyFailures: true } as any]],

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
