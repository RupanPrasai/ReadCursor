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

  const pickInjectionTab = async () => {
    const [active] = await chrome.tabs.query({ currentWindow: true, active: true });
    if (!active?.id) return null;

    try {
      const current = await chrome.tabs.getCurrent();
      if (current?.id && active.id === current.id) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const other = tabs.find(t => t.id && t.id !== current.id);
        if (other?.id) return other;
      }
    } catch {
      // chrome.tabs.getCurrent can be unsupported in some extension contexts; ignore.
    }

    return active;
  };

  const injectContentScript = async () => {
    if (injecting) return;
    setInjecting(true);

    try {
      const tab = await pickInjectionTab();
      if (!tab?.id) return;

      const url = tab.url ?? '';
      if (url.startsWith('about:') || url.startsWith('chrome:')) {
        chrome.notifications.create('inject-error', notificationOptions);
        return;
      }

      await chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ['/content-runtime/readerApp.iife.js'],
        })
        .catch(err => {
          if (err?.message?.includes?.('Cannot access a chrome:// URL')) {
            chrome.notifications.create('inject-error', notificationOptions);
          }
        });
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
