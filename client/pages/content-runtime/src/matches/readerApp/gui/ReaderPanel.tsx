import { DragBar } from './DragBar';
import { IconButton } from './IconButton';
import { PanelShell } from './PanelShell';
import { PlaybackControls } from './PlaybackControls';
import { ResizeHandles } from './ResizeHandles';
import { SpeedControls } from './SpeedControls';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReaderController } from '../readerEngine/controller';

interface ReaderPanelProps {
  onDestroy: () => void;
  controller: ReaderController;
}

const MIN_WPM = 50;
const MAX_WPM = 450;
const STEP_WPM = 10;
const WPM_PRESETS = [100, 150, 200, 250, 300];

// Pill sizing (minimized mode)
const PILL_W = 220;
const PILL_H = 44;

type PanelMode = 'open' | 'minimized';

type PanelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PendingStyle = { kind: 'apply'; rect: PanelRect } | { kind: 'clear' } | null;

function clampInt(raw: number, min: number, max: number) {
  const num = Number.isFinite(raw) ? Math.trunc(raw) : min;
  return Math.max(min, Math.min(max, num));
}

function clampRectToViewport(rect: PanelRect) {
  const margin = 8;
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

  return {
    ...rect,
    left: Math.min(Math.max(rect.left, margin), maxLeft),
    top: Math.min(Math.max(rect.top, margin), maxTop),
  };
}

export function ReaderPanel({ onDestroy, controller }: ReaderPanelProps) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const status = controller.getStatus();

  const { readerPanelRef, startDrag, startResize } = useDraggableResizable({
    minWidth: 300,
    maxWidth: 800,
    minHeight: 400,
    maxHeight: 800,
  });

  const [mode, setMode] = useState<PanelMode>('open');
  const [savedRect, setSavedRect] = useState<PanelRect | null>(null);
  const [pendingStyle, setPendingStyle] = useState<PendingStyle>(null);

  const state = String(status.state ?? 'UNKNOWN');

  const statusPill = useMemo(
    () =>
      state === 'PLAYING'
        ? { label: 'Playing', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
        : state === 'PAUSED'
          ? { label: 'Paused', cls: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' }
          : state === 'READY' || state === 'STOPPED'
            ? { label: 'Ready', cls: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' }
            : { label: state, cls: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' },
    [state],
  );

  const statusChip = (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusPill.cls}`}
      title={`State: ${state}`}
      aria-label={`Reader status: ${statusPill.label}`}>
      <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${statusPill.dot}`} aria-hidden="true" />
      {statusPill.label}
    </span>
  );

  const readRect = (): PanelRect | null => {
    const el = readerPanelRef.current;
    if (!el) return null;

    const r = el.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      top: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  };

  const applyRect = (rect: PanelRect) => {
    const el = readerPanelRef.current;
    if (!el) return;

    const clamped = clampRectToViewport(rect);
    el.style.left = `${clamped.left}px`;
    el.style.top = `${clamped.top}px`;
    el.style.width = `${clamped.width}px`;
    el.style.height = `${clamped.height}px`;
  };

  const clearInlineRect = () => {
    const el = readerPanelRef.current;
    if (!el) return;
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
  };

  useLayoutEffect(() => {
    if (!pendingStyle) return;

    if (pendingStyle.kind === 'apply') applyRect(pendingStyle.rect);
    else clearInlineRect();

    setPendingStyle(null);
  }, [pendingStyle]);

  const minimize = () => {
    const current = readRect();
    if (current) setSavedRect(current);

    const base = current ?? { left: 96, top: 96, width: 300, height: 400 };
    setMode('minimized');
    setPendingStyle({ kind: 'apply', rect: { left: base.left, top: base.top, width: PILL_W, height: PILL_H } });
  };

  const restore = () => {
    // While still minimized, grab the pill’s current position.
    const pill = readRect(); // pill width/height will be PILL_W/PILL_H

    const base = savedRect ?? { left: 96, top: 96, width: 300, height: 400 };

    const next: PanelRect = pill
      ? { ...base, left: pill.left, top: pill.top } // keep open size, move to pill location
      : base;

    setMode('open');
    setSavedRect(next); // so future minimize/restore uses the updated open position
    setPendingStyle({ kind: 'apply', rect: next });
  };

  const [wpm, setWpm] = useState<number>(150);
  const [wpmText, setWpmText] = useState<string>('150');

  useEffect(() => {
    setWpmText(String(wpm));
  }, [wpm]);

  useEffect(() => {
    controller.setWPM(wpm);
  }, [controller, wpm]);

  const commitWpmText = () => {
    const parsed = Number(wpmText);
    if (!Number.isFinite(parsed)) {
      setWpmText(String(wpm));
      return;
    }
    setWpm(clampInt(parsed, MIN_WPM, MAX_WPM));
  };

  function GripIcon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="9" cy="7" r="1.2" fill="currentColor" />
        <circle cx="15" cy="7" r="1.2" fill="currentColor" />
        <circle cx="9" cy="12" r="1.2" fill="currentColor" />
        <circle cx="15" cy="12" r="1.2" fill="currentColor" />
        <circle cx="9" cy="17" r="1.2" fill="currentColor" />
        <circle cx="15" cy="17" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  // -----------------------------
  // Minimized pill render
  // -----------------------------
  if (mode === 'minimized') {
    return (
      <div
        ref={readerPanelRef}
        className="fixed z-[999999] flex select-none items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-2.5 shadow-2xl"
        aria-label="Reader panel minimized">
        {/* Drag handle ONLY */}
        <div
          onMouseDown={startDrag}
          onDoubleClick={restore}
          title="Drag (double-click to restore)"
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
          aria-label="Drag minimized pill">
          <GripIcon className="h-7 w-7 shrink-0 text-slate-400 opacity-70 hover:opacity-90" />
          {statusChip}
        </div>

        {/* Buttons (non-draggable) */}
        <div className="flex items-center gap-1">
          <IconButton ariaLabel="Restore reader panel" title="Restore" variant="success" onClick={restore}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </IconButton>

          <IconButton ariaLabel="Close extension" title="Close" variant="danger" onClick={onDestroy}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>
      </div>
    );
  }

  // -----------------------------
  // Open render
  // -----------------------------
  return (
    <PanelShell
      panelRef={readerPanelRef}
      dragBar={
        <DragBar onMouseDownDrag={startDrag} onClose={onDestroy} onMinimize={minimize} statusNode={statusChip} />
      }
      resizeHandles={<ResizeHandles startResize={startResize} />}>
      <div className="p-4">
        <h2 className="sr-only">Reader</h2>

        <div className="mt-3">
          <PlaybackControls
            onPrev={() => controller.prevBlock()}
            onPlay={() => controller.play()}
            onPause={() => controller.pause()}
            onStop={() => controller.stop()}
            onNext={() => controller.nextBlock()}
            canPrev={status.canPrevBlock}
            canPlay={status.canPlay}
            canPause={status.canPause}
            canStop={status.canStop}
            canNext={status.canNextBlock}
          />
        </div>
      </div>

      <SpeedControls
        wpm={wpm}
        wpmText={wpmText}
        minWpm={MIN_WPM}
        maxWpm={MAX_WPM}
        stepWpm={STEP_WPM}
        presets={WPM_PRESETS}
        onWpmChange={setWpm}
        onWpmTextChange={setWpmText}
        onCommitText={commitWpmText}
      />
    </PanelShell>
  );
}
