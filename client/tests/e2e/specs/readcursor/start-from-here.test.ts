import { openFixture } from '../../helpers/fixtures.js';
import { openPopupInNewTab, e2eInjectIntoFixture, waitForReadCursorHost } from '../../helpers/readcursor.js';

describe('ReadCursor - start-from-here', () => {
  it('starts reading near a chosen block when readcursor:startHere fires', async () => {
    await openFixture('basic-article');
    const pageHandle = await browser.getWindowHandle();

    const fixtureUrl = await browser.getUrl();
    const fixtureOrigin = new URL(fixtureUrl).origin;

    const { popupHandle } = await openPopupInNewTab();
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture(fixtureOrigin);

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

    // Fire the same event App listens for
    await browser.execute(({ rcid, x, y }: { rcid: string; x: number; y: number }) => {
      window.dispatchEvent(
        new CustomEvent('readcursor:startHere', {
          detail: { lastCtx: { rcid, clientX: x, clientY: y, selClientX: x, selClientY: y } },
        }),
      );
    }, target);

    // Assert highlight CSS vars got set on the target block
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

    // Panel should show Playing (avoid WDIO shadow element handles)
    await browser.waitUntil(
      async () =>
        await browser.execute((h: any) => {
          const sr = h?.shadowRoot as ShadowRoot | undefined;
          return !!sr?.querySelector('span[aria-label="Reader status: Playing"]');
        }, host),
      { timeout: 10000, timeoutMsg: 'Expected Reader status: Playing chip to exist' },
    );
  });
});
