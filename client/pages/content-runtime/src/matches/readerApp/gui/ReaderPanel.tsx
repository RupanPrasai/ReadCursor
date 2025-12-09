import { useDraggableResizable } from '../hooks/useDraggableResizable';
import type { ReaderController } from '../readerEngine/controller';

interface ReaderPanelProps {
  onDestroy: () => void;
  controller: ReaderController;
}

export function ReaderPanel({ onDestroy, controller }: ReaderPanelProps) {
  const { readerPanelRef, startDrag, startResize } = useDraggableResizable({
    minWidth: 300,
    maxWidth: 800,
    minHeight: 400,
    maxHeight: 800,
  });

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
