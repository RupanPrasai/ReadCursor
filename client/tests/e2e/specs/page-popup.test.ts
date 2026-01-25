import { openFixture } from '../helpers/fixtures.js';
import { openPopupInNewTab } from '../helpers/readcursor.js';

describe('Webextension Popup', () => {
  it('renders the popup and the inject button', async () => {
    const extensionPath = await browser.getExtensionPath();
    await browser.url(`${extensionPath}/popup/index.html`);

    await expect(browser).toHaveTitle('Popup');
    await expect($('button=Open Read Cursor')).toBeExisting();
  });

  it('clicking the primary button does not crash or get stuck (smoke)', async () => {
    // Ensure there is a normal http(s) tab open (even though we don't assert injection success)
    await openFixture('basic-article');

    // Open popup reliably using the existing helper (known-good in your suite)
    const { popupHandle } = await openPopupInNewTab();
    await browser.switchToWindow(popupHandle);

    const btn = await $('button=Open Read Cursor');
    await expect(btn).toBeExisting();
    await expect(btn).toHaveText('Open Read Cursor');

    await btn.click();

    // If handler is synchronous-fast, it may never show busy. We only assert it returns to idle and is usable.
    await browser.waitUntil(
      async () => {
        const text = await btn.getText();
        const enabled = await btn.isEnabled();
        const ariaBusy = await btn.getAttribute('aria-busy');
        return text === 'Open Read Cursor' && enabled && ariaBusy !== 'true';
      },
      {
        timeout: 5000,
        interval: 100,
        timeoutMsg: 'Expected popup button to remain/return to idle usable state after click',
      },
    );
  });
});
