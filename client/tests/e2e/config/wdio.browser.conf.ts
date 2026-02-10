import { config as baseConfig } from './wdio.conf.js';
import { getChromeExtensionPath, getFirefoxExtensionPath } from '../utils/extension-path.js';
import { IS_CI, IS_FIREFOX } from '@extension/env';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, rm, stat } from 'node:fs/promises';
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

const getBinVersion = (binary: string) => {
  try {
    return execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return `${binary} unavailable`;
  }
};

const getChromeDriverVersion = () => {
  try {
    return execFileSync('bash', ['-lc', 'chromedriver --version || true'], { encoding: 'utf8' }).trim();
  } catch {
    return 'chromedriver unavailable';
  }
};

const toChromeExtensionId = (manifestKey: string) => {
  const digest = createHash('sha256').update(Buffer.from(manifestKey, 'base64')).digest();
  const alphabet = 'abcdefghijklmnop';
  const chars: string[] = [];

  for (const byte of digest.subarray(0, 16)) {
    chars.push(alphabet[(byte >> 4) & 0x0f]);
    chars.push(alphabet[byte & 0x0f]);
  }

  return chars.join('');
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
  `../.tmp/chrome-profile-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
);

// Unpack for Chrome so capabilities don't include a giant base64 string
const unpackDir = join(import.meta.dirname, '../.tmp/unpacked-extension');

let e2eChromeExtensionId = '';

if (!IS_FIREFOX) {
  await rm(unpackDir, { recursive: true, force: true });
  await mkdir(unpackDir, { recursive: true });
  execFileSync('unzip', ['-q', extPath, '-d', unpackDir]);

  const manifestPath = join(unpackDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { key?: string; version_name?: string };

  if (!manifest.version_name?.includes('-e2e')) {
    throw new Error('E2E manifest missing -e2e marker in version_name. Build with CLI_CEB_E2E=true.');
  }

  if (!manifest.key) {
    throw new Error('E2E manifest missing deterministic key.');
  }

  e2eChromeExtensionId = toChromeExtensionId(manifest.key);
}

const chromeArgs = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-popup-blocking',
  `--user-data-dir=${chromeUserDataDir}`,
  `--load-extension=${unpackDir}`,
  ...(IS_CI ? ['--headless=new'] : []),
];

if (!IS_FIREFOX) {
  console.log('[E2E][WDIO] chrome binary:', systemChrome);
  console.log('[E2E][WDIO] chrome version:', getBinVersion(systemChrome));
  console.log('[E2E][WDIO] chromedriver version:', getChromeDriverVersion());
  console.log('[E2E][WDIO] chrome args:', JSON.stringify(chromeArgs));
  console.log('[E2E][WDIO] chrome user data dir:', chromeUserDataDir);
  console.log('[E2E][WDIO] unpacked extension dir:', unpackDir);
  console.log('[E2E][WDIO] deterministic extension id:', e2eChromeExtensionId);
}

const chromeCapabilities = {
  browserName: 'chrome',
  acceptInsecureCerts: true,
  'goog:chromeOptions': {
    binary: systemChrome,
    args: chromeArgs,
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

  // extension e2e runs are fragile with parallel workers
  maxInstances: 1,
  logLevel: 'error',

  // make spec output not drown in noise
  reporters: [['spec', { onlyFailures: true } as any]],

  outputDir: join(import.meta.dirname, '../.tmp/wdio-logs'),

  execArgv: IS_CI ? [] : ['--inspect'],
  before: async ({ browserName }: WebdriverIO.Capabilities, _specs, browser: WebdriverIO.Browser) => {
    if (browserName === 'firefox') {
      await browser.installAddOn(bundledExtension, true);
      browser.addCommand('getExtensionPath', async () => getFirefoxExtensionPath(browser));
    } else if (browserName === 'chrome') {
      browser.addCommand('getExtensionPath', async () => getChromeExtensionPath(e2eChromeExtensionId));
    }
  },
  afterTest: async () => {
    if (!IS_CI) await browser.pause(200);
  },
};
