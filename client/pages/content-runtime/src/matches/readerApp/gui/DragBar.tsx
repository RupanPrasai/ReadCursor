interface DragBarProps {
  onMouseDownDrag: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

export function DragBar({ onMouseDownDrag, onClose }: DragBarProps) {
  return (
    <div
      onMouseDown={onMouseDownDrag}
      className="drag-bar relative z-10 flex cursor-move select-none items-center justify-between gap-4 rounded-t-xl border-b border-slate-200 bg-slate-100 px-4 py-2">
      <span className="drag-text flex-1 text-sm font-medium text-slate-700">Drag Here</span>

      <button
        onClick={onClose}
        className="close-button grid h-[18px] w-[18px] place-items-center rounded-full border border-black/60 bg-[#ff5f56] text-[14px] font-bold leading-none text-slate-800 shadow-sm hover:bg-red-500 hover:text-white"
        aria-label="Close extension"
        type="button">
        &times;
      </button>
    </div>
  );
}
