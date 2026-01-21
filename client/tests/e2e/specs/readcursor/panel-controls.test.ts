import { openFixture } from '../../helpers/fixtures.js';
import { openPopupInNewTab, e2eInjectIntoFixture, waitForReadCursorHost, dragBy } from '../../helpers/readcursor.js';

describe('ReadCursor - ReaderPanel interactions', () => {
  it('can play/pause, change WPM, drag, and minimize/restore', async () => {
    await openFixture('basic-article');
    const pageHandle = await browser.getWindowHandle();

    const fixtureUrl = await browser.getUrl();
    const fixtureOrigin = new URL(fixtureUrl).origin;

    const { popupHandle } = await openPopupInNewTab();
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture(fixtureOrigin);

    await browser.switchToWindow(pageHandle);
    const host = await waitForReadCursorHost();

    const playBtn = await host.shadow$('button[aria-label="Play"]');
    await playBtn.waitForClickable();
    await playBtn.click();

    const pauseBtn = await host.shadow$('button[aria-label="Pause"]');
    await pauseBtn.waitForExist();

    // WPM preset
    const preset200 = await host.shadow$('button=200');
    await preset200.waitForClickable();
    await preset200.click();

    const wpmInput = await host.shadow$('input[aria-label="WPM input"]');
    await expect(wpmInput).toHaveValue('200');

    // Drag panel (use drag bar)
    const dragBar = await host.shadow$('[aria-label="Drag reader panel"]');
    await dragBar.waitForExist();

    const before = await dragBar.getLocation();
    await dragBy(dragBar, 80, 40);
    const after = await dragBar.getLocation();

    await expect(after.x).toBeGreaterThan(before.x + 10);
    await expect(after.y).toBeGreaterThan(before.y + 10);

    // Minimize + restore
    const minimizeBtn = await host.shadow$('button[aria-label="Minimize reader panel"]');
    await minimizeBtn.waitForClickable();
    await minimizeBtn.click();

    const pill = await host.shadow$('div[aria-label="Reader panel minimized"]');
    await pill.waitForExist();

    const restoreBtn = await host.shadow$('button[aria-label="Restore reader panel"]');
    await restoreBtn.waitForClickable();
    await restoreBtn.click();

    // IMPORTANT: re-query after mode switch (old handles can go stale)
    const dragBar2 = await host.shadow$('[aria-label="Drag reader panel"]');
    await dragBar2.waitForExist();
  });
});

