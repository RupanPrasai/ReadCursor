import inlineCss from '../../../dist/overlay/index.css?inline';
import { initAppWithShadow } from '@extension/shared';
import App from '@src/matches/overlay/App';
import type { Root } from 'react-dom/client';

const ROOT_ID = '__ROOT_OVERLAY__';
let activeReactRoot: Root | null = null;

function destroyOverlayInstance() {
  const overlayContainer = document.getElementById(ROOT_ID);

  if (activeReactRoot) {
    activeReactRoot.unmount();
    activeReactRoot = null;

    if (overlayContainer) {
      overlayContainer.remove();
    }

    if (window.hasOwnProperty('overlayGuiActive')) {
      delete (window as any).overlayGuiActive;
    }

    console.log('Overlay extension instance was destroyed.');
  }
}

function initializeOverlay(): boolean {
  const existing = document.getElementById(ROOT_ID);

  if (existing) {
    console.warn('Overlay extension instance already exists. Aborting.');
    return false;
  }

  try {
    const reactRoot = initAppWithShadow({
      id: ROOT_ID,
      app: <App destroyCallback={destroyOverlayInstance} />,
      inlineCss,
    });
    activeReactRoot = reactRoot;

    (window as any).overlayGuiActive = true;

    console.log('Overlay extension successfully initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize React application.', error);
    return false;
  }
}

initializeOverlay();
