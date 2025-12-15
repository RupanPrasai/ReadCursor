import { getReadableNodes } from './dom/ReadableText';
import { extractWordGeometryFromReadableNodes } from './dom/ReadableWords';
import inlineCss from '../../../dist/readerApp/index.css?inline';
import { initAppWithShadow } from '@extension/shared';
import App from '@src/matches/readerApp/App';
import type { Root } from 'react-dom/client';

const ROOT_ID = '__ROOT_READERPANEL__';
const GLOBAL_KEY = '__READCURSOR_SINGLETON__';

type Singleton = {
  dispose: () => void;
};

let activeReactRoot: Root | null = null;

function destroyReaderPanelInstance() {
  try {
    if (activeReactRoot) {
      activeReactRoot.unmount();
      activeReactRoot = null;
    }

    document.getElementById(ROOT_ID)?.remove();

    if ((window as any).readerPanelGuiActive) {
      delete (window as any).readerPanelGuiActive;
    }

    if ((window as any)[GLOBAL_KEY]) {
      delete (window as any)[GLOBAL_KEY];
    }

    console.log('[ReadCursor] Reader Panel instance destroyed.');
  } catch (error) {
    console.warn('[ReadCursor] destroyReaderPanelInstance() failed:', error);
  }
}

function initializeReaderPanel(): boolean {
  if (document.getElementById(ROOT_ID)) {
    console.warn('[ReadCursor] Reader Panel instance already exists. Aborting initialization.');
    return false;
  }

  try {
    const readableNodes = getReadableNodes();
    const wordGeometry = extractWordGeometryFromReadableNodes(readableNodes);

    const reactRoot = initAppWithShadow({
      id: ROOT_ID,
      app: <App destroyCallback={destroyReaderPanelInstance} wordGeometry={wordGeometry} />,
      inlineCss,
    });

    activeReactRoot = reactRoot;
    (window as any).readerPanelGuiActive = true;

    (window as any)[GLOBAL_KEY] = { dispose: destroyReaderPanelInstance } satisfies Singleton;

    console.log('[ReadCursor] Reader Panel successfully initialized');
    return true;
  } catch (error) {
    console.error('[ReadCursor] Failed to initialize Reader Panel.', error);

    destroyReaderPanelInstance();
    return false;
  }
}

const existingSingleton = (window as any)[GLOBAL_KEY] as Singleton | undefined;
if (existingSingleton?.dispose) {
  try {
    existingSingleton.dispose();
  } catch (error) {
    console.warn('[ReadCursor] Existing single dispose failed:', error);
  }
}

initializeReaderPanel();

/*
chrome.runtime.onMessage.addListener(swMessage => {
  console.log('[ReadCursor] Runtime message received:', swMessage);

  if (swMessage.type === 'START_FROM_SELECTION') {
    window.dispatchEvent(new CustomEvent('readcursor:startFromSelection', { detail: swMessage }));
  }
});

window.addEventListener('readcursor:startFromSelection', (event: any) => {
  console.log('[ReadCursor TEST] Received SW Message:', event.detail);
});
*/
