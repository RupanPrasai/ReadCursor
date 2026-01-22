import { openFixture } from '../../helpers/fixtures.js';
import { openPopupInNewTab, e2eInjectIntoFixture, waitForReadCursorHost } from '../../helpers/readcursor.js';

async function hasHost(): Promise<boolean> {
  return browser.execute(() => Boolean(document.querySelector('#__ROOT_READERPANEL__')));
}

async function hostCount(): Promise<number> {
  return browser.execute(() => document.querySelectorAll('#__ROOT_READERPANEL__').length);
}

function withQuery(url: string, qs: string): string {
  const u = new URL(url);
  // overwrite to ensure uniqueness
  u.searchParams.set('rcTab', qs);
  return u.toString();
}

describe('ReadCursor - multi-tab targeting', () => {
  it('injects only into the tab matching urlPrefix when two fixture tabs are open', async () => {
    // Tab A
    await openFixture('basic-article');
    const baseUrl = await browser.getUrl(); // e.g. http://127.0.0.1:PORT/basic-article.html
    const urlA = withQuery(baseUrl, 'A');
    const urlB = withQuery(baseUrl, 'B');

    // Ensure Tab A has unique URL
    await browser.url(urlA);
    const handleA = await browser.getWindowHandle();

    // Tab B (new tab/window)
    await browser.newWindow(urlB);
    const handleB = await browser.getWindowHandle();

    // Sanity: no host in either before injection
    await browser.switchToWindow(handleA);
    expect(await hasHost()).toBe(false);

    await browser.switchToWindow(handleB);
    expect(await hasHost()).toBe(false);

    // Open popup tab for sending RC_E2E_INJECT messages
    const { popupHandle } = await openPopupInNewTab();

    // Inject into Tab A only (unique prefix)
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture(urlA);

    await browser.switchToWindow(handleA);
    await waitForReadCursorHost();
    expect(await hostCount()).toBe(1);

    await browser.switchToWindow(handleB);
    expect(await hasHost()).toBe(false);

    // Inject into Tab B only
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture(urlB);

    await browser.switchToWindow(handleB);
    await waitForReadCursorHost();
    expect(await hostCount()).toBe(1);

    // Ensure Tab A did not get a second instance
    await browser.switchToWindow(handleA);
    expect(await hostCount()).toBe(1);
  });
});
