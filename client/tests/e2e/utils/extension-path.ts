/**
 * Returns the Chrome/Firefox extension base URL:
 *  - Chrome:  chrome-extension://<id>
 *  - Firefox: moz-extension://<uuid>
 */

let cachedChromeExtensionPath: string | null = null;

export const getChromeExtensionPath = async (extensionId: string) => {
  if (cachedChromeExtensionPath) return cachedChromeExtensionPath;
  if (!extensionId) throw new Error('Deterministic extension ID is required for Chrome E2E runs.');

  cachedChromeExtensionPath = `chrome-extension://${extensionId}`;
  return cachedChromeExtensionPath;
};

export const getFirefoxExtensionPath = async (browser: WebdriverIO.Browser) => {
  await browser.url('about:debugging#/runtime/this-firefox');

  const uuidElement = await browser.$('//dt[contains(text(), "Internal UUID")]/following-sibling::dd').getElement();

  const internalUUID = await uuidElement.getText();
  if (!internalUUID) throw new Error('Internal UUID not found');

  return `moz-extension://${internalUUID}`;
};
