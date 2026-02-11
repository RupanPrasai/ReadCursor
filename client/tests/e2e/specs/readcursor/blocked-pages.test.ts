import { e2eInjectIntoFixture, openPopupInNewTab } from '../../helpers/readcursor.js';

async function pageHasReadCursorHost(): Promise<boolean> {
  return browser.execute(() => Boolean(document.querySelector('#__ROOT_READERPANEL__')));
}

describe('ReadCursor - blocked pages', () => {
  it('fails gracefully when attempting to inject on Chrome Web Store', async () => {
    // Open a blocked target (Chrome Web Store blocks extension script injection)
    await browser.url('https://chromewebstore.google.com/');
    const blockedHandle = await browser.getWindowHandle();

    // Derive a prefix that matches whatever Chrome actually loaded (handles redirects)
    const blockedUrl = await browser.getUrl();
    const blockedOrigin = new URL(blockedUrl).origin; // e.g. https://chromewebstore.google.com
    const urlPrefix = `${blockedOrigin}/`;

    // Open an extension page so we can call chrome.runtime.sendMessage(...)
    const { popupHandle } = await openPopupInNewTab();

    // Attempt injection via the E2E background hook
    await browser.switchToWindow(popupHandle);

    let thrown = '';
    try {
      await e2eInjectIntoFixture(urlPrefix);
    } catch (e) {
      thrown = String((e as Error)?.message ?? e);
    }

    expect(thrown.length).toBeGreaterThan(0);

    // Be tolerant to Chrome/version wording differences
    expect(thrown.toLowerCase()).toMatch(
      /(chrome\s*web\s*store|chromewebstore|webstore|cannot access|not allowed|cannot run|extensions.*cannot)/,
    );

    // Assert nothing was injected into the blocked page
    await browser.switchToWindow(blockedHandle);
    await browser.pause(250); // tiny settle; no timing dependence beyond "should not appear"
    expect(await pageHasReadCursorHost()).toBe(false);
  });
});
