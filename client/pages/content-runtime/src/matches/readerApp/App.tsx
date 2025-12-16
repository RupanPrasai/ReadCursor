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
  }, [controller, wordGeometry]);

  useEffect(() => {
    const onStartHere = (event: any) => {
      const lastCtx = event?.detail?.lastCtx;
      if (!lastCtx) {
        return
      }

      console.log("[Controller Start From Here Code]:", lastCtx);
    }

    window.addEventListener('readcursor:startHere', onStartHere);
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
