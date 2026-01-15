const HOST_MARKER = 'data-readcursor-e2e-host';

export const openPopupInNewTab = async () => {
  const extensionPath = await browser.getExtensionPath();
  const popupUrl = `${extensionPath}/popup/index.html`;

  // Trigger a new tab from the current page (keeps it in the same Chrome window in practice)
  await browser.execute((url: string) => window.open(url, '_blank'), popupUrl);

  const findHandleForUrl = async (targetUrl: string) => {
    const handles = await browser.getWindowHandles();
    for (const h of handles) {
      await browser.switchToWindow(h);
      const url = await browser.getUrl();
      if (url === targetUrl) return h;
    }
    return null;
  };

  let popupHandle: string | null = null;

  await browser.waitUntil(
    async () => {
      popupHandle = await findHandleForUrl(popupUrl);
      return !!popupHandle;
    },
    {
      timeout: 20000,
      timeoutMsg: `Popup tab not found by URL: ${popupUrl}`,
    },
  );

  if (!popupHandle) throw new Error('Popup handle not found');

  await browser.switchToWindow(popupHandle);

  // Don’t assert title (it’s flaky). Assert the UI exists.
  await $('button=Open Read Cursor').waitForExist({ timeout: 10000 });

  return { popupUrl, popupHandle };
};

export const clickOpenReadCursor = async () => {
  const btn = await $('button=Open Read Cursor');
  await btn.waitForClickable();
  await btn.click();

  // Wait until the button is no longer busy/disabled (injecting state cleared)
  //
  await browser.waitUntil(async () => (await btn.getAttribute('aria-busy')) !== 'true', {
    timeout: 10000,
    timeoutMsg: 'Popup inject button stayed busy too long',
  });
};

export const countReadCursorInstances = async () =>
  await browser.execute(() => {
    let count = 0;

    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    for (const el of all) {
      const sr = (el as any).shadowRoot as ShadowRoot | undefined;
      if (sr && sr.querySelector('.app-container')) count++;
    }

    return count;
  });

export const waitForReadCursorHost = async () => {
  await browser.waitUntil(async () => (await countReadCursorInstances()) >= 1, {
    timeout: 15000,
    timeoutMsg: 'ReadCursor shadow host not found (no .app-container in any shadowRoot)',
  });

  // Tag the host so we can select it deterministically
  await browser.execute((marker: string) => {
    const existing = document.querySelector(`[${marker}="1"]`);
    if (existing) return;

    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    for (const el of all) {
      const sr = (el as any).shadowRoot as ShadowRoot | undefined;
      if (sr && sr.querySelector('.app-container')) {
        el.setAttribute(marker, '1');
        return;
      }
    }
  }, HOST_MARKER);

  const host = await $(`[${HOST_MARKER}="1"]`);
  await host.waitForExist();
  return host;
};

export const dragBy = async (el: WebdriverIO.Element, dx: number, dy: number) => {
  const r = await el.getRect();
  const startX = Math.round(r.x + r.width / 2);
  const startY = Math.round(r.y + r.height / 2);

  await browser.performActions([
    {
      type: 'pointer',
      id: 'mouse',
      parameters: { pointerType: 'mouse' },
      actions: [
        { type: 'pointerMove', duration: 0, x: startX, y: startY },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 100, x: startX + dx, y: startY + dy },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await browser.releaseActions();
};
