import { extractWordGeometryFromReadableNodes } from './dom/ReadableWords';
import { ReaderPanel } from './gui/ReaderPanel';
import { ReaderController } from './readerEngine/controller';
import { useEffect, useState, useRef } from 'react';
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

export default function App({ destroyCallback, wordGeometry }: AppProps) {
  const [controller] = useState(() => new ReaderController());
  const pendingStartRef = useRef<any>(null);
  const loadedRef = useRef(false);

  const lastSigRef = useRef<string | null>(null);
  const rebuildTimerRef = useRef<number | null>(null);
  const rebuildInFlightRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    if (!wordGeometry?.length) return;

    controller.load(wordGeometry);
    controller.setWPM(150);
    loadedRef.current = true;

    // establish baseline signature at the moment geometry is considered "valid"
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

      controller.startFromHere(lastCtx);
    };

    window.addEventListener('readcursor:startHere', onStartHere);
    return () => window.removeEventListener('readcursor:startHere', onStartHere);
  }, [controller]);

  useEffect(() => {
    const clearRebuildTimer = () => {
      if (rebuildTimerRef.current != null) {
        window.clearTimeout(rebuildTimerRef.current);
        rebuildTimerRef.current = null;
      }
    };

    const rebuildNow = (reason: string, prevSig: string | null, nextSig: string) => {
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
      }
    };

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
  }, [controller]);

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
