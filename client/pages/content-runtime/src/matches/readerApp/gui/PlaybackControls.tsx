interface PlaybackControlsProps {
  onPrev: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext: () => void;

  canPrev: boolean;
  canPlay: boolean;
  canPause: boolean;
  canStop: boolean;
  canNext: boolean;
}

export function PlaybackControls({
  onPrev,
  onPlay,
  onPause,
  onStop,
  onNext,
  canPrev,
  canPlay,
  canPause,
  canStop,
  canNext,
}: PlaybackControlsProps) {
  const base =
    'h-9 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50';

  const neutral = `${base} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 active:bg-slate-200`;
  const primary = `${base} bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700`;

  return (
    <div className="flex flex-wrap gap-2">
      <button className={neutral} onClick={onPrev} disabled={!canPrev} type="button" aria-label="Previous block">
        ⏮ Prev
      </button>

      <button className={primary} onClick={onPlay} disabled={!canPlay} type="button">
        Play
      </button>

      <button className={neutral} onClick={onPause} disabled={!canPause} type="button">
        Pause
      </button>

      <button className={neutral} onClick={onStop} disabled={!canStop} type="button">
        Stop
      </button>

      <button className={neutral} onClick={onNext} disabled={!canNext} type="button" aria-label="Next block">
        Next ⏭
      </button>
    </div>
  );
}
