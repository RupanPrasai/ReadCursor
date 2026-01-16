/**
 * Returns the Chrome extension path.
 * @param browser
 * @returns path to the Chrome extension
 */

let cachedChromeExtensionPath: string | null = null;

export const getChromeExtensionPath = async (browser: WebdriverIO.Browser) => {
  if (cachedChromeExtensionPath) return cachedChromeExtensionPath;

  const originalHandle = await browser.getWindowHandle();
  const before = new Set(await browser.getWindowHandles());

  // Open extensions manager in a temporary tab/window so we don’t nuke the AUT tab
  await browser.newWindow('chrome://extensions/');

  // Find the new handle deterministically
  await browser.waitUntil(async () => (await browser.getWindowHandles()).length > before.size, {
    timeout: 10000,
    timeoutMsg: 'Expected a new window handle for chrome://extensions/',
  });

  const after = await browser.getWindowHandles();
  const mgrHandle = after.find(h => !before.has(h)) ?? after.at(-1)!;

  await browser.switchToWindow(mgrHandle);

  const extensionItem = await (async () => {
    const extensionsManager = await $('extensions-manager').getElement();
    const itemList = await extensionsManager.shadow$('#container > #viewManager > extensions-item-list');
    return itemList.shadow$('extensions-item');
  })();

  const extensionId = await extensionItem.getAttribute('id');
  if (!extensionId) throw new Error('Extension ID not found');

  cachedChromeExtensionPath = `chrome-extension://${extensionId}`;

  // Close the chrome://extensions tab and return to the original test tab
  await browser.closeWindow();
  await browser.switchToWindow(originalHandle);

  return cachedChromeExtensionPath;
};

/**
 * Returns the Firefox extension path.
 * @param browser
 * @returns path to the Firefox extension
 */
export const getFirefoxExtensionPath = async (browser: WebdriverIO.Browser) => {
  await browser.url('about:debugging#/runtime/this-firefox');
  const uuidElement = await browser.$('//dt[contains(text(), "Internal UUID")]/following-sibling::dd').getElement();
  const internalUUID = await uuidElement.getText();

  if (!internalUUID) {
    throw new Error('Internal UUID not found');
  }

  return `moz-extension://${internalUUID}`;
};
