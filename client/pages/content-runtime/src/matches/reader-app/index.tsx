import inlineCss from '../../../dist/reader-app/index.css?inline';
import { initAppWithShadow } from '@extension/shared';
import App from '@src/matches/reader-app/App';
import type { Root } from 'react-dom/client';

const ROOT_ID = '__ROOT_READERPANEL__';
let activeReactRoot: Root | null = null;

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
