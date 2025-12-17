import { ReaderPanel } from './gui/ReaderPanel';
import { ReaderController } from './readerEngine/controller';
import { useEffect, useState, useRef } from 'react';
import type { WordGeometry } from './readerEngine/Highlighter';

interface AppProps {
  destroyCallback: () => void;
  wordGeometry: WordGeometry[];
}

export default function App({ destroyCallback, wordGeometry }: AppProps) {
  const [controller] = useState(() => new ReaderController());
  const pendingStartRef = useRef<any>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    if (!wordGeometry?.length) {
      return;
    }
    controller.load(wordGeometry);
    controller.setWPM(150);
    loadedRef.current = true;

    if (pendingStartRef.current) {
      controller.startFromHere(pendingStartRef.current);
      pendingStartRef.current = null;
    }
  }, [controller, wordGeometry]);

  useEffect(() => {
    const onStartHere = (event: any) => {
      const lastCtx = event?.detail?.lastCtx;
      if (!lastCtx) {
        return;
      }

      if (!loadedRef.current) {
        pendingStartRef.current = lastCtx;
        return;
      }

      controller.startFromHere(lastCtx);
    };

    window.addEventListener('readcursor:startHere', onStartHere);
    return () => window.removeEventListener('readcursor:startHere', onStartHere);
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
