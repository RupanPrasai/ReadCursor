const HOST_MARKER = 'data-readcursor-e2e-host';

type WinInfo = { handle: string; url: string; title?: string };

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

const isPopupUrl = (u: string, popupUrl: string) =>
  u === popupUrl || u.startsWith(`${popupUrl}#`) || u.startsWith(`${popupUrl}?`);

export const openPopupInNewTab = async () => {
  // IMPORTANT: call this while the fixture tab is focused
  const extensionPath = await browser.getExtensionPath();
  const popupUrl = `${extensionPath}/popup/index.html`;

  const openerHandle = await browser.getWindowHandle();

  // Prefer window.open to keep it in the same Chrome window (so currentWindow tab queries can still see the fixture).
  const before = new Set(await browser.getWindowHandles());
  await browser.execute((url: string) => window.open(url, '_blank'), popupUrl);

  // Wait for a new handle OR the popup URL to appear somewhere
  let popupHandle: string | null = null;

  try {
    await browser.waitUntil(
      async () => {
        const handles = await browser.getWindowHandles();

        // If a new handle appears, great, but don't assume it's the popup yet.
        if (handles.length > before.size) {
          // keep going; we'll confirm by URL below
        }

        // Find by URL (most reliable)
        for (const h of handles) {
          await browser.switchToWindow(h);
          const u = await browser.getUrl();
          if (isPopupUrl(u, popupUrl)) {
            popupHandle = h;
            return true;
          }
        }
        return false;
      },
      { timeout: 20000, timeoutMsg: `Popup handle not found by URL: ${popupUrl}` },
    );
  } catch {
    const diag = await listWindows();
    console.log('[E2E] openPopupInNewTab diagnostics:', JSON.stringify(diag, null, 2));
    throw new Error(`Popup handle not found by URL: ${popupUrl}`);
  }

  if (!popupHandle) {
    const diag = await listWindows();
    console.log('[E2E] openPopupInNewTab: missing popupHandle:', JSON.stringify(diag, null, 2));
    throw new Error('Popup handle not found');
  }

  await browser.switchToWindow(popupHandle);

  // Ensure we really are on the popup URL (sometimes it briefly shows about:blank)
  await browser.waitUntil(
    async () => {
      const u = await browser.getUrl();
      return isPopupUrl(u, popupUrl);
    },
    {
      timeout: 10000,
      timeoutMsg: `Popup URL mismatch (expected ${popupUrl}, got ${await browser.getUrl()})`,
    },
  );

  // UI exists
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
        { type: 'pointerMove', duration: 150, x: startX + dx, y: startY + dy },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
  await browser.releaseActions();
};
