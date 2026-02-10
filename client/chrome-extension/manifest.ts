import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

const IS_E2E = process.env.CEB_E2E === 'true' || process.env.CLI_CEB_E2E === 'true' || process.env.E2E === 'true';

const E2E_EXTENSION_KEY =
  process.env.CEB_E2E_EXTENSION_KEY ??
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3gRMbElWUfOoQzXrYatVHn8YT+bHfYPylUjrUHcSVaAy3tNSyJZwByi4WwjR2EscCm3PGRRNBvSa2UMAhTTDUiSumegojvsWhlqqGt/lBScFcgCrVyu6anvabC9/rjMIGVeLNjExKR1exYtHmoMlvtiOtGiGEPWOUtaPvofEeBpnqIB+/C1iuTbEBuJqW/kVa6J6r2K4cgIRVejGpsY/yWUMBhKfZgxDD+mtd7yyyZPeK0BVfZH8dG6fAlThPtUVyXeJj2rGCa7vy8FkfGZGHtLSR8993quZw4mpzWaYff/4nj4fcqngW5BUFouloUGT4KiuvQ5BmcGdXDmIkNsQ8QIDAQAB';

const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  version: packageJson.version,

  // Mark E2E builds so background can safely gate E2E-only hooks.
  ...(IS_E2E ? { version_name: `${packageJson.version}-e2e`, key: E2E_EXTENSION_KEY } : {}),

  description: '__MSG_extensionDescription__',
  permissions: [
    'storage',
    'scripting',
    'contextMenus',
    'activeTab',
    'notifications',
    ...(IS_E2E ? ['tabs'] : []),
  ],

  // E2E-only host permissions so executeScript works deterministically in tests
  // (no reliance on activeTab being granted).
  ...(IS_E2E
    ? {
        host_permissions: ['http://127.0.0.1/*', 'http://localhost/*'],
      }
    : {}),

  options_page: 'options/index.html',
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_popup: 'popup/index.html',
    default_icon: {
      '16': 'icon16.png',
      '32': 'icon32.png',
      '48': 'icon48.png',
      '128': 'icon128.png',
    },
  },
  icons: {
    '16': 'icon16.png',
    '32': 'icon32.png',
    '48': 'icon48.png',
    '128': 'icon128.png',
  },
} satisfies ManifestType;

export default manifest;
