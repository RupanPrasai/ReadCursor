import { config as baseConfig } from './wdio.conf.js';
import { getChromeExtensionPath, getFirefoxExtensionPath } from '../utils/extension-path.js';
import { IS_CI, IS_FIREFOX } from '@extension/env';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';

const extName = IS_FIREFOX ? '.xpi' : '.zip';
const distZipDir = join(import.meta.dirname, '../../../dist-zip');

const extensions = await readdir(distZipDir);
const latestExtension = extensions.filter(file => extname(file) === extName).at(-1);
if (!latestExtension) throw new Error(`No ${extName} found in ${distZipDir}`);

const extPath = join(distZipDir, latestExtension);

// Only needed for Firefox
const bundledExtension = IS_FIREFOX ? (await readFile(extPath)).toString('base64') : '';

const chromeUserDataDir = join(
  import.meta.dirname,
  `../.tmp/chrome-profile-${Date.now()}-${Math.random().toString(16).slice(2)}`,
);

// Unpack for Chrome so capabilities don't include a giant base64 string
const unpackDir = join(import.meta.dirname, '../.tmp/unpacked-extension');
if (!IS_FIREFOX) {
  await rm(unpackDir, { recursive: true, force: true });
  await mkdir(unpackDir, { recursive: true });
  execFileSync('unzip', ['-q', extPath, '-d', unpackDir]);
}

const chromeCapabilities = {
  browserName: 'chrome',
  acceptInsecureCerts: true,
  'goog:chromeOptions': {
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',

      // critical: avoids profile lock / corrupted temp profile crashes
      `--user-data-dir=${chromeUserDataDir}`,

      // load unpacked extension
      `--load-extension=${unpackDir}`,

      // optional: uncomment if it still exits (gives stderr logs)
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
