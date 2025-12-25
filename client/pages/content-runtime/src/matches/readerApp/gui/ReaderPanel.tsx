import { DragBar } from './DragBar';
import { PanelShell } from './PanelShell';
import { PlaybackControls } from './PlaybackControls';
import { ResizeHandles } from './ResizeHandles';
import { SpeedControls } from './SpeedControls';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReaderController } from '../readerEngine/controller';

interface ReaderPanelProps {
  onDestroy: () => void;
  controller: ReaderController;
}

const MIN_WPM = 50;
const MAX_WPM = 450;
const STEP_WPM = 10;
const WPM_PRESETS = [100, 150, 200, 250, 300];

function clampInt(raw: number, min: number, max: number) {
  const num = Number.isFinite(raw) ? Math.trunc(raw) : min;
  return Math.max(min, Math.min(max, num));
}

export function ReaderPanel({ onDestroy, controller }: ReaderPanelProps) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const status = controller.getStatus();

  const state = String(status.state ?? 'UNKNOWN');

  const statusPill =
    state === 'PLAYING'
      ? { label: 'Playing', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
      : state === 'PAUSED'
        ? { label: 'Paused', cls: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' }
        : state === 'READY' || state === 'STOPPED'
          ? { label: 'Ready', cls: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' }
          : { label: state, cls: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' };

  const { readerPanelRef, startDrag, startResize } = useDraggableResizable({
    minWidth: 300,
    maxWidth: 800,
    minHeight: 400,
    maxHeight: 800,
  });

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

  return (
    <PanelShell
      panelRef={readerPanelRef}
      dragBar={<DragBar onMouseDownDrag={startDrag} onClose={onDestroy} />}
      resizeHandles={<ResizeHandles startResize={startResize} />}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Reader Panel</h2>
            <p className="mt-0.5 text-xs text-slate-600">Floating Panel</p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${statusPill.cls}`}
            title={`State: ${state}`}
            aria-label={`Reader status: ${statusPill.label}`}>
            <span className={`h-2 w-2 rounded-full ${statusPill.dot}`} />
            {statusPill.label}
          </div>
        </div>

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
