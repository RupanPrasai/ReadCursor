import { openFixture } from '../../helpers/fixtures.js';
import { openPopupInNewTab, e2eInjectIntoFixture, waitForReadCursorHost } from '../../helpers/readcursor.js';

async function shadowExists(host: WebdriverIO.Element, selector: string): Promise<boolean> {
  return await browser.execute(
    (h: any, sel: string) => {
      const sr = h?.shadowRoot as ShadowRoot | undefined;
      return !!sr?.querySelector(sel);
    },
    host,
    selector,
  );
}

async function shadowClick(host: WebdriverIO.Element, selector: string): Promise<void> {
  const ok = await browser.execute(
    (h: any, sel: string) => {
      const sr = h?.shadowRoot as ShadowRoot | undefined;
      const el = sr?.querySelector(sel) as HTMLElement | null;
      if (!el) return false;
      el.click();
      return true;
    },
    host,
    selector,
  );

  if (!ok) throw new Error(`shadowClick: element not found for selector "${selector}"`);
}

async function shadowClickButtonByExactText(host: WebdriverIO.Element, text: string): Promise<void> {
  const ok = await browser.execute(
    (h: any, t: string) => {
      const sr = h?.shadowRoot as ShadowRoot | undefined;
      if (!sr) return false;

      const btns = Array.from(sr.querySelectorAll('button')) as HTMLButtonElement[];
      const hit = btns.find(b => (b.textContent ?? '').trim() === t);
      if (!hit) return false;

      hit.click();
      return true;
    },
    host,
    text,
  );

  if (!ok) throw new Error(`Could not find a <button> in shadowRoot with text "${text}"`);
}

async function shadowGetInputValue(host: WebdriverIO.Element, selector: string): Promise<string | null> {
  return await browser.execute(
    (h: any, sel: string) => {
      const sr = h?.shadowRoot as ShadowRoot | undefined;
      const input = sr?.querySelector(sel) as HTMLInputElement | null;
      return input ? (input.value ?? '') : null;
    },
    host,
    selector,
  );
}

async function shadowGetRect(host: WebdriverIO.Element, selector: string) {
  const rect = await browser.execute(
    (h: any, sel: string) => {
      const sr = h?.shadowRoot as ShadowRoot | undefined;
      const el = sr?.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    },
    host,
    selector,
  );

  if (!rect) throw new Error(`shadowGetRect: element not found for selector "${selector}"`);
  return rect as { left: number; top: number; width: number; height: number };
}

async function dragByViewport(startX: number, startY: number, dx: number, dy: number) {
  await browser.performActions([
    {
      type: 'pointer',
      id: 'mouse',
      parameters: { pointerType: 'mouse' },
      actions: [
        { type: 'pointerMove', duration: 0, x: Math.round(startX), y: Math.round(startY) },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 120, x: Math.round(startX + dx), y: Math.round(startY + dy) },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await browser.releaseActions();
}

describe('ReadCursor - ReaderPanel interactions', () => {
  it('can play/pause, change WPM, drag, and minimize/restore', async () => {
    await openFixture('basic-article');
    const pageHandle = await browser.getWindowHandle();

    const fixtureOrigin = new URL(await browser.getUrl()).origin;

    // Use extension page only as a messaging context for RC_E2E_INJECT
    const { popupHandle } = await openPopupInNewTab();
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture(fixtureOrigin);

    await browser.switchToWindow(pageHandle);
    const host = await waitForReadCursorHost();

    // Play -> Pause (don’t use shadow element handles)
    await shadowClick(host, 'button[aria-label="Play"]');
    await browser.waitUntil(async () => await shadowExists(host, 'button[aria-label="Pause"]'), {
      timeout: 10000,
      timeoutMsg: 'Pause button did not appear after clicking Play',
    });

    // WPM preset 200
    await shadowClickButtonByExactText(host, '200');

    await browser.waitUntil(async () => (await shadowGetInputValue(host, 'input[aria-label="WPM input"]')) === '200', {
      timeout: 10000,
      timeoutMsg: `Expected WPM input value to become "200", got "${await shadowGetInputValue(
        host,
        'input[aria-label="WPM input"]',
      )}"`,
    });

    // Drag panel (compute rect in-page)
    const dragSel = '[aria-label="Drag reader panel"]';
    const before = await shadowGetRect(host, dragSel);
    const startX = before.left + before.width / 2;
    const startY = before.top + before.height / 2;

    await dragByViewport(startX, startY, 80, 40);

    const after = await shadowGetRect(host, dragSel);
    if (!(after.left > before.left + 5 && after.top > before.top + 5)) {
      throw new Error(
        `Drag did not move enough. Before=(${before.left.toFixed(1)},${before.top.toFixed(
          1,
        )}) After=(${after.left.toFixed(1)},${after.top.toFixed(1)})`,
      );
    }

    // Minimize + restore
    await shadowClick(host, 'button[aria-label="Minimize reader panel"]');
    await browser.waitUntil(async () => await shadowExists(host, 'div[aria-label="Reader panel minimized"]'), {
      timeout: 10000,
      timeoutMsg: 'Minimized pill did not appear',
    });

    await shadowClick(host, 'button[aria-label="Restore reader panel"]');
    await browser.waitUntil(async () => await shadowExists(host, dragSel), {
      timeout: 10000,
      timeoutMsg: 'Drag bar did not re-appear after restore',
    });
  });
});

