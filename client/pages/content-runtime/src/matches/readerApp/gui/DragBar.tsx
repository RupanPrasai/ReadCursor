interface DragBarProps {
  onMouseDownDrag: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onMinimize: () => void;
}

export function DragBar({ onMouseDownDrag, onClose, onMinimize }: DragBarProps) {
  return (
    <div
      onMouseDown={onMouseDownDrag}
      className="relative z-10 flex cursor-move select-none items-center justify-between gap-4 rounded-t-xl border-b border-slate-200 bg-slate-100 px-4 py-2">
      <span className="flex-1 text-sm font-medium text-slate-700">Drag Here</span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={onMinimize}
          className="grid h-[18px] w-[18px] place-items-center rounded-full border border-black/40 bg-[#ffbd2e] text-[14px] font-bold leading-none text-slate-900 shadow-sm hover:bg-amber-400"
          aria-label="Minimize reader panel"
          title="Minimize">
          —
        </button>
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={onClose}
          className="grid h-[18px] w-[18px] place-items-center rounded-full border border-black/60 bg-[#ff5f56] text-[14px] font-bold leading-none text-slate-800 shadow-sm hover:bg-red-500 hover:text-white"
          aria-label="Close extension"
          title="Close">
          &times;
        </button>
      </div>
    </div>
  );
}
