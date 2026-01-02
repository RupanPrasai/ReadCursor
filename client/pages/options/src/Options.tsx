import '@src/Options.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';

// Options need to be configured at a future iteration
// Although base functionality of the software works fine
// Without it --- At the moment

const Options = () => {
  const logo = 'options/iconbase.png';

  return (
    <div className="options-root">
      <main className="options-page" role="main" aria-label="Read Cursor Options">
        <div className="logo-block" aria-hidden="true">
          <img className="logo" src={chrome.runtime.getURL(logo)} alt="" />
        </div>

        <h1 className="title">Read Cursor</h1>

        <p className="subtitle">Options are coming in a future release. v1 ships with sensible defaults.</p>

        <button className="cta" type="button" disabled>
          Options coming soon
        </button>

        <p className="hint">Nothing to configure yet.</p>
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
