import type { MessageKeyType } from './types.js';

/**
 * Type-only declaration for the runtime-generated module `./i18n.js`.
 *
 * In production builds, `dist/lib/i18n.js` is generated.
 * During `tsc --noEmit`, this shim lets TypeScript resolve the specifier.
 */
export declare const t: (key: MessageKeyType, substitutions?: string | string[]) => string;

