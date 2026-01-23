import { extractWordGeometryFromReadableNodes } from './dom/ReadableWords';
import { ReaderPanel } from './gui/ReaderPanel';
import { ReaderController } from './readerEngine/controller';
import { readCursorPrefsStorage } from '@extension/storage';
import { useEffect, useState, useRef, useCallback } from 'react';
import type { WordGeometry } from './readerEngine/Highlighter';
import type { ReadCursorPrefsV1 } from '@extension/storage';

interface AppProps {
  destroyCallback: () => void;
  wordGeometry: WordGeometry[];
}

function getViewportSignature(): string {
  const vv = window.visualViewport;

  const parts = [
    window.innerWidth,
    window.innerHeight,
    document.documentElement.clientWidth,
    document.documentElement.clientHeight,
    window.devicePixelRatio,
    vv ? vv.width : 'no-vv',
    vv ? vv.height : 'no-vv',
    vv ? vv.scale : 'no-vv',
  ];

  return parts.join('|');
}

function isE2EBuild(): boolean {
  try {
    const vn = (globalThis as any)?.chrome?.runtime?.getManifest?.()?.version_name;
    return typeof vn === 'string' && vn.includes('-e2e');
  } catch {
    return false;
  }
}

function bumpDocCounter(datasetKey: 'rcE2eInit' | 'rcE2eDispose' | 'rcE2eRebuild'): number {
  const el = document.documentElement;
  const raw = el.dataset[datasetKey];
  const next = (raw ? Number(raw) : 0) + 1;
  el.dataset[datasetKey] = String(next);
  return next;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== 'string') return null;
  const s = hex.trim().toLowerCase();
  const m = /^#([0-9a-f]{6})$/.exec(s);
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return { r, g, b };
}

