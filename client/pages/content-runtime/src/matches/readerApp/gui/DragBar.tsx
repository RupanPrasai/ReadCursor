import { IconButton } from './IconButton';

interface DragBarProps {
  onMouseDownDrag: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onMinimize: () => void;
}

export function DragBar({ onMouseDownDrag, onClose, onMinimize }: DragBarProps) {
  return (
    <div
      onMouseDown={onMouseDownDrag}
      className="group relative z-10 flex cursor-grab select-none items-center justify-between gap-4 rounded-t-xl border-b border-slate-200 bg-slate-100 px-4 py-2 active:cursor-grabbing"
      aria-label="Drag reader panel"
      title="Drag">
      <div className="flex-1">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-slate-400 opacity-60 transition-opacity group-hover:opacity-90"
          aria-hidden="true">
          {/* 2 columns x 3 rows of dots */}
          <circle cx="9" cy="7" r="1.2" fill="currentColor" />
          <circle cx="15" cy="7" r="1.2" fill="currentColor" />
          <circle cx="9" cy="12" r="1.2" fill="currentColor" />
          <circle cx="15" cy="12" r="1.2" fill="currentColor" />
          <circle cx="9" cy="17" r="1.2" fill="currentColor" />
          <circle cx="15" cy="17" r="1.2" fill="currentColor" />
        </svg>
      </div>

      <div className="flex items-center gap-2">
        <IconButton ariaLabel="Minimize reader panel" title="Minimize" variant="warning" onClick={onMinimize}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M7 12h10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </IconButton>

        <IconButton ariaLabel="Close extension" title="Close" variant="danger" onClick={onClose}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}
