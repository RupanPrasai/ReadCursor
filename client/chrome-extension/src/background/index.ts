import { readCursorPrefsStorage } from '@extension/storage';

const MENU_ID = 'readcursor_start_here';

// -------------------------
// Context menu (prefs-driven)
// -------------------------
async function syncStartFromSelectionContextMenu() {
  // Default to enabled if prefs fail to load (safer UX)
  let enabled = true;

  try {
    const prefs = await readCursorPrefsStorage.get();
    enabled = !!prefs.startFromSelectionEnabled;
  } catch {
    enabled = true;
  }

  if (enabled) {
    try {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: 'Start reading from here',
        contexts: ['selection', 'page'],
      });
    } catch {
      // Ignore duplicate ID races across SW restarts.
    }
  } else {
    try {
      chrome.contextMenus.remove(MENU_ID);
    } catch {
      // Ignore "not found"
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void syncStartFromSelectionContextMenu();
});

chrome.runtime.onStartup?.addListener(() => {
  void syncStartFromSelectionContextMenu();
});

// Also run on SW boot (MV3 SW can restart anytime)
void syncStartFromSelectionContextMenu();

chrome.storage.onChanged.addListener((_changes, areaName) => {
  // Your prefs storage might be Sync or Local depending on how you configured it.
  // Just react to both; this is cheap and avoids key-coupling.
  if (areaName !== 'sync' && areaName !== 'local') return;
  void syncStartFromSelectionContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!tab?.id) return;

  // Safety: if disabled but menu hasn’t updated yet, no-op.
  try {
    const prefs = await readCursorPrefsStorage.get();
    if (!prefs.startFromSelectionEnabled) return;
  } catch {
    // If prefs read fails, proceed (fail open).
  }

  chrome.tabs.sendMessage(tab.id, {
    type: 'START_FROM_SELECTION',
    ts: Date.now(),
  });
});

// -------------------------
// E2E-only injection hook (KEEP THIS)
// -------------------------
const isE2EBuild = () => {
  const vn = chrome.runtime.getManifest().version_name ?? '';
  return vn.includes('-e2e');
};

type RcE2EInjectMsg = {
  type: 'RC_E2E_INJECT';
  urlPrefix: string; // e.g. "http://127.0.0.1:"
};

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (msg?.type !== 'RC_E2E_INJECT') return;

  // Hard gate: should not work in production builds.
  if (!isE2EBuild()) {
    sendResponse({ ok: false, error: 'RC_E2E_INJECT rejected: not an E2E build' });
    return;
  }

  const { urlPrefix } = msg as RcE2EInjectMsg;

  (async () => {
    const tabs = await chrome.tabs.query({});

    const target = tabs.find(t => typeof t.url === 'string' && t.url.startsWith(urlPrefix));
    if (!target?.id) {
      throw new Error(`RC_E2E_INJECT: no tab found with urlPrefix="${urlPrefix}"`);
    }

    // Must match the built asset path inside the extension.
    await chrome.scripting.executeScript({
      target: { tabId: target.id },
      files: ['content-runtime/readerApp.iife.js'],
    });

    sendResponse({ ok: true, tabId: target.id });
  })().catch(err => {
    sendResponse({ ok: false, error: err?.message ?? String(err) });
  });

  return true; // keep channel open for async response
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
