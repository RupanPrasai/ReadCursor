import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'readcursor_start_here',
    title: 'Start reading from here',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'readcursor_start_here') return;
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {
    type: 'START_FROM_SELECTION',
    text: info.selectionText ?? '',
  });
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
