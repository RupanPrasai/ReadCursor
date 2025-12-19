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

// ---------- START FROM SELECTION CONTEXT ----------
let lastCtx: {
  ts: number;
  clientX: number;
  clientY: number;
  rcid: string | null;
  selStartChar: number | null;
  selClientX: number | null;
  selClientY: number | null;
  pageX: number;
  pageY: number;
} | null = null;

// ---------- GLOBAL LISTENER MANAGEMENT ----------
let listenersAttached = false;

const onContextMenu = (event: Event) => {
  const mouse = event as MouseEvent;
  const target = event.target as HTMLElement | null;

  const sel = window.getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;

  const startEl = range
    ? range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : (range.startContainer.parentElement as Element | null)
    : null;

  // ✅ Prefer the block you're actually highlighting (fixes <strong> selections)
  const blockEl =
    (startEl?.closest?.('.rc-highlightable[data-rcid]') as HTMLElement | null) ??
    (target?.closest?.('.rc-highlightable[data-rcid]') as HTMLElement | null);

  // Fallback if we right-click outside highlightable blocks
  const anyRcidEl =
    (startEl?.closest?.('[data-rcid]') as HTMLElement | null) ??
    (target?.closest?.('[data-rcid]') as HTMLElement | null);

  const rcidElement = blockEl ?? anyRcidEl;
  const rcid = rcidElement?.getAttribute('data-rcid') ?? null;

  // Selection start offset within rcidElement (block if available)
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

  // Selection rect center point
  let selClientX: number | null = null;
  let selClientY: number | null = null;
  if (range) {
    const r = range.getClientRects()[0] ?? range.getBoundingClientRect();
    if (r && Number.isFinite(r.left) && Number.isFinite(r.top)) {
      selClientX = r.left + r.width / 2;
      selClientY = r.top + r.height / 2;
    }
  }

  const xClient = typeof selClientX === 'number' ? selClientX : mouse.clientX;
  const yClient = typeof selClientY === 'number' ? selClientY : mouse.clientY;

  const pageX = xClient + window.scrollX;
  const pageY = yClient + window.scrollY;

  lastCtx = {
    ts: Date.now(),
    rcid,
    clientX: mouse.clientX,
    clientY: mouse.clientY,
    selStartChar,
    selClientX,
    selClientY,
    pageX,
    pageY,
  };
};

const onRuntimeMessage = (msg: any) => {
  if (msg?.type !== 'START_FROM_SELECTION') return;

  window.dispatchEvent(
    new CustomEvent('readcursor:startHere', {
      detail: { lastCtx },
    }),
  );
};

function attachGlobalListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  console.log('[ReadCursor] Global listeners attached');
}

function detachGlobalListeners() {
  if (!listenersAttached) return;
  listenersAttached = false;

  window.removeEventListener('contextmenu', onContextMenu, { capture: true } as any);
  chrome.runtime.onMessage.removeListener(onRuntimeMessage);

  console.log('[ReadCursor] Global listeners detached');
}

// ---------- LIFECYCLE ----------
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

    // Important: remove global listeners so re-injection doesn't stack handlers
    detachGlobalListeners();

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
    attachGlobalListeners();

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

// Dispose any prior singleton first
const existingSingleton = (window as any)[GLOBAL_KEY] as Singleton | undefined;
if (existingSingleton?.dispose) {
  try {
    existingSingleton.dispose();
  } catch (error) {
    console.warn('[ReadCursor] Existing single dispose failed:', error);
  }
}

initializeReaderPanel();

