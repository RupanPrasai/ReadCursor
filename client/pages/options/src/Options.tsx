import '@src/Options.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { readCursorPrefsStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_WPM = 50;
const MAX_WPM = 350;

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

type SaveState = 'idle' | 'saving' | 'saved';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rcopt-section">
      <div className="rcopt-sectionTitle">{title}</div>
      <div className="rcopt-sectionBody">{children}</div>
    </section>
  );
}

function Row({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  return (
    <div className="rcopt-row">
      <div className="rcopt-rowLeft">
        <div className="rcopt-label">{label}</div>
        {hint ? <div className="rcopt-hint">{hint}</div> : null}
      </div>
      <div className="rcopt-rowRight">{right}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className={cn('rcopt-toggle', checked && 'rcopt-toggleOn')}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}>
      <span className="rcopt-toggleKnob" />
    </button>
  );
}

const Options = () => {
  const prefs = useStorage(readCursorPrefsStorage);

  // Local editable fields (avoid jitter while typing)
  const [defaultWpmText, setDefaultWpmText] = useState<string>('150');
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const saveTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  const canRender = !!prefs;

  // keep text in sync with storage snapshot
  useEffect(() => {
    if (!prefs) return;
    setDefaultWpmText(String(prefs.defaultWpm));
  }, [prefs?.defaultWpm]);

  const scheduleSavedIndicator = () => {
    setSaveState('saved');
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSaveState('idle'), 900);
  };

  const scheduleSave = (patch: Parameters<typeof readCursorPrefsStorage.setPartial>[0]) => {
    setSaveState('saving');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(async () => {
      await readCursorPrefsStorage.setPartial(patch);
      scheduleSavedIndicator();
    }, 350);
  };

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    },
    [],
  );

  const statusText = useMemo(() => {
    if (saveState === 'saving') return 'Saving…';
    if (saveState === 'saved') return 'Saved';
    return '';
  }, [saveState]);

  if (!canRender) return null;

  return (
    <main className="rcopt-root" aria-label="ReadCursor options">
      <div className="rcopt-shell">
        <header className="rcopt-header">
          <div className="rcopt-title">ReadCursor Options</div>
          <div className={cn('rcopt-status', saveState !== 'idle' && 'rcopt-statusShow')}>{statusText}</div>
        </header>

        <div className="rcopt-card">
          <Section title="Playback">
            <Row
              label="Default WPM"
              hint="Used when starting ReadCursor (unless Remember last WPM is enabled)."
              right={
                <div className="rcopt-wpm">
                  <input
                    className="rcopt-input"
                    type="number"
                    inputMode="numeric"
                    min={MIN_WPM}
                    max={MAX_WPM}
                    value={defaultWpmText}
                    aria-label="Default words per minute"
                    onChange={e => setDefaultWpmText(e.target.value)}
                    onBlur={() => {
                      const next = clampInt(Number(defaultWpmText), MIN_WPM, MAX_WPM);
                      setDefaultWpmText(String(next));
                      scheduleSave({ defaultWpm: next });
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                  />
                  <span className="rcopt-unit">WPM</span>
                </div>
              }
            />

            <Row
              label="Remember last WPM"
              hint="If enabled, the last speed you used becomes the next default."
              right={
                <Toggle
                  checked={prefs.rememberLastWpm}
                  ariaLabel="Remember last WPM"
                  onChange={next => scheduleSave({ rememberLastWpm: next })}
                />
              }
            />
          </Section>

          <Section title="Highlight">
            <Row
              label="Highlight color"
              hint="Applies to the reading highlight."
              right={
                <div className="rcopt-color">
                  <input
                    type="color"
                    className="rcopt-colorInput"
                    aria-label="Highlight color"
                    value={prefs.highlightColor}
                    onChange={e => scheduleSave({ highlightColor: e.target.value })}
                  />
                  <input
                    className="rcopt-input rcopt-colorText"
                    value={prefs.highlightColor}
                    aria-label="Highlight color hex"
                    onChange={e => scheduleSave({ highlightColor: e.target.value })}
                  />
                </div>
              }
            />
          </Section>

          <Section title="Behavior">
            <Row
              label="Auto-scroll"
              hint="Scrolls the page to keep the current block visible while reading."
              right={
                <Toggle
                  checked={prefs.autoScrollEnabled}
                  ariaLabel="Auto-scroll"
                  onChange={next => scheduleSave({ autoScrollEnabled: next })}
                />
              }
            />

            <Row
              label="Start from selection"
              hint="Enables the Start-from-here behavior for selected text."
              right={
                <Toggle
                  checked={prefs.startFromSelectionEnabled}
                  ariaLabel="Start from selection"
                  onChange={next => scheduleSave({ startFromSelectionEnabled: next })}
                />
              }
            />

            <Row
              label="Remember panel state"
              hint="Persists minimized/open state and panel position (once implemented)."
              right={
                <Toggle
                  checked={prefs.rememberPanelState}
                  ariaLabel="Remember panel state"
                  onChange={next => scheduleSave({ rememberPanelState: next })}
                />
              }
            />
          </Section>

          <div className="rcopt-footer">
            <button
              type="button"
              className="rcopt-btn rcopt-btnGhost"
              onClick={async () => {
                setSaveState('saving');
                await readCursorPrefsStorage.reset();
                scheduleSavedIndicator();
              }}>
              Reset to defaults
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
