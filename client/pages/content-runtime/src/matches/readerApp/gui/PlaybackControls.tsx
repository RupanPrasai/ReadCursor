import { Button } from './Button';

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
    <div className="flex flex-wrap gap-2">
      <Button size="lg" variant="neutral" onClick={onPrev} disabled={!canPrev} aria-label="Previous block">
        ⏮ Prev
      </Button>

      <Button size="lg" variant="primary" onClick={onPlay} disabled={!canPlay}>
        Play
      </Button>

      <Button size="lg" variant="neutral" onClick={onPause} disabled={!canPause}>
        Pause
      </Button>

      <Button size="lg" variant="neutral" onClick={onStop} disabled={!canStop}>
        Stop
      </Button>

      <Button size="lg" variant="neutral" onClick={onNext} disabled={!canNext} aria-label="Next block">
        Next ⏭
      </Button>
    </div>
  );
}

