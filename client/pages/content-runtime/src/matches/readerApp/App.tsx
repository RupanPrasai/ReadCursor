import { extractWordGeometryFromReadableNodes } from './dom/ReadableWords';
import { ReaderPanel } from './gui/ReaderPanel';
import { ReaderController } from './readerEngine/controller';
import { useEffect, useState, useRef, useCallback } from 'react';
import type { WordGeometry } from './readerEngine/Highlighter';

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

function bumpDocCounter(datasetKey: 'rcE2eInit' | 'rcE2eDispose'): number {
  const el = document.documentElement;
  const raw = el.dataset[datasetKey];
  const next = (raw ? Number(raw) : 0) + 1;
  el.dataset[datasetKey] = String(next);
  return next;
}

export default function App({ destroyCallback, wordGeometry }: AppProps) {
  const [controller] = useState(() => new ReaderController());

  // pending start ctx (used for: init-before-load & rebuild-in-flight)
  const pendingStartRef = useRef<any>(null);

  const loadedRef = useRef(false);

  const lastSigRef = useRef<string | null>(null);
  const rebuildTimerRef = useRef<number | null>(null);
  const rebuildInFlightRef = useRef(false);

  useEffect(() => {
    if (!isE2EBuild()) return;

    // visible from page world via DOM attributes (WDIO browser.execute)
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
          lastSigRef.current = nextSig; // prevent tight loops
          return;
        }

        const t0 = performance.now();
        const nextWords = extractWordGeometryFromReadableNodes(blocks) as WordGeometry[];
        controller.reloadGeometry(nextWords);
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

  useEffect(() => {
    if (loadedRef.current) return;
    if (!wordGeometry?.length) return;

    controller.load(wordGeometry);
    controller.setWPM(150);
    loadedRef.current = true;

    // establish baseline at the moment geometry is considered "valid"
    lastSigRef.current = getViewportSignature();

    if (pendingStartRef.current) {
      controller.startFromHere(pendingStartRef.current);
      pendingStartRef.current = null;
    }
  }, [controller, wordGeometry]);

  useEffect(() => {
    const onStartHere = (event: any) => {
      const lastCtx = event?.detail?.lastCtx;
      if (!lastCtx) return;

      if (!loadedRef.current) {
        pendingStartRef.current = lastCtx;
        return;
      }

      // If viewport changed since last known-good geometry, rebuild immediately
      // so startFromHere maps against CURRENT layout.
      //
      const nextSig = getViewportSignature();
      const prevSig = lastSigRef.current;

      if (prevSig !== nextSig) {
        clearRebuildTimer();

        if (rebuildInFlightRef.current) {
          // run after rebuild completes
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
