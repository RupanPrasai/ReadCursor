interface DragBarProps {
  onMouseDownDrag: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

export function DragBar({ onMouseDownDrag, onClose }: DragBarProps) {
  return (
    <div onMouseDown={onMouseDownDrag} className="drag-bar">
      <span className="drag-text">Drag Here</span>
      <button onClick={onClose} className="close-button" aria-label="Close extension" type="button">
        &times;
      </button>
    </div>
  );
}
