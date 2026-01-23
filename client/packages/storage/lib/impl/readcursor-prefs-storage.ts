import { createStorage, StorageEnum } from '../base/index.js';

export type ReadCursorPrefsV1 = {
  schemaVersion: 1;

  // Playback
  defaultWpm: number;
  rememberLastWpm: boolean;
  lastWpm: number; // persisted “most recently used” speed

  // Highlight
  highlightColor: string; // "#RRGGBB"

  // Behavior
  autoScrollEnabled: boolean;
  startFromSelectionEnabled: boolean;

  // UI persistence toggles
  rememberPanelState: boolean;
};

const MIN_WPM = 50;
const MAX_WPM = 350;

function clampInt(n: unknown, min: number, max: number) {
  const num = typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, num));
}

function normalizeHexColor(v: unknown, fallback: string) {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  const withHash = s.startsWith('#') ? s : `#${s}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : fallback;
}

const FALLBACK_PREFS: ReadCursorPrefsV1 = {
  schemaVersion: 1,

  defaultWpm: 150,
  rememberLastWpm: true,
  lastWpm: 150,

  highlightColor: '#f59e0b',

  autoScrollEnabled: true,
  startFromSelectionEnabled: true,

  rememberPanelState: true,
};

function sanitize(next: ReadCursorPrefsV1): ReadCursorPrefsV1 {
  const defaultWpm = clampInt(next.defaultWpm, MIN_WPM, MAX_WPM);
  const lastWpm = clampInt(next.lastWpm, MIN_WPM, MAX_WPM);

  return {
    schemaVersion: 1,

    defaultWpm,
    rememberLastWpm: !!next.rememberLastWpm,
    lastWpm,

    highlightColor: normalizeHexColor(next.highlightColor, FALLBACK_PREFS.highlightColor),

    autoScrollEnabled: !!next.autoScrollEnabled,
    startFromSelectionEnabled: !!next.startFromSelectionEnabled,

    rememberPanelState: !!next.rememberPanelState,
  };
}

const storage = createStorage<ReadCursorPrefsV1>('readcursor:prefs', FALLBACK_PREFS, {
  storageEnum: StorageEnum.Sync,
  liveUpdate: true,
});

export const readCursorPrefsStorage = {
  ...storage,

  defaults: FALLBACK_PREFS,

  setPartial: async (patch: Partial<Omit<ReadCursorPrefsV1, 'schemaVersion'>>) => {
    await storage.set(prev =>
      sanitize({ ...(prev ?? FALLBACK_PREFS), ...patch, schemaVersion: 1 } as ReadCursorPrefsV1),
    );
  },

  reset: async () => {
    await storage.set(FALLBACK_PREFS);
  },
};
