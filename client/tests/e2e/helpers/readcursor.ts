const HOST_MARKER = 'data-readcursor-e2e-host';

type WinInfo = { handle: string; url: string; title?: string };

const isPopupUrl = (u: string, popupUrl: string) =>
  u === popupUrl || u.startsWith(`${popupUrl}#`) || u.startsWith(`${popupUrl}?`);

const listWindows = async (): Promise<WinInfo[]> => {
  const out: WinInfo[] = [];
  const handles = await browser.getWindowHandles();

  for (const h of handles) {
    try {
      await browser.switchToWindow(h);
      const url = await browser.getUrl();
      const title = await browser.getTitle().catch(() => '');
      out.push({ handle: h, url, title });
    } catch (e: any) {
      out.push({ handle: h, url: `<error: ${String(e?.message ?? e)}>`, title: '' });
    }
  }
  return out;
};

export const openPopupInNewTab = async () => {
  const extensionPath = await browser.getExtensionPath();
  const popupUrl = `${extensionPath}/popup/index.html`;

  const openerHandle = await browser.getWindowHandle();
  const before = new Set(await browser.getWindowHandles());

  // Create a real browser tab/window via WebDriver
  await browser.newWindow('about:blank');

  await browser.waitUntil(async () => (await browser.getWindowHandles()).length > before.size, {
    timeout: 1500,
    timeoutMsg: `Popup tab/window not created (about:blank)`,
  });

  const after = await browser.getWindowHandles();
  const popupHandle = after.find(h => !before.has(h)) ?? null;

  if (!popupHandle) {
    const diag = await listWindows();
    console.log('[E2E] openPopupInNewTab: missing new handle:', JSON.stringify(diag, null, 2));
    throw new Error('Popup handle not found after newWindow(about:blank)');
  }

  await browser.switchToWindow(popupHandle);

  // Navigate via WebDriver (not window.open) to avoid Chromium blocking
  await browser.url(popupUrl);

  await browser.waitUntil(async () => isPopupUrl(await browser.getUrl(), popupUrl), {
    timeout: 15000,
    timeoutMsg: `Popup URL mismatch (expected ${popupUrl}, got ${await browser.getUrl()})`,
  });

  const currentUrl = await browser.getUrl();
  if (!currentUrl.startsWith('chrome-extension://')) {
    const diag = await listWindows();
    console.log('[E2E] openPopupInNewTab diagnostics:', JSON.stringify(diag, null, 2));
    throw new Error(`Popup did not land on chrome-extension:// (got ${currentUrl})`);
  }

  // We do NOT wait for the "Open Read Cursor" button anymore.
  // This tab is used as an extension context for chrome.runtime.sendMessage (E2E hooks).

  return { popupUrl, popupHandle, openerHandle };
};

const ensureExtensionContextTab = async () => {
  const extensionPath = await browser.getExtensionPath();
  const popupUrl = `${extensionPath}/popup/index.html`;

  const openerHandle = await browser.getWindowHandle();
  const before = new Set(await browser.getWindowHandles());

  await browser.newWindow('about:blank');

  await browser.waitUntil(async () => (await browser.getWindowHandles()).length > before.size, {
    timeout: 1500,
    timeoutMsg: `Extension context tab not created (about:blank)`,
  });

  const after = await browser.getWindowHandles();
  const handle = after.find(h => !before.has(h)) ?? null;

  if (!handle) {
    const diag = await listWindows();
    console.log('[E2E] ensureExtensionContextTab: missing new handle:', JSON.stringify(diag, null, 2));
    throw new Error('Extension context handle not found after newWindow(about:blank)');
  }

  await browser.switchToWindow(handle);
  await browser.url(popupUrl);

  await browser.waitUntil(async () => isPopupUrl(await browser.getUrl(), popupUrl), {
    timeout: 15000,
    timeoutMsg: `Extension context URL mismatch (expected ${popupUrl}, got ${await browser.getUrl()})`,
  });

  // Wait for runtime API to actually be available (prevents early undefined)
  await browser.waitUntil(
    async () =>
      (await browser.execute(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chromeAny = (globalThis as any).chrome;
        return !!chromeAny?.runtime?.sendMessage;
      })) === true,
    {
      timeout: 15000,
      timeoutMsg: 'chrome.runtime.sendMessage not available in extension context',
    },
  );

  return { openerHandle, handle };
};

/**
 * E2E-only injection through background hook.
 *
 * IMPORTANT:
 * This must run in an extension context, but tests are usually on the fixture tab.
 * So this function temporarily opens the extension popup page in a new tab, sends
 * the message, then returns to the original tab.
 */
export const e2eInjectIntoFixture = async (urlPrefix: string) => {
  const { openerHandle, handle } = await ensureExtensionContextTab();

  const res = await browser.executeAsync((prefix: string, done: (v: any) => void) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromeAny = (globalThis as any).chrome;
      if (!chromeAny?.runtime?.sendMessage) {
        done({ ok: false, error: 'chrome.runtime.sendMessage unavailable (not in extension context?)' });
        return;
      }

      chromeAny.runtime.sendMessage({ type: 'RC_E2E_INJECT', urlPrefix: prefix }, (reply: any) => {
        const err = chromeAny.runtime.lastError;
        if (err) done({ ok: false, error: String(err.message ?? err) });
        else done(reply ?? { ok: false, error: 'no reply' });
      });
    } catch (e: any) {
      done({ ok: false, error: String(e?.message ?? e) });
    }
  }, urlPrefix);

  // Close extension tab and return to fixture tab
  await browser.closeWindow();
  await browser.switchToWindow(openerHandle);

  if (!res?.ok) {
    throw new Error(`RC_E2E_INJECT failed: ${JSON.stringify(res)}`);
  }

  return res;
};

// Kept for future “popup UI smoke” tests. Don’t use this for injection anymore.
export const clickOpenReadCursor = async () => {
  const btn = await $('button=Open Read Cursor');
  await btn.waitForClickable();
  await btn.click();

  await browser
    .waitUntil(async () => (await btn.getAttribute('aria-busy')) === 'true', { timeout: 1000 })
    .catch(() => {
      // ignore if too fast
    });

  await browser.waitUntil(async () => (await btn.getAttribute('aria-busy')) !== 'true', {
    timeout: 15000,
    timeoutMsg: 'Popup inject button stayed busy too long',
  });
};

export const countReadCursorInstances = async () =>
  await browser.execute(() => {
    let count = 0;
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
  } catch {
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
