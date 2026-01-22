import { createStorage, StorageEnum } from '../base/index.js';

export type ReadCursorPanelMode = 'open' | 'minimized';

export type ReadCursorPanelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ReadCursorUiStateV1 = {
  schemaVersion: 1;

  panelMode: ReadCursorPanelMode;
  panelRect: ReadCursorPanelRect | null;

  // Used only if rememberLastWpm is enabled in prefs (stored here because it’s “state”, not preference)
  lastUsedWpm: number | null;
};

const FALLBACK_UI_STATE: ReadCursorUiStateV1 = {
  schemaVersion: 1,

  panelMode: 'open',
  panelRect: null,

  lastUsedWpm: null,
};

const storage = createStorage<ReadCursorUiStateV1>('readcursor:ui', FALLBACK_UI_STATE, {
  storageEnum: StorageEnum.Local,
  // Same note as prefs: keep false until Step 2.
  liveUpdate: false,
});

export const readCursorUiStateStorage = {
  ...storage,

  setPartial: async (patch: Partial<Omit<ReadCursorUiStateV1, 'schemaVersion'>>) => {
    await storage.set(prev => ({ ...prev, ...patch }));
  },

  reset: async () => {
    await storage.set(FALLBACK_UI_STATE);
  },
};
