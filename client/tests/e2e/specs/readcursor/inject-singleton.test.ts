import { openFixture } from '../../helpers/fixtures.js';
import {
  openPopupInNewTab,
  e2eInjectIntoFixture,
  waitForReadCursorHost,
  countReadCursorInstances,
} from '../../helpers/readcursor.js';

type ReinjectSignals = {
  hostCount: number;
  instance: string | null;
  init: number;
  dispose: number;
};

async function resetReinjectSignals() {
  await browser.execute(() => {
    document.documentElement.removeAttribute('data-rc-e2e-init');
    document.documentElement.removeAttribute('data-rc-e2e-dispose');
  });
}

async function readReinjectSignals(): Promise<ReinjectSignals> {
  return browser.execute(() => {
    const host = document.querySelector('#__ROOT_READERPANEL__') as HTMLElement | null;
    const doc = document.documentElement;

    const init = Number(doc.getAttribute('data-rc-e2e-init') || '0');
    const dispose = Number(doc.getAttribute('data-rc-e2e-dispose') || '0');

    return {
      hostCount: document.querySelectorAll('#__ROOT_READERPANEL__').length,
      instance: host?.getAttribute('data-rc-instance') ?? null,
      init,
      dispose,
    };
  });
}

describe('ReadCursor - injection', () => {
  it('injects into the page and stays singleton on reinjection (dispose + re-init)', async () => {
    await openFixture('basic-article');

    console.log('[E2E] after openFixture url =', await browser.getUrl());
    console.log('[E2E] title = ', await browser.getTitle());

    const pageHandle = await browser.getWindowHandle();

    // Reset E2E counters on the fixture tab
    await resetReinjectSignals();

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

    await browser.waitUntil(async () => (await readReinjectSignals()).instance !== null, {
      timeout: 10000,
      interval: 100,
      timeoutMsg: 'Expected data-rc-instance to be set after first injection (E2E build markers)',
    });

    const s1 = await readReinjectSignals();

    await expect(await countReadCursorInstances()).toEqual(1);
    await expect(s1.hostCount).toEqual(1);
    await expect(s1.init).toEqual(1);
    await expect(s1.dispose).toEqual(0);
    await expect(s1.instance).not.toBeNull();

    // reinject (should dispose + recreate, still singleton)
    await browser.switchToWindow(popupHandle);
    await e2eInjectIntoFixture('http://127.0.0.1:');

    await browser.switchToWindow(pageHandle);

    await browser.waitUntil(
      async () => {
        const s2 = await readReinjectSignals();
        const singletonOk = (await countReadCursorInstances()) === 1 && s2.hostCount === 1;
        const countersOk = s2.init === s1.init + 1 && s2.dispose === s1.dispose + 1;
        const instanceChanged = s2.instance !== s1.instance && s2.instance !== null;
        return singletonOk && countersOk && instanceChanged;
      },
      {
        timeout: 10000,
        interval: 100,
        timeoutMsg:
          'Expected reinjection to dispose old instance and re-init (singleton hostCount==1, init+1, dispose+1, instance attr changed)',
      },
    );
  });
});
