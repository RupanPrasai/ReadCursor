import { config as baseConfig } from './wdio.conf.js';
import { getChromeExtensionPath, getFirefoxExtensionPath } from '../utils/extension-path.js';
import { IS_CI, IS_FIREFOX } from '@extension/env';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, rm, access } from 'node:fs/promises';
import { extname, join } from 'node:path';

const findSystemChrome = (): string => {
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
// Guard against regressions where WDIO tries to use its downloaded /tmp/chrome build again.
if (!IS_FIREFOX && systemChrome.includes('/tmp/chrome')) {
  throw new Error(
    `Refusing to use downloaded Chrome at ${systemChrome}. Use system Chrome/Chromium or set CHROME_BINARY.`,
  );
}

const extName = IS_FIREFOX ? '.xpi' : '.zip';
const distZipDir = join(import.meta.dirname, '../../../dist-zip');

const allFiles = await readdir(distZipDir);
const candidates = allFiles.filter(f => extname(f) === extName).sort();
const latestExtension = candidates.at(-1);
if (!latestExtension) throw new Error(`No ${extName} found in ${distZipDir}`);

const extPath = join(distZipDir, latestExtension);

// Firefox needs base64 for installAddOn
const bundledExtension = IS_FIREFOX ? (await readFile(extPath)).toString('base64') : '';

// Unpack for Chrome so we can use --load-extension (avoids base64 noise)
const unpackDir = join(import.meta.dirname, '../.tmp/unpacked-extension');
if (!IS_FIREFOX) {
  await rm(unpackDir, { recursive: true, force: true });
  await mkdir(unpackDir, { recursive: true });

  // Assumes unzip is available (typical on WSL2).
  execFileSync('unzip', ['-q', extPath, '-d', unpackDir]);

  // Sanity check: manifest.json should exist at root (your zip is flat, but keep this guard).
  try {
    await access(join(unpackDir, 'manifest.json'));
  } catch {
    throw new Error(
      `Unpacked extension missing manifest.json at ${unpackDir}. Check dist-zip contents / unzip output.`,
    );
  }
}

const chromeCapabilities = {
  browserName: 'chrome',
  acceptInsecureCerts: true,
  'goog:chromeOptions': {
    binary: systemChrome,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',

      // Load unpacked MV3 extension
      `--load-extension=${unpackDir}`,

      // Useful if you ever need Chrome logs:
      // '--enable-logging=stderr',
      // '--v=1',

      ...(IS_CI ? ['--headless=new'] : []),
    ],
    prefs: {
      'extensions.ui.developer_mode': true,
    },
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

  // Stabilize first; increase later once everything passes reliably.
  maxInstances: 1,
  logLevel: 'error',

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
