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
  return (
    <div className="flex gap-2">
      <button
        className="rounded bg-slate-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onPrev}
        disabled={!canPrev}
        type="button"
        aria-label="Previous block">
        ⏮ Prev
      </button>

      <button
        className="rounded bg-green-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onPlay}
        disabled={!canPlay}
        type="button">
        Play
      </button>

      <button
        className="rounded bg-yellow-500 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onPause}
        disabled={!canPause}
        type="button">
        Pause
      </button>

      <button
        className="rounded bg-red-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onStop}
        disabled={!canStop}
        type="button">
        Stop
      </button>

      <button
        className="rounded bg-slate-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onNext}
        disabled={!canNext}
        type="button"
        aria-label="Next block">
        Next ⏭
      </button>
    </div>
  );
}
