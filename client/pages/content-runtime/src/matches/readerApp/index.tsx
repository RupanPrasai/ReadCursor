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

let lastCtx: any = null;

window.addEventListener(
  'contextmenu',
  event => {
    const target = event.target as HTMLElement | null;
    const closestRcidElement = target?.closest?.('[data-rcid]') as HTMLElement | null;

    const selection = window.getSelection();
    const hasSelection = !!selection && selection.rangeCount > 0 && !selection.isCollapsed;

    lastCtx = {
      ts: Date.now(),
      clientXY: { x: event.clientX, y: event.clientY },
      pageXY: { x: (event as MouseEvent).pageX, y: (event as MouseEvent).pageY },
      button: (event as MouseEvent).button,
      meta: {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
      },
      target: target
        ? {
          tag: target.tagName,
          id: target.id || null,
          className: target.className || null,
          role: target.getAttribute('role'),
        }
        : null,

      rcid: closestRcidElement?.getAttribute('data-rcid') ?? null,
      rcidTag: closestRcidElement?.tagName ?? null,
      rcidId: closestRcidElement?.id ?? null,
      rcidClass: closestRcidElement?.className ?? null,

      hasSelection,
      selectionTextPreview: hasSelection ? selection!.toString().slice(0, 120) : null,
    };

    console.log('[ReadCursor] contextmenu event caputred:', lastCtx);
  },
  { capture: true },
);

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'START_FROM_SELECTION') {
    return;
  }

  console.log('[ReadCursor] message from SW:', {
    msg,
    sender,
    lastCtx,
  });

  const selection = window.getSelection();

  console.log('[ReadCursor] selection NOW:', {
    hasSelection: !!selection && selection.rangeCount > 0 && !selection.isCollapsed,
    textPreview: selection ? selection.toString().slice(0, 200) : null,
  });
});

