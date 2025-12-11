import { ReaderPanel } from './gui/ReaderPanel';
import { ReaderController } from './readerEngine/controller';
import { useEffect, useState } from 'react';
import type { WordGeometry } from './readerEngine/Highlighter';

interface AppProps {
  destroyCallback: () => void;
  wordGeometry: WordGeometry[];
}

export default function App({ destroyCallback, wordGeometry }: AppProps) {
  const [controller] = useState(() => new ReaderController());

  useEffect(() => {
    if (wordGeometry && Array.isArray(wordGeometry)) {
      controller.load(wordGeometry, 120);
    }
  }, [controller, wordGeometry]);
  return (
    <div className="app-container">
      <ReaderPanel onDestroy={destroyCallback} controller={controller} />
    </div>
  );
}
