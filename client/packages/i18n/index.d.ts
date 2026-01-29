import type { MessageKeyType } from './lib/types.js';

export type {
  I18nValueType,
  LocalesJSONType,
  MessageKeyType,
  SupportedLanguagesKeysType,
  SupportedLanguagesWithoutRegionKeysType,
} from './lib/types.js';

/**
 * Public translation function surface.
 *
 * Defined in a .d.ts entrypoint so dependents can type-check without requiring
 * generated runtime artifacts (e.g. lib/i18n.js).
 */
export declare const t: (key: MessageKeyType, substitutions?: string | string[]) => string;
