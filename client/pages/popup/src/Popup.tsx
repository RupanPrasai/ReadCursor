import '@src/Popup.css';
import { t } from '@extension/i18n';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { useState } from 'react';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon32.png'),
  title: 'Injecting content script error',
  message: 'You cannot inject script here!',
} as const;

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = 'popup/iconbase.png';

  const [injecting, setInjecting] = useState(false);

  const isBlockedInjectUrl = (url: string) =>
    url.startsWith('about:') ||
    url.startsWith('chrome:') ||
    url.startsWith('chrome-extension:') ||
    url.startsWith('edge:') ||
    url.startsWith('devtools:') ||
    url.startsWith('view-source:') ||
    url.startsWith('data:');

  const pickInjectionTab = async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });

    const extBase = chrome.runtime.getURL(''); // chrome-extension://<id>/
    const isHttp = (url: string) => url.startsWith('http://') || url.startsWith('https://');

    const isInjectable = (t: chrome.tabs.Tab) => {
      const url = t.url ?? '';
      if (!t.id) return false;
      if (!url) return false;
      if (!isHttp(url)) return false;
      if (isBlockedInjectUrl(url)) return false;
      if (url.startsWith(extBase)) return false;
      return true;
    };

    const active = tabs.find(t => t.active);
    if (active?.url) {
      // If active is a blocked system page, do not inject elsewhere.
      if (isBlockedInjectUrl(active.url)) return null;

      // Normal case: active is a normal page, inject into it.
      if (isInjectable(active)) return active;

      // E2E case: active is the popup opened as a tab (extension page), fallback allowed.
      if (active.url.startsWith(extBase)) {
        return tabs.find(isInjectable) ?? null;
      }

      return null;
    }

    return null;
  };

  const injectContentScript = async () => {
    if (injecting) return;
    setInjecting(true);

    try {
      const tab = await pickInjectionTab();
      if (!tab?.id) {
        chrome.notifications.create('inject-error', notificationOptions);
        return;
      }

      if (isBlockedInjectUrl(tab.url ?? '')) {
        chrome.notifications.create('inject-error', notificationOptions);
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-runtime/readerApp.iife.js'],
      });
    } catch (err: any) {
      // Don’t silently swallow non-chrome:// failures (this was hiding your E2E issue)
      chrome.notifications.create('inject-error', notificationOptions);
      console.warn('[ReadCursor] inject failed', err);
    } finally {
      setInjecting(false);
    }
  };

  return (
    <main className={cn('popup-root', isLight ? 'theme-light' : 'theme-dark')} aria-label="Extension popup">
      <div className="card">
        <header className="header headerHero">
          <div className="brandHero" aria-label="Read Cursor">
            <img src={chrome.runtime.getURL(logo)} className="brandLogoHero" alt="Read Cursor logo" />
          </div>

          <div className="titleHero">Read Cursor</div>
        </header>

        <section className="content">
          <button
            type="button"
            className={cn('primaryBtn', injecting && 'disabledBtn')}
            onClick={injectContentScript}
            disabled={injecting}
            aria-busy={injecting}>
            {injecting ? 'Opening…' : 'Open Read Cursor'}
          </button>
          <div className="hint">Opens on the current tab</div>

          <div className="footerRow">
            <div className="toggleHidden" aria-hidden="true">
              <ToggleButton className="secondaryBtn" disabled>
                {t('toggleTheme')}
              </ToggleButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
