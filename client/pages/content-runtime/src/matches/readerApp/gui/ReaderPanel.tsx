import { DragBar } from './DragBar';
import { IconButton } from './IconButton';
import { PanelShell } from './PanelShell';
import { PlaybackControls } from './PlaybackControls';
import { ResizeHandles } from './ResizeHandles';
import { SpeedControls } from './SpeedControls';
import { readCursorPrefsStorage, readCursorUiStateStorage } from '../../../../../../packages/storage/lib';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import { useStorage } from '@extension/shared';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, useCallback } from 'react';
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

const DEFAULT_OPEN_RECT: PanelRect = { left: 96, top: 96, width: 300, height: 400 };

export function ReaderPanel({ onDestroy, controller }: ReaderPanelProps) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const status = controller.getStatus();

  const prefs = useStorage(readCursorPrefsStorage);
  const ui = useStorage(readCursorUiStateStorage);

  const rememberPanelState = !!prefs?.rememberPanelState;
  const rememberPanelStateRef = useRef(rememberPanelState);
  useEffect(() => {
    rememberPanelStateRef.current = rememberPanelState;
  }, [rememberPanelState]);

  const [mode, setMode] = useState<PanelMode>('open');
  const [savedRect, setSavedRect] = useState<PanelRect | null>(null);
  const [pendingStyle, setPendingStyle] = useState<PendingStyle>(null);

  // ---- inverse-DPR scaling to neutralize browser zoom
  const baseDprRef = useRef<number | null>(null);
  const [panelScale, setPanelScale] = useState(1);
  const prevScaleRef = useRef(1);

  const { readerPanelRef, startDrag, startResize } = useDraggableResizable({
    minWidth: 300,
    maxWidth: 800,
    minHeight: 400,
    maxHeight: 800,
  });

  // Track drag/resize end so we can persist rect without spamming writes.
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);

  const startDragWrapped = useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = true;
      startDrag(e);
    },
    [startDrag],
  );

  const startResizeWrapped = useCallback(
    (e: React.MouseEvent, dir: any) => {
      resizingRef.current = true;
      startResize(e, dir);
    },
    [startResize],
  );

  const readRect = useCallback((): PanelRect | null => {
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
  }, [readerPanelRef]);

  const applyRect = useCallback(
    (rect: PanelRect) => {
      const el = readerPanelRef.current;
      if (!el) return;

      const s = prevScaleRef.current || 1;

      // Convert unscaled to CSS left/top for current scale
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
    },
    [readerPanelRef],
  );

  const clearInlineRect = useCallback(() => {
    const el = readerPanelRef.current;
    if (!el) return;
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
  }, [readerPanelRef]);

  const persistUi = useCallback(async (patch: { panelMode?: PanelMode; panelRect?: PanelRect | null }) => {
    if (!rememberPanelStateRef.current) return;
    await readCursorUiStateStorage.setPartial(patch as any);
  }, []);

  // Hydrate panel rect/mode from storage once (only if enabled).
  const hydratedRef = useRef(false);
  useLayoutEffect(() => {
    if (hydratedRef.current) return;
    if (!rememberPanelState) {
      hydratedRef.current = true;
      return;
    }
    if (!ui) return; // wait until storage snapshot is ready
    if (!readerPanelRef.current) return;

    const storedRect = (ui.panelRect as PanelRect | null) ?? null;
    const storedMode = (ui.panelMode as PanelMode) ?? 'open';

    setSavedRect(storedRect);

    if (storedMode === 'minimized') {
      const base = storedRect ?? DEFAULT_OPEN_RECT;
      setMode('minimized');
      setPendingStyle({ kind: 'apply', rect: { left: base.left, top: base.top, width: PILL_W, height: PILL_H } });
    } else if (storedRect) {
      setMode('open');
      setPendingStyle({ kind: 'apply', rect: storedRect });
    }

    hydratedRef.current = true;
  }, [rememberPanelState, ui, readerPanelRef]);

  // Persist on drag/resize end (mouseup/touchend).
  useEffect(() => {
    const onUp = () => {
      if (!rememberPanelStateRef.current) return;
      if (!draggingRef.current && !resizingRef.current) return;

      draggingRef.current = false;
      resizingRef.current = false;

      const rectNow = readRect();
      if (!rectNow) return;

      if (mode === 'open') {
        setSavedRect(rectNow);
        void persistUi({ panelMode: 'open', panelRect: rectNow });
        return;
      }

      // minimized: keep the open size, but update position from pill
      const base = savedRect ?? (ui?.panelRect as PanelRect | null) ?? DEFAULT_OPEN_RECT;
      const next: PanelRect = { ...base, left: rectNow.left, top: rectNow.top };

      setSavedRect(next);
      void persistUi({ panelMode: 'minimized', panelRect: next });
    };

    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('touchend', onUp, true);

    return () => {
      window.removeEventListener('mouseup', onUp, true);
      window.removeEventListener('touchend', onUp, true);
    };
  }, [mode, savedRect, ui?.panelRect, readRect, persistUi]);

  useLayoutEffect(() => {
    if (baseDprRef.current == null) baseDprRef.current = window.devicePixelRatio || 1;

    const update = () => {
      const base = baseDprRef.current || 1;
      const cur = window.devicePixelRatio || 1;

      // zoom-in => cur increases => scale < 1
      let s = base / cur;

      // Compensate for both zoom-in and zoom-out (keeps physical size consistent)
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

  // Apply scale (open & minimized pill)
  useLayoutEffect(() => {
    const el = readerPanelRef.current;
    if (!el) return;

    const next = panelScale;
    const prev = prevScaleRef.current || 1;
    if (prev === next) return;

    const r = el.getBoundingClientRect();
    const unscaledW = Math.round(r.width / prev);
    const unscaledH = Math.round(r.height / prev);

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
  }, [panelScale, readerPanelRef]);

  useLayoutEffect(() => {
    if (!pendingStyle) return;

    if (pendingStyle.kind === 'apply') applyRect(pendingStyle.rect);
    else clearInlineRect();

    setPendingStyle(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStyle]);

  const minimize = () => {
    const current = readRect();
    const base = current ?? savedRect ?? DEFAULT_OPEN_RECT;

    setSavedRect(base);

    setMode('minimized');
    setPendingStyle({ kind: 'apply', rect: { left: base.left, top: base.top, width: PILL_W, height: PILL_H } });

    void persistUi({ panelMode: 'minimized', panelRect: base });
  };

  const restore = () => {
    const pill = readRect(); // pill position
    const base = savedRect ?? (ui?.panelRect as PanelRect | null) ?? DEFAULT_OPEN_RECT;

    const next: PanelRect = pill ? { ...base, left: pill.left, top: pill.top } : base;

    setMode('open');
    setSavedRect(next);
    setPendingStyle({ kind: 'apply', rect: next });

    void persistUi({ panelMode: 'open', panelRect: next });
  };

  // --- WPM UI (single source of truth = controller status)
  const wpm = status.wpm;
  const editingRef = useRef(false);
  const [wpmText, setWpmText] = useState<string>(String(wpm));

  useEffect(() => {
    if (!editingRef.current) setWpmText(String(wpm));
  }, [wpm]);

  const onWpmChange = (next: number) => {
    editingRef.current = false;
    const clamped = clampInt(next, MIN_WPM, MAX_WPM);
    controller.setWPM(clamped);
    setWpmText(String(clamped));
  };

  const onWpmTextChange = (next: string) => {
    editingRef.current = true;
    setWpmText(next);
  };

  const commitWpmText = () => {
    editingRef.current = false;
    const parsed = Number(wpmText);
    if (!Number.isFinite(parsed)) {
      setWpmText(String(wpm));
      return;
    }
    const clamped = clampInt(parsed, MIN_WPM, MAX_WPM);
    controller.setWPM(clamped);
    setWpmText(String(clamped));
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

  // Minimized pill render
  if (mode === 'minimized') {
    return (
      <div
        ref={readerPanelRef}
        className="fixed z-[999999] flex select-none items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-2.5 shadow-2xl"
        aria-label="Reader panel minimized">
        {/* Drag handle ONLY */}
        <div
          onMouseDown={startDragWrapped}
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

  // Open render
  return (
    <PanelShell
      panelRef={readerPanelRef}
      dragBar={
        <DragBar onMouseDownDrag={startDragWrapped} onClose={onDestroy} onMinimize={minimize} statusNode={statusChip} />
      }
      resizeHandles={RESIZE_ENABLED ? <ResizeHandles startResize={startResizeWrapped as any} /> : null}>
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
        onWpmChange={onWpmChange}
        onWpmTextChange={onWpmTextChange}
        onCommitText={commitWpmText}
      />
    </PanelShell>
  );
}
