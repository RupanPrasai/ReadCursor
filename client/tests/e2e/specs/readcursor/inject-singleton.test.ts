import { openFixture } from '../../helpers/fixtures.js';
import {
  openPopupInNewTab,
  e2eInjectIntoFixture,
  waitForReadCursorHost,
  countReadCursorInstances,
} from '../../helpers/readcursor.js';

describe('ReadCursor - injection', () => {
  it('injects into the page and stays singleton on reinjection', async () => {
    await openFixture('basic-article');

    console.log('[E2E] after openFixture url =', await browser.getUrl());
    console.log('[E2E] title = ', await browser.getTitle());

    const pageHandle = await browser.getWindowHandle();

    // Open an extension page so we can call chrome.runtime.sendMessage(...)
    const { popupHandle } = await openPopupInNewTab();

    // Sanity: ensure fixture tab is still the fixture
    await browser.switchToWindow(pageHandle);
    await browser.waitUntil(async () => (await browser.getUrl()).startsWith('http://127.0.0.1'), {
      timeout: 5000,
      timeoutMsg: `Expected fixture tab to be on http://127.0.0.1, got: ${await browser.getUrl()}`,
    });

    // Inject via E2E hook (background finds the fixture tab by urlPrefix and injects)
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture('http://127.0.0.1:');

    await browser.switchToWindow(pageHandle);
    await waitForReadCursorHost();

    await expect(await countReadCursorInstances()).toEqual(1);

    // reinject (should dispose + recreate, still singleton)
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture('http://127.0.0.1:');

    await browser.switchToWindow(pageHandle);
    await browser.waitUntil(async () => (await countReadCursorInstances()) === 1, {
      timeout: 10000,
      timeoutMsg: 'Expected singleton instance after reinjection',
    });
  });
});
