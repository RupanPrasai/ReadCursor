import { createStorage, StorageEnum } from '../base/index.js';

export type ReadCursorPrefsV1 = {
  schemaVersion: 1;

  // Playback
  defaultWpm: number;
  rememberLastWpm: boolean;

  // Highlight
  highlightColor: string; // CSS color string (e.g. "#22c55e")

  // Behavior
  autoScrollEnabled: boolean;
  startFromSelectionEnabled: boolean;

  // UI persistence toggles
  rememberPanelState: boolean;
};

const FALLBACK_PREFS: ReadCursorPrefsV1 = {
  schemaVersion: 1,

  defaultWpm: 150,
  rememberLastWpm: true,

  highlightColor: '#f59e0b', // amber-ish default; change whenever

  autoScrollEnabled: true,
  startFromSelectionEnabled: true,

  rememberPanelState: true,
};

const storage = createStorage<ReadCursorPrefsV1>('readcursor:prefs', FALLBACK_PREFS, {
  storageEnum: StorageEnum.Sync,
  // NOTE: leave false for now; your current liveUpdate implementation is likely wrong.
  // We'll fix liveUpdate in Step 2, then you can flip this to true.
  liveUpdate: false,
});

export const readCursorPrefsStorage = {
  ...storage,

  // Small helpers to reduce repetitive get/set patterns later.
  setPartial: async (patch: Partial<Omit<ReadCursorPrefsV1, 'schemaVersion'>>) => {
    await storage.set(prev => ({ ...prev, ...patch }));
  },

  reset: async () => {
    await storage.set(FALLBACK_PREFS);
  },
};
