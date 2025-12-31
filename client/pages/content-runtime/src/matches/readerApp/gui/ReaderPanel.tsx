import { DragBar } from './DragBar';
import { IconButton } from './IconButton';
import { PanelShell } from './PanelShell';
import { PlaybackControls } from './PlaybackControls';
import { ResizeHandles } from './ResizeHandles';
import { SpeedControls } from './SpeedControls';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReaderController } from '../readerEngine/controller';

interface ReaderPanelProps {
  onDestroy: () => void;
  controller: ReaderController;
}

const MIN_WPM = 50;
const MAX_WPM = 350;
const STEP_WPM = 5;
const WPM_PRESETS = [100, 125, 150, 175, 200, 225];

const RESIZE_ENABLED = false;

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

function clampRectToViewport(rect: PanelRect, scale: number) {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Visually scaled size
  const sw = rect.width * scale;
  const sh = rect.height * scale;

  const maxLeft = Math.max(margin, vw - sw - margin);
  const maxTop = Math.max(margin, vh - sh - margin);

  return {
    ...rect,
    left: Math.min(Math.max(rect.left, margin), maxLeft),
    top: Math.min(Math.max(rect.top, margin), maxTop),
  };
}

export function ReaderPanel({ onDestroy, controller }: ReaderPanelProps) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const status = controller.getStatus();

  const [mode, setMode] = useState<PanelMode>('open');
  const [savedRect, setSavedRect] = useState<PanelRect | null>(null);
  const [pendingStyle, setPendingStyle] = useState<PendingStyle>(null);

  // ---- inverse-DPR scaling to neutralize browser zoom "getting huge"
  const baseDprRef = useRef<number | null>(null);
  const [panelScale, setPanelScale] = useState(1);
  const prevScaleRef = useRef(1);

  const { readerPanelRef, startDrag, startResize } = useDraggableResizable({
    minWidth: 300,
    maxWidth: 800,
    minHeight: 400,
    maxHeight: 800,
  });

  useLayoutEffect(() => {
    if (baseDprRef.current == null) baseDprRef.current = window.devicePixelRatio || 1;

    const update = () => {
      const base = baseDprRef.current || 1;
      const cur = window.devicePixelRatio || 1;

      // zoom-in => cur increases => scale < 1
      let s = base / cur;

      // Compensate both zoom-in and zoom-out (keeps physical size consistent)
      s = Math.min(1.4, Math.max(0.35, s));

      setPanelScale(s);
    };

    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  // Apply scale (only affects open mode; pill stays normal)
  // Apply scale (open + minimized pill)
  useLayoutEffect(() => {
    const el = readerPanelRef.current;
    if (!el) return;

    const next = panelScale; // ✅ scale both modes
    const prev = prevScaleRef.current || 1;
    if (prev === next) return;

    // Current visual rect under PREV scale
    const r = el.getBoundingClientRect();
    const unscaledW = Math.round(r.width / prev);
    const unscaledH = Math.round(r.height / prev);

    // Keep physical position stable across scale changes
    const leftUnscaled = r.left / prev;
    const topUnscaled = r.top / prev;

    const nextLeft = leftUnscaled * next;
    const nextTop = topUnscaled * next;

    el.style.transformOrigin = 'top left';
    el.style.transform = next === 1 ? '' : `scale(${next})`;

    const clamped = clampRectToViewport({ left: nextLeft, top: nextTop, width: unscaledW, height: unscaledH }, next);

    el.style.left = `${clamped.left}px`;
    el.style.top = `${clamped.top}px`;
    el.style.width = `${clamped.width}px`;
    el.style.height = `${clamped.height}px`;

    prevScaleRef.current = next;
  }, [panelScale]);

  const readRect = (): PanelRect | null => {
    const el = readerPanelRef.current;
    if (!el) return null;

    const r = el.getBoundingClientRect();
    const s = prevScaleRef.current || 1;

    return {
      left: Math.round(r.left / s),
      top: Math.round(r.top / s),
      width: Math.round(r.width / s),
      height: Math.round(r.height / s),
    };
  };

  const applyRect = (rect: PanelRect) => {
    const el = readerPanelRef.current;
    if (!el) return;

    const s = prevScaleRef.current || 1;

    // Convert unscaled -> CSS left/top for current scale
    const cssRect = {
      left: rect.left * s,
      top: rect.top * s,
      width: rect.width,
      height: rect.height,
    };

    const clamped = clampRectToViewport(cssRect, s);

    el.style.left = `${clamped.left}px`;
    el.style.top = `${clamped.top}px`;
    el.style.width = `${clamped.width}px`;
    el.style.height = `${clamped.height}px`;
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStyle]);

  const minimize = () => {
    const current = readRect();
    if (current) setSavedRect(current);

    const base = current ?? { left: 96, top: 96, width: 300, height: 400 };
    setMode('minimized');
    setPendingStyle({ kind: 'apply', rect: { left: base.left, top: base.top, width: PILL_W, height: PILL_H } });
  };

  const restore = () => {
    const pill = readRect(); // pill position
    const base = savedRect ?? { left: 96, top: 96, width: 300, height: 400 };

    const next: PanelRect = pill ? { ...base, left: pill.left, top: pill.top } : base;

    setMode('open');
    setSavedRect(next);
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
      resizeHandles={RESIZE_ENABLED ? <ResizeHandles startResize={startResize} /> : null}>
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
