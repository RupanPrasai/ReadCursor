import { openFixture } from '../../helpers/fixtures.js';
import {
  openPopupInNewTab,
  clickOpenReadCursor,
  waitForReadCursorHost,
  countReadCursorInstances,
} from '../../helpers/readcursor.js';

describe('ReadCursor - injection', () => {
  it('injects into the page and stays singleton on reinjection', async () => {
    await openFixture('basic-article');
    const pageHandle = await browser.getWindowHandle();

    const { popupHandle } = await openPopupInNewTab();
    await clickOpenReadCursor();

    await browser.switchToWindow(pageHandle);
    await waitForReadCursorHost();

    await expect(await countReadCursorInstances()).toEqual(1);

    // reinject
    await browser.switchToWindow(popupHandle);
    await clickOpenReadCursor();

    await browser.switchToWindow(pageHandle);
    await browser.waitUntil(async () => (await countReadCursorInstances()) === 1, {
      timeout: 10000,
      timeoutMsg: 'Expected singleton instance after reinjection',
    });
  });
});
