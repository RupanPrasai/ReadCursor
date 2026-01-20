/**
 * Returns the Chrome/Firefox extension base URL:
 *  - Chrome:  chrome-extension://<id>
 *  - Firefox: moz-extension://<uuid>
 */

let cachedChromeExtensionPath: string | null = null;

export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
  if (cachedChromeExtensionPath) return cachedChromeExtensionPath;

  const originalHandle = await browser.getWindowHandle();

  // Open extensions manager in a TAB (not a new window), so it’s less disruptive.
  await browser.newWindow('chrome://extensions/', { type: 'tab' });

  const mgrHandle = await browser.getWindowHandle();
  await browser.switchToWindow(mgrHandle);

  // Wait for the extensions UI to exist.
  await browser.waitUntil(async () => (await $('extensions-manager').isExisting()) === true, {
    timeout: 10000,
    timeoutMsg: 'chrome://extensions did not load extensions-manager',
  });

  // Find an extensions-item. If you have multiple extensions loaded in this profile,
  // you should filter by name; otherwise the first item is typically your unpacked extension.
  const extensionId = await (async () => {
    const extensionsManager = await $('extensions-manager').getElement();

    const itemList = await extensionsManager.shadow$('#container > #viewManager > extensions-item-list');
    const firstItem = await itemList.shadow$('extensions-item');

    const id = await firstItem.getAttribute('id');
    return id ?? '';
  })();

  if (!extensionId) {
    // Best-effort diagnostics
    const debug = await browser.execute(() => {
      const mgr = document.querySelector('extensions-manager') as any;
      if (!mgr?.shadowRoot) return { hasManager: !!mgr, hasShadowRoot: false };
      const itemList = mgr.shadowRoot.querySelector('#viewManager > extensions-item-list') as any;
      return {
        hasManager: true,
        hasShadowRoot: true,
        hasItemList: !!itemList,
      };
    });

    throw new Error(`Extension ID not found on chrome://extensions. Debug: ${JSON.stringify(debug)}`);
  }

  cachedChromeExtensionPath = `chrome-extension://${extensionId}`;

  // Close chrome://extensions tab and go back
  await browser.closeWindow();
  await browser.switchToWindow(originalHandle);

  return cachedChromeExtensionPath;
};

export const getFirefoxExtensionPath = async (browser: WebdriverIO.Browser) => {
  await browser.url('about:debugging#/runtime/this-firefox');

  const uuidElement = await browser.$('//dt[contains(text(), "Internal UUID")]/following-sibling::dd').getElement();

  const internalUUID = await uuidElement.getText();
  if (!internalUUID) throw new Error('Internal UUID not found');

  return `moz-extension://${internalUUID}`;
};