function applyHighlightColorVars(hex: string) {
  const rgb = parseHexColor(hex);
  if (!rgb) return;

  // word highlight: stronger
  document.documentElement.style.setProperty('--rc-word-hl', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
  // block highlight: subtler
  document.documentElement.style.setProperty('--rc-block-hl', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
}

function computeInitialWpm(prefs: ReadCursorPrefsV1 | null): number {
  if (!prefs) return 150;
  return prefs.rememberLastWpm ? prefs.lastWpm : prefs.defaultWpm;
}

export default function App({ destroyCallback, wordGeometry }: AppProps) {
  const [controller] = useState(() => new ReaderController());

  // prefs state + ref for use inside callbacks
  const [prefs, setPrefs] = useState<ReadCursorPrefsV1 | null>(null);
  const prefsRef = useRef<ReadCursorPrefsV1 | null>(null);

  // pending start ctx (used for: init-before-load & rebuild-in-flight)
  const pendingStartRef = useRef<any>(null);

  const loadedRef = useRef(false);

  const lastSigRef = useRef<string | null>(null);
  const rebuildTimerRef = useRef<number | null>(null);
  const rebuildInFlightRef = useRef(false);

  // debounce for persisting lastWpm
  const persistWpmTimerRef = useRef<number | null>(null);
  const lastQueuedWpmRef = useRef<number | null>(null);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Load prefs + subscribe to updates
  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      try {
        const next = await readCursorPrefsStorage.get();
        if (!alive) return;
        setPrefs(next);
      } catch {
        // ignore; runtime should still function with defaults
      }
    };

    void refresh();

    const unsub = readCursorPrefsStorage.subscribe(() => {
      void refresh();
    });

    return () => {
      alive = false;
      unsub();
    };
  }, []);

  // Apply prefs when they change (safe before/after geometry load)
  useEffect(() => {
    if (!prefs) return;

    applyHighlightColorVars(prefs.highlightColor);

    // Auto-scroll (no-op if you haven't added the method on controller yet)
    (controller as any).setAutoScrollEnabled?.(prefs.autoScrollEnabled);

    if (loadedRef.current) {
      controller.setWPM(computeInitialWpm(prefs));
    }
  }, [prefs, controller]);

  // Persist lastWpm when controller WPM changes (only if rememberLastWpm is enabled)
  useEffect(() => {
    const schedulePersistLastWpm = (wpm: number) => {
      const p = prefsRef.current;
      if (!p?.rememberLastWpm) return;

      // avoid spamming writes
      if (p.lastWpm === wpm) return;
      if (lastQueuedWpmRef.current === wpm) return;

      lastQueuedWpmRef.current = wpm;

      if (persistWpmTimerRef.current != null) {
        window.clearTimeout(persistWpmTimerRef.current);
      }

      persistWpmTimerRef.current = window.setTimeout(async () => {
        persistWpmTimerRef.current = null;
        try {
          await readCursorPrefsStorage.setPartial({ lastWpm: wpm });
        } catch {
          // ignore storage failures
        }
      }, 450);
    };

    let lastSeenWpm = controller.getStatus().wpm;

    const unsub = controller.subscribe(() => {
      const wpm = controller.getStatus().wpm;
      if (wpm === lastSeenWpm) return;
      lastSeenWpm = wpm;
      schedulePersistLastWpm(wpm);
    });

    return () => {
      unsub();
      if (persistWpmTimerRef.current != null) {
        window.clearTimeout(persistWpmTimerRef.current);
        persistWpmTimerRef.current = null;
      }
    };
  }, [controller]);

  // E2E counters + instance marker
  useEffect(() => {
    if (!isE2EBuild()) return;

    const initN = bumpDocCounter('rcE2eInit');

    const host = document.getElementById('__ROOT_READERPANEL__');
    if (host) host.setAttribute('data-rc-instance', String(initN));

    return () => {
      if (!isE2EBuild()) return;
      bumpDocCounter('rcE2eDispose');
    };
  }, []);

  const clearRebuildTimer = useCallback(() => {
    if (rebuildTimerRef.current != null) {
      window.clearTimeout(rebuildTimerRef.current);
      rebuildTimerRef.current = null;
    }
  }, []);

  const rebuildNow = useCallback(
    (reason: string, prevSig: string | null, nextSig: string) => {
      if (!loadedRef.current) return;
      if (rebuildInFlightRef.current) return;

      rebuildInFlightRef.current = true;
      try {
        const blocks = Array.from(document.querySelectorAll('.rc-highlightable[data-rcid]')) as Element[];

        if (!blocks.length) {
          console.log('[ReadCursor][viewport] rebuild skipped: no .rc-highlightable blocks found');
          lastSigRef.current = nextSig;
          return;
        }

        const t0 = performance.now();
        const nextWords = extractWordGeometryFromReadableNodes(blocks) as WordGeometry[];
        controller.reloadGeometry(nextWords);

        if (isE2EBuild()) {
          bumpDocCounter('rcE2eRebuild');
        }
        const dt = Math.round(performance.now() - t0);

        console.log(
          `[ReadCursor][viewport] rebuild (${reason}) ${prevSig ?? 'null'} -> ${nextSig} blocks=${blocks.length} words=${nextWords.length} ${dt}ms`,
        );

        lastSigRef.current = nextSig;
      } finally {
        rebuildInFlightRef.current = false;

        // If a startHere call came in while rebuilding, run it now against fresh geometry.
        if (pendingStartRef.current && loadedRef.current) {
          const ctx = pendingStartRef.current;
          pendingStartRef.current = null;
          controller.startFromHere(ctx);
        }
      }
    },
    [controller],
  );

  // Initial load
  useEffect(() => {
    if (loadedRef.current) return;
    if (!wordGeometry?.length) return;

    controller.load(wordGeometry);

    const p = prefsRef.current;
    controller.setWPM(computeInitialWpm(p));
    if (p) {
      applyHighlightColorVars(p.highlightColor);
      (controller as any).setAutoScrollEnabled?.(p.autoScrollEnabled);
    }

    loadedRef.current = true;

    // establish baseline at the moment geometry is considered "valid"
    lastSigRef.current = getViewportSignature();

    if (pendingStartRef.current) {
      controller.startFromHere(pendingStartRef.current);
      pendingStartRef.current = null;
    }
  }, [controller, wordGeometry]);

  // Start-from-here event (prefs-gated)
  useEffect(() => {
    const onStartHere = (event: any) => {
      const p = prefsRef.current;
      if (p && p.startFromSelectionEnabled === false) return;

      const lastCtx = event?.detail?.lastCtx;
      if (!lastCtx) return;

      if (!loadedRef.current) {
        pendingStartRef.current = lastCtx;
        return;
      }

      const nextSig = getViewportSignature();
      const prevSig = lastSigRef.current;

      if (prevSig !== nextSig) {
        clearRebuildTimer();

        if (rebuildInFlightRef.current) {
          pendingStartRef.current = lastCtx;
          return;
        }

        rebuildNow('startHere', prevSig, nextSig);
      }

      controller.startFromHere(lastCtx);
    };

    window.addEventListener('readcursor:startHere', onStartHere);
    return () => window.removeEventListener('readcursor:startHere', onStartHere);
  }, [controller, rebuildNow, clearRebuildTimer]);

  // Viewport signature rebuild
  useEffect(() => {
    const requestRebuildIfNeeded = (reason: string) => {
      if (!loadedRef.current) return;

      const nextSig = getViewportSignature();
      const prevSig = lastSigRef.current;

      if (prevSig === nextSig) return;

      clearRebuildTimer();
      rebuildTimerRef.current = window.setTimeout(() => {
        rebuildNow(reason, prevSig, nextSig);
      }, 150);
    };

    const onWindowResize = () => requestRebuildIfNeeded('window.resize');
    const onVVResize = () => requestRebuildIfNeeded('visualViewport.resize');
    const onVVScroll = () => requestRebuildIfNeeded('visualViewport.scroll');

    window.addEventListener('resize', onWindowResize);
    window.visualViewport?.addEventListener('resize', onVVResize);
    window.visualViewport?.addEventListener('scroll', onVVScroll);

    return () => {
      clearRebuildTimer();
      window.removeEventListener('resize', onWindowResize);
      window.visualViewport?.removeEventListener('resize', onVVResize);
      window.visualViewport?.removeEventListener('scroll', onVVScroll);
    };
  }, [rebuildNow, clearRebuildTimer]);

  useEffect(() => () => controller.stop(), [controller]);

  const handleDestroy = () => {
    controller.stop();
    destroyCallback();
  };

  return (
    <div className="app-container">
      <ReaderPanel onDestroy={handleDestroy} controller={controller} />
    </div>
  );
}
