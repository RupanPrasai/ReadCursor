const HOST_MARKER = 'data-readcursor-e2e-host';

export const openPopupInNewTab = async () => {
  const extensionPath = await browser.getExtensionPath();
  const popupUrl = `${extensionPath}/popup/index.html`;

  const openerHandle = await browser.getWindowHandle();
  const before = new Set(await browser.getWindowHandles());

  // Create tab deterministically (don’t depend on window.open being allowed)
  await browser.newWindow(popupUrl);

  await browser.waitUntil(async () => (await browser.getWindowHandles()).length > before.size, {
    timeout: 20000,
    timeoutMsg: `Popup tab not created: ${popupUrl}`,
  });

  const after = await browser.getWindowHandles();
  const popupHandle = after.find(h => !before.has(h)) ?? null;
  if (!popupHandle) throw new Error(`Popup handle not found (expected new handle for ${popupUrl})`);

  await browser.switchToWindow(popupHandle);

  // URL can have # or ? depending on router
  await browser.waitUntil(
    async () => {
      const u = await browser.getUrl();
      return u === popupUrl || u.startsWith(`${popupUrl}#`) || u.startsWith(`${popupUrl}?`);
    },
    { timeout: 10000, timeoutMsg: `Popup URL mismatch (expected ${popupUrl}, got ${await browser.getUrl()})` },
  );

  await $('button=Open Read Cursor').waitForExist({ timeout: 10000 });

  return { popupUrl, popupHandle, openerHandle };
};

export const clickOpenReadCursor = async () => {
  const btn = await $('button=Open Read Cursor');
  await btn.waitForClickable();
  await btn.click();

  // Try to observe the busy flip (don’t fail if it was too fast to catch)
  await browser
    .waitUntil(async () => (await btn.getAttribute('aria-busy')) === 'true', { timeout: 1000 })
    .catch(() => { });

  // Then wait for injection to finish
  await browser.waitUntil(async () => (await btn.getAttribute('aria-busy')) !== 'true', {
    timeout: 15000,
    timeoutMsg: 'Popup inject button stayed busy too long',
  });
};

export const countReadCursorInstances = async () =>
  await browser.execute(() => {
    let count = 0;

    // IMPORTANT: scan the whole document, not just body descendants
    const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
    for (const el of all) {
      const sr = (el as any).shadowRoot as ShadowRoot | undefined;
      if (sr && sr.querySelector('.app-container')) count++;
    }

    return count;
  });

export const waitForReadCursorHost = async () => {
  try {
    await browser.waitUntil(async () => (await countReadCursorInstances()) >= 1, {
      timeout: 20000,
      timeoutMsg: 'ReadCursor shadow host not found (no .app-container in any shadowRoot)',
    });
  } catch (e) {
    // Add useful diagnostics so you’re not blind when it fails
    const diag = await browser.execute(() => {
      const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      const shadowHosts = all.filter(el => (el as any).shadowRoot) as HTMLElement[];

      const sample = shadowHosts.slice(0, 6).map(el => {
        const sr = (el as any).shadowRoot as ShadowRoot;
        return {
          tag: el.tagName,
          id: el.id || null,
          className: (el as any).className || null,
          hasAppContainer: !!sr?.querySelector('.app-container'),
        };
      });

      return {
        href: location.href,
        lightDomHasAppContainer: !!document.querySelector('.app-container'),
        shadowHostCount: shadowHosts.length,
        sample,
      };
    });

    throw new Error(`ReadCursor shadow host not found. Diagnostics: ${JSON.stringify(diag)}`);
  }

  // Tag the host so we can select it deterministically
  await browser.execute((marker: string) => {
    const existing = document.querySelector(`[${marker}="1"]`);
    if (existing) return;

    const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
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
