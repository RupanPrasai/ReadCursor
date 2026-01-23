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
};

const FALLBACK_UI_STATE: ReadCursorUiStateV1 = {
  schemaVersion: 1,
  panelMode: 'open',
  panelRect: null,
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sanitizeRect(rect: ReadCursorPanelRect | null): ReadCursorPanelRect | null {
  if (!rect) return null;

  const { left, top, width, height } = rect;

  if (![left, top, width, height].every(isFiniteNum)) return null;

  // Defensive constraints (don’t persist insane values)
  const w = clamp(Math.trunc(width), 240, 1200);
  const h = clamp(Math.trunc(height), 140, 1000);

  // Allow offscreen slightly, but not absurdly
  const l = clamp(Math.trunc(left), -2000, 20000);
  const t = clamp(Math.trunc(top), -2000, 20000);

  return { left: l, top: t, width: w, height: h };
}

function sanitize(next: ReadCursorUiStateV1): ReadCursorUiStateV1 {
  const mode: ReadCursorPanelMode = next.panelMode === 'minimized' ? 'minimized' : 'open';

  return {
    schemaVersion: 1,
    panelMode: mode,
    panelRect: sanitizeRect(next.panelRect),
  };
}

const storage = createStorage<ReadCursorUiStateV1>('readcursor:ui', FALLBACK_UI_STATE, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const readCursorUiStateStorage = {
  ...storage,

  defaults: FALLBACK_UI_STATE,

  setPartial: async (patch: Partial<Omit<ReadCursorUiStateV1, 'schemaVersion'>>) => {
    await storage.set(prev =>
      sanitize({ ...(prev ?? FALLBACK_UI_STATE), ...patch, schemaVersion: 1 } as ReadCursorUiStateV1),
    );
  },

  reset: async () => {
    await storage.set(FALLBACK_UI_STATE);
  },
};
