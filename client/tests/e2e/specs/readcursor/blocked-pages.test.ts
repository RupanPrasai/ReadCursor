import { openPopupInNewTab } from '../../helpers/readcursor.js';

type InjectResult = {
  ok?: boolean;
  reason?: string;
  error?: string;
};

async function rcE2EInjectFromPopup(urlPrefix: string): Promise<InjectResult> {
  // Must run inside an extension page (popup/options/etc.) so chrome.runtime.* exists.
  return browser.executeAsync((prefix: string, done) => {
    try {
      chrome.runtime.sendMessage({ type: 'RC_E2E_INJECT', urlPrefix: prefix }, resp => {
        done(resp as any);
      });
    } catch (e) {
      done({ ok: false, error: String(e) } as any);
    }
  }, urlPrefix);
}

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
    const res = await rcE2EInjectFromPopup(urlPrefix);

    // Assert the hook reports failure (shape may be {ok:false, reason} or {ok:false, error})
    expect(res && typeof res === 'object').toBe(true);
    expect(res.ok).toBe(false);

    const msg = String(res.reason ?? res.error ?? '');
    expect(msg.length).toBeGreaterThan(0);

    // Be tolerant to Chrome/version wording differences
    expect(msg.toLowerCase()).toMatch(
      /(chrome\s*web\s*store|chromewebstore|webstore|cannot access|not allowed|cannot run|extensions.*cannot)/,
    );

    // Assert nothing was injected into the blocked page
    await browser.switchToWindow(blockedHandle);
    await browser.pause(250); // tiny settle; no timing dependence beyond "should not appear"
    expect(await pageHasReadCursorHost()).toBe(false);
  });
});
