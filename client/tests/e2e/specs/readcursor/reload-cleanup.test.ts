import { openFixture } from '../../helpers/fixtures.js';
import { openPopupInNewTab, e2eInjectIntoFixture, waitForReadCursorHost } from '../../helpers/readcursor.js';

async function hasHost(): Promise<boolean> {
  return browser.execute(() => Boolean(document.querySelector('#__ROOT_READERPANEL__')));
}

async function hostCount(): Promise<number> {
  return browser.execute(() => document.querySelectorAll('#__ROOT_READERPANEL__').length);
}

describe('ReadCursor - reload cleanup', () => {
  it('does not leave a host behind after reload, and can re-inject cleanly', async () => {
    await openFixture('basic-article');
    const pageHandle = await browser.getWindowHandle();

    const fixtureUrl = await browser.getUrl(); // includes port
    const urlPrefix = new URL(fixtureUrl).origin + '/';

    const { popupHandle } = await openPopupInNewTab();

    // Inject
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture(urlPrefix);

    await browser.switchToWindow(pageHandle);
    await waitForReadCursorHost();
    expect(await hostCount()).toBe(1);

    // Reload the page -> host should be gone (new document)
    await browser.refresh();

    await browser.waitUntil(async () => !(await hasHost()), {
      timeout: 5000,
      interval: 100,
      timeoutMsg: 'Expected ReadCursor host to be absent after page reload',
    });

    // Re-inject -> host should return
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture(urlPrefix);

    await browser.switchToWindow(pageHandle);
    await waitForReadCursorHost();
    expect(await hostCount()).toBe(1);
  });
});
