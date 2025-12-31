import '@src/Popup.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { useState } from 'react';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon-34.png'),
  title: 'Injecting content script error',
  message: 'You cannot inject script here!',
} as const;

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = isLight ? 'popup/logo_vertical.svg' : 'popup/logo_vertical_dark.svg';

  const [injecting, setInjecting] = useState(false);

  // ✅ keep logic the same; only wrapped with a small loading state for UX
  const injectContentScript = async () => {
    if (injecting) return;
    setInjecting(true);

    try {
      const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

      if (tab.url!.startsWith('about:') || tab.url!.startsWith('chrome:')) {
        chrome.notifications.create('inject-error', notificationOptions);
        return;
      }

      await chrome.scripting
        .executeScript({
          target: { tabId: tab.id! },
          files: ['/content-runtime/readerApp.iife.js'],
        })
        .catch(err => {
          if (err.message.includes('Cannot access a chrome:// URL')) {
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
        <header className="header">
          <div className="brand" aria-label="Read Cursor">
            <img src={chrome.runtime.getURL(logo)} className="brandLogo" alt="Read Cursor logo" />
          </div>

          <div className="brandText">
            <div className="title">Read Cursor</div>
            <div className="subtitle">Open the Read Cursor Extension</div>
          </div>
        </header>

        <section className="content">
          <button
            type="button"
            className={cn('primaryBtn', injecting && 'disabledBtn')}
            onClick={injectContentScript}
            disabled={injecting}
            aria-busy={injecting}>
            {injecting ? 'Opening…' : t('injectButton')}
          </button>

          <div className="footerRow">
            <div className="toggleDisabled" title="Coming soon" aria-label="Theme toggle disabled">
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
