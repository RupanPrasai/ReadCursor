const HOST_MARKER = 'data-readcursor-e2e-host';
const RC_ROOT_ID = '__ROOT_READERPANEL__';

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

  // Create a real browser tab/window via WebDriver (allowed)
  await browser.newWindow('about:blank');

  // Identify the newly created handle
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

  // Popup should be loaded; keep the old wait for stability across builds.
  await $('button=Open Read Cursor').waitForExist({ timeout: 15000 });

  return { popupUrl, popupHandle, openerHandle };
};

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

/**
 * E2E-only injection that bypasses popup "activeTab" semantics.
 * Requires:
 * - E2E build manifest to include host_permissions for the fixture origin
 * - background to implement RC_E2E_INJECT
 *
 * IMPORTANT: Call this from an extension page context (popup/options).
 */
export const e2eInjectIntoFixture = async (urlPrefix: string) => {
  const result = await browser.executeAsync((prefix: string, done: (out: any) => void) => {
    try {
      chrome.runtime.sendMessage({ type: 'RC_E2E_INJECT', urlPrefix: prefix }, resp => {
        const lastErr = chrome.runtime.lastError?.message ?? null;
        done({ resp, lastErr });
      });
    } catch (e: any) {
      done({ resp: null, lastErr: String(e?.message ?? e) });
    }
  }, urlPrefix);

  if (result?.lastErr) {
    throw new Error(`RC_E2E_INJECT runtime error: ${result.lastErr}`);
  }
  if (!result?.resp?.ok) {
    throw new Error(`RC_E2E_INJECT failed: ${result?.resp?.error ?? 'unknown error'}`);
  }

  return result.resp as { ok: true; tabId: number };
};

export const countReadCursorInstances = async () =>
  await browser.execute((rootId: string) => {
    const nodes = Array.from(document.querySelectorAll(`#${CSS.escape(rootId)}`)) as HTMLElement[];
    let count = 0;

    for (const el of nodes) {
      const sr = (el as any).shadowRoot as ShadowRoot | undefined;
      if (sr && sr.querySelector('.app-container')) count++;
    }

    // Fallback for older builds: scan any shadowRoot for .app-container
    if (count === 0) {
      const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      for (const el of all) {
        const sr = (el as any).shadowRoot as ShadowRoot | undefined;
        if (sr && sr.querySelector('.app-container')) count++;
      }
    }

    return count;
  }, RC_ROOT_ID);

export const waitForReadCursorHost = async () => {
  try {
    await browser.waitUntil(
      async () =>
        (await browser.execute((rootId: string) => {
          const els = Array.from(document.querySelectorAll(`#${CSS.escape(rootId)}`)) as HTMLElement[];
          if (!els.length) return false;

          // If duplicates exist (bad but possible), accept first with mounted app
          for (const el of els) {
            const sr = (el as any).shadowRoot as ShadowRoot | undefined;
            if (sr && sr.querySelector('.app-container')) return true;
          }
          return false;
        }, RC_ROOT_ID)) === true,
      {
        timeout: 20000,
        timeoutMsg: `ReadCursor host not found (#${RC_ROOT_ID} with .app-container in shadowRoot)`,
      },
    );
  } catch {
    const diag = await browser.execute((rootId: string) => {
      const els = Array.from(document.querySelectorAll(`#${CSS.escape(rootId)}`)) as HTMLElement[];
      const info = els.map(el => {
        const sr = (el as any).shadowRoot as ShadowRoot | undefined;
        return {
          tag: el.tagName,
          id: el.id || null,
          hasShadowRoot: !!sr,
          hasAppContainer: !!sr?.querySelector('.app-container'),
        };
      });

      // Useful globals set by your runtime
      const globals = {
        readerPanelGuiActive: (window as any).readerPanelGuiActive ?? null,
        hasSingleton: !!(window as any).__READCURSOR_SINGLETON__,
      };

      // General shadowRoot sampling (for debugging if ROOT_ID ever changes)
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
        rootId,
        rootMatches: els.length,
        rootInfo: info,
        globals,
        shadowHostCount: shadowHosts.length,
        sample,
      };
    }, RC_ROOT_ID);

    throw new Error(`ReadCursor host not found. Diagnostics: ${JSON.stringify(diag)}`);
  }

  // Tag the host for convenience
  await browser.execute(
    (marker: string, rootId: string) => {
      const existing = document.querySelector(`[${marker}="1"]`);
      if (existing) return;

      const els = Array.from(document.querySelectorAll(`#${CSS.escape(rootId)}`)) as HTMLElement[];
      for (const el of els) {
        const sr = (el as any).shadowRoot as ShadowRoot | undefined;
        if (sr && sr.querySelector('.app-container')) {
          el.setAttribute(marker, '1');
          return;
        }
      }

      // Fallback: tag any host with .app-container
      const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      for (const el of all) {
        const sr = (el as any).shadowRoot as ShadowRoot | undefined;
        if (sr && sr.querySelector('.app-container')) {
          el.setAttribute(marker, '1');
          return;
        }
      }
    },
    HOST_MARKER,
    RC_ROOT_ID,
  );

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
