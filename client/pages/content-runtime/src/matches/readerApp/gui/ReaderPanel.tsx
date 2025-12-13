import { useDraggableResizable } from '../hooks/useDraggableResizable';
import { useEffect, useMemo, useState } from 'react';
import type { ReaderController } from '../readerEngine/controller';

interface ReaderPanelProps {
  onDestroy: () => void;
  controller: ReaderController;
}

const MIN_WPM = 100;
const MAX_WPM = 800;
const STEP_WPM = 10;
const WPM_PRESETS = [200, 250, 300, 350, 400];

function clampInt(raw: number, min: number, max: number) {
  const num = Number.isFinite(raw) ? Math.trunc(raw) : min;
  return Math.max(min, Math.min(max, num));
}

export function ReaderPanel({ onDestroy, controller }: ReaderPanelProps) {
  const { readerPanelRef, startDrag, startResize } = useDraggableResizable({
    minWidth: 300,
    maxWidth: 800,
    minHeight: 400,
    maxHeight: 800,
  });

  const [wpm, setWpm] = useState<number>(300);
  const [wpmText, setWpmText] = useState<string>('300');

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
    <div ref={readerPanelRef} className="readerpanel-container">
      {/* Drag Bar Section */}
      <div onMouseDown={startDrag} className="drag-bar">
        <span className="drag-text">Drag Here</span>
        <button onClick={onDestroy} className="close-button" aria-label="Close extension">
          &times;
        </button>
      </div>
      <div className="p-4">
        <h2 className="text-lg font-semibold">Reader Panel</h2>
        <p className="text-sm text-gray-600">Floating Panel</p>

        {/* CONTROLS */}
        <div className="flex gap-2">
          <button className="rounded bg-green-600 px-3 py-1 text-white" onClick={() => controller.play()}>
            Play
          </button>
          <button className="rounded bg-yellow-500 px-3 py-1 text-white" onClick={() => controller.pause()}>
            Pause
          </button>
          <button className="rounded bg-red-600 px-3 py-1 text-white" onClick={() => controller.stop()}>
            Stop
          </button>
        </div>
      </div>

      {/* WPM */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Speed</label>
          <span className="text-sm text-gray-700">{wpm} WPM</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min={MIN_WPM}
            max={MAX_WPM}
            step={STEP_WPM}
            value={wpm}
            onChange={event => setWpm(Number(event.target.value))}
            className="w-full"
            aria-label="Words per minute"
          />
          <input
            type="number"
            min={MIN_WPM}
            max={MAX_WPM}
            step={STEP_WPM}
            value={wpmText}
            onChange={event => setWpmText(event.target.value)}
            onBlur={commitWpmText}
            onKeyDown={event => {
              if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
            }}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            aria-label="WPM input"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {WPM_PRESETS.map(preset => (
            <button
              key={preset}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
              onClick={() => setWpm(preset)}
              type="button">
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Corners */}
      <div onMouseDown={startResize('nw')} className="handle handle-nw" />
      <div onMouseDown={startResize('ne')} className="handle handle-ne" />
      <div onMouseDown={startResize('sw')} className="handle handle-sw" />
      <div onMouseDown={startResize('se')} className="handle handle-se" />

      {/* Edges */}
      <div onMouseDown={startResize('n')} className="handle handle-n" />
      <div onMouseDown={startResize('s')} className="handle handle-s" />
      <div onMouseDown={startResize('e')} className="handle handle-e" />
      <div onMouseDown={startResize('w')} className="handle handle-w" />
    </div>
  );
}
