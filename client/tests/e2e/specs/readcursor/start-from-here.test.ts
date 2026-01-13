import { openFixture } from '../../helpers/fixtures.js';
import { openPopupInNewTab, clickOpenReadCursor, waitForReadCursorHost } from '../../helpers/readcursor.js';

describe('ReadCursor - start-from-here', () => {
  it('starts reading near a chosen block when readcursor:startHere fires', async () => {
    await openFixture('basic-article');
    const pageHandle = await browser.getWindowHandle();

    await openPopupInNewTab();
    await clickOpenReadCursor();

    await browser.switchToWindow(pageHandle);
    const host = await waitForReadCursorHost();

    // Wait for highlightable blocks
    await browser.waitUntil(
      async () => (await browser.execute(() => document.querySelectorAll('.rc-highlightable[data-rcid]').length)) >= 2,
      { timeout: 15000, timeoutMsg: 'No .rc-highlightable[data-rcid] blocks found' },
    );

    const target = await browser.execute(() => {
      const blocks = Array.from(document.querySelectorAll('.rc-highlightable[data-rcid]')) as HTMLElement[];
      const el = blocks[1];
      const rcid = el.getAttribute('data-rcid')!;
      const r = el.getBoundingClientRect();
      const x = Math.round(r.left + Math.min(12, r.width / 2));
      const y = Math.round(r.top + Math.min(12, r.height / 2));
      return { rcid, x, y };
    });

    // Fire the same event your real workflow uses
    await browser.execute(({ rcid, x, y }: { rcid: string; x: number; y: number }) => {
      window.dispatchEvent(
        new CustomEvent('readcursor:startHere', {
          detail: { lastCtx: { rcid, clientX: x, clientY: y, selClientX: x, selClientY: y } },
        }),
      );
    }, target);

    // Assert highlight CSS vars got set on the target block (Highlighter writes to inline styles)
    await browser.waitUntil(
      async () => {
        const width = await browser.execute((rcid: string) => {
          const sel = `.rc-highlightable[data-rcid="${CSS.escape(rcid)}"]`;
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return '';
          return el.style.getPropertyValue('--hl-width');
        }, target.rcid);

        return width !== '' && width !== '0px';
      },
      { timeout: 10000, timeoutMsg: 'Expected target block to have a non-zero --hl-width' },
    );

    // Panel should show Playing
    const playingChip = await host.shadow$('span[aria-label="Reader status: Playing"]');
    await playingChip.waitForExist({ timeout: 10000 });
  });
});
