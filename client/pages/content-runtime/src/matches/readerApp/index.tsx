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

let lastCtx: {
  ts: number;
  clientX: number;
  clientY: number;
  rcid: string | null;
  selStartChar: number | null;
  selClientX: number | null;
  selClientY: number | null;
} | null = null;

window.addEventListener(
  'contextmenu',
  event => {
    const mouse = event as MouseEvent;
    const target = event.target as HTMLElement | null;

    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;

    const startEl = range
      ? range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : (range.startContainer.parentElement as Element | null)
      : null;

    const rcidElement =
      (startEl?.closest?.('[data-rcid]') as HTMLElement | null) ??
      (target?.closest?.('[data-rcid]') as HTMLElement | null);

    const rcid = rcidElement?.getAttribute('data-rcid') ?? null;

    let selStartChar: number | null = null;
    if (rcidElement && sel && range && !sel.isCollapsed) {
      try {
        const pre = document.createRange();
        pre.selectNodeContents(rcidElement);
        pre.setEnd(range.startContainer, range.startOffset);
        selStartChar = pre.toString().length;
      } catch {
        selStartChar = null;
      }
    }

    let selClientX: number | null = null;
    let selClientY: number | null = null;
    if (range) {
      const r = range.getClientRects()[0] ?? range.getBoundingClientRect();
      if (r && Number.isFinite(r.left) && Number.isFinite(r.top)) {
        selClientX = r.left + r.width / 2;
        selClientY = r.top + r.height / 2;
      }
    }

    lastCtx = {
      ts: Date.now(),
      rcid,
      clientX: mouse.clientX,
      clientY: mouse.clientY,
      selStartChar,
      selClientX,
      selClientY,
    };
  },
  { capture: true },
);

chrome.runtime.onMessage.addListener(msg => {
  if (msg?.type !== 'START_FROM_SELECTION') return;

  console.log('[ReadCursor] START_HERE using lastCtx:', lastCtx);

  window.dispatchEvent(
    new CustomEvent('readcursor:startHere', {
      detail: { lastCtx },
    }),
  );
});
