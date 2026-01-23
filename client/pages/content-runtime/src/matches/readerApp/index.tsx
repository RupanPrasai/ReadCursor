import { getReadableNodes } from './dom/ReadableText';
import { extractWordGeometryFromReadableNodes } from './dom/ReadableWords';
import { readCursorPrefsStorage } from '../../../../../packages/storage/lib';
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

// START FROM SELECTION CONTEXT
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

// prefs (only what we need at this layer)
const startFromSelectionEnabledRef = { current: true };
let prefsUnsub: (() => void) | null = null;

async function initPrefsSubscription() {
  try {
    const prefs = await readCursorPrefsStorage.get();
    startFromSelectionEnabledRef.current = !!prefs.startFromSelectionEnabled;
  } catch {
    startFromSelectionEnabledRef.current = true; // fail-open
  }

  prefsUnsub = readCursorPrefsStorage.subscribe(async () => {
    try {
      const prefs = await readCursorPrefsStorage.get();
      startFromSelectionEnabledRef.current = !!prefs.startFromSelectionEnabled;
    } catch {
      // ignore
    }
  });
}

function cleanupPrefsSubscription() {
  try {
    prefsUnsub?.();
  } catch {
    // ignore
  } finally {
    prefsUnsub = null;
  }
}

// GLOBAL LISTENER MANAGEMENT
let listenersAttached = false;

function computeCtxFromSelectionFallback() {
  const sel = window.getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;

  const startEl = range
    ? range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : (range.startContainer.parentElement as Element | null)
    : null;

  const blockEl = (startEl?.closest?.('.rc-highlightable[data-rcid]') as HTMLElement | null) ?? null;

  const anyRcidEl = (startEl?.closest?.('[data-rcid]') as HTMLElement | null) ?? null;

  const rcidElement = blockEl ?? anyRcidEl;
  const rcid = rcidElement?.getAttribute('data-rcid') ?? null;

  let selStartChar: number | null = null;
  if (rcidElement && sel && range && !sel.isCollapsed) {
    try {
      const pre = document.createRange();
      pre.selectNodeContents(rcidElement);
      pre.setEnd(range.startContainer, range.startOffset);

      const frag = pre.cloneContents();
      selStartChar = frag.textContent?.length ?? 0;
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

  const xClient = typeof selClientX === 'number' ? selClientX : window.innerWidth / 2;
  const yClient = typeof selClientY === 'number' ? selClientY : window.innerHeight / 2;

  const pageX = xClient + window.scrollX;
  const pageY = yClient + window.scrollY;

  return {
    ts: Date.now(),
    rcid,
    clientX: xClient,
    clientY: yClient,
    selStartChar,
    selClientX,
    selClientY,
    pageX,
    pageY,
  };
}

const onContextMenu = (event: Event) => {
  if (!startFromSelectionEnabledRef.current) return;

  const mouse = event as MouseEvent;
  const target = event.target as HTMLElement | null;

  const sel = window.getSelection();
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;

  const startEl = range
    ? range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : (range.startContainer.parentElement as Element | null)
    : null;

  // Prefer the block that's being highlighted (fixes <strong> node selections)
  const blockEl =
    (startEl?.closest?.('.rc-highlightable[data-rcid]') as HTMLElement | null) ??
    (target?.closest?.('.rc-highlightable[data-rcid]') as HTMLElement | null);

  // Fallback if right-click outside highlightable blocks
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

      // Use DOM textContent length so it matches ReadableWords.ts globalTextOffset semantics.
      const frag = pre.cloneContents();
      selStartChar = frag.textContent?.length ?? 0;
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

  // Background is already prefs-gated, but fail-safe here too.
  if (!startFromSelectionEnabledRef.current) return;

  // Use recent context if available; otherwise synthesize from current selection.
  const ctx = lastCtx && Date.now() - lastCtx.ts < 30_000 ? lastCtx : computeCtxFromSelectionFallback();

  window.dispatchEvent(
    new CustomEvent('readcursor:startHere', {
      detail: { lastCtx: ctx },
    }),
  );
};

function attachGlobalListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  window.addEventListener('contextmenu', onContextMenu, true);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  console.log('[ReadCursor] Global listeners attached');
}

function detachGlobalListeners() {
  if (!listenersAttached) return;
  listenersAttached = false;

  window.removeEventListener('contextmenu', onContextMenu, true);
  chrome.runtime.onMessage.removeListener(onRuntimeMessage);

  console.log('[ReadCursor] Global listeners detached');
}

// LIFECYCLE
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

    lastCtx = null;

    // Remove global listeners so re-injection doesn't stack handlers
    detachGlobalListeners();
    cleanupPrefsSubscription();

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
    // prefs subscription is safe even if it fails; default is fail-open.
    void initPrefsSubscription();

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
