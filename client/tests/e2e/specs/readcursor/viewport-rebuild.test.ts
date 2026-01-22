import { openFixture } from '../../helpers/fixtures.js';
import { openPopupInNewTab, e2eInjectIntoFixture, waitForReadCursorHost } from '../../helpers/readcursor.js';

async function readRebuildCount(): Promise<number> {
  return browser.execute(() => Number(document.documentElement.getAttribute('data-rc-e2e-rebuild') || '0'));
}

describe('ReadCursor - viewport rebuild', () => {
  it('rebuilds geometry after a real viewport resize', async () => {
    await openFixture('basic-article');
    const pageHandle = await browser.getWindowHandle();

    const fixtureUrl = await browser.getUrl();
    const urlPrefix = new URL(fixtureUrl).origin + '/';

    const { popupHandle } = await openPopupInNewTab();

    // inject
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture(urlPrefix);

    await browser.switchToWindow(pageHandle);
    await waitForReadCursorHost();

    const before = await readRebuildCount();

    // real resize (must change innerWidth/innerHeight)
    const size = await browser.getWindowSize();
    const nextW = size.width > 900 ? size.width - 250 : size.width + 250;
    await browser.setWindowSize(nextW, size.height);

    // debounce is 150ms; give it time and assert counter increments
    await browser.waitUntil(async () => (await readRebuildCount()) > before, {
      timeout: 10000,
      interval: 100,
      timeoutMsg: `Expected data-rc-e2e-rebuild to increment after resize (before=${before})`,
    });
  });
});
