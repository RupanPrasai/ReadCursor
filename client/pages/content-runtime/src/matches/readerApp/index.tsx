import { readDOM, getReadableNodes } from './dom/ReadableText';
import inlineCss from '../../../dist/readerApp/index.css?inline';
import { initAppWithShadow } from '@extension/shared';
import App from '@src/matches/readerApp/App';
import type { Root } from 'react-dom/client';

const ROOT_ID = '__ROOT_READERPANEL__';
let activeReactRoot: Root | null = null;

//
//
//

const readableNodes = getReadableNodes();
console.log(readableNodes);

//
//
//

chrome.runtime.onMessage.addListener(swMessage => {
  console.log('[ReadCursor] Runtime message received:', swMessage);

  if (swMessage.type === 'START_FROM_SELECTION') {
    window.dispatchEvent(new CustomEvent('readcursor:startFromSelection', { detail: swMessage }));
  }
});

window.addEventListener('readcursor:startFromSelection', (event: any) => {
  console.log('[ReadCursor TEST] Received SW Message:', event.detail);
});

function destroyReaderPanelInstance() {
  const readerPanelContainer = document.getElementById(ROOT_ID);

  if (activeReactRoot) {
    activeReactRoot.unmount();
    activeReactRoot = null;

    if (readerPanelContainer) {
      readerPanelContainer.remove();
    }

    if (window.hasOwnProperty('readerPanelGuiActive')) {
      delete (window as any).readerPanelGuiActive;
    }

    console.log('Reader Panel instance was destroyed.');
  }
}

function initializeReaderPanel(): boolean {
  const existing = document.getElementById(ROOT_ID);

  if (existing) {
    console.warn('Reader Panel instance already exists. Aborting.');
    return false;
  }

  try {
    const reactRoot = initAppWithShadow({
      id: ROOT_ID,
      app: <App destroyCallback={destroyReaderPanelInstance} />,
      inlineCss,
    });
    activeReactRoot = reactRoot;

    (window as any).readerPanelGuiActive = true;

    console.log('Reader Panel successfully initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize React application.', error);
    return false;
  }
}

initializeReaderPanel();
