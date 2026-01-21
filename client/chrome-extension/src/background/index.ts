import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'readcursor_start_here',
    title: 'Start reading from here',
    contexts: ['selection', 'page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'readcursor_start_here') return;
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {
    type: 'START_FROM_SELECTION',
    ts: Date.now(),
  });
});

// -------------------------
// E2E-only injection hook
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
