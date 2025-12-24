interface PlaybackControlsProps {
  onPrev: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext: () => void;
}

export function PlaybackControls({ onPrev, onPlay, onPause, onStop, onNext }: PlaybackControlsProps) {
  return (
    <div className="flex gap-2">
      <button
        className="rounded bg-slate-600 px-3 py-1 text-white"
        onClick={onPrev}
        type="button"
        aria-label="Previous block">
        ⏮ Prev
      </button>

      <button className="rounded bg-green-600 px-3 py-1 text-white" onClick={onPlay} type="button">
        Play
      </button>

      <button className="rounded bg-yellow-500 px-3 py-1 text-white" onClick={onPause} type="button">
        Pause
      </button>

      <button className="rounded bg-red-600 px-3 py-1 text-white" onClick={onStop} type="button">
        Stop
      </button>

      <button
        className="rounded bg-slate-600 px-3 py-1 text-white"
        onClick={onNext}
        type="button"
        aria-label="Next block">
        Next ⏭
      </button>
    </div>
  );
}
