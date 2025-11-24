import { useDraggableResizable } from '../hooks/useDraggableResizable';

interface ReaderPanelProps {
  onDestroy: () => void;
}

export function ReaderPanel({ onDestroy }: ReaderPanelProps) {
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
