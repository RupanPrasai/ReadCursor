import { Button } from './Button';
import { SkipBack, SkipForward, Play, Pause, Square } from 'lucide-react';

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
  const showingPause = canPause; // if pause is enabled, you're "playing" state in practice
  const onToggle = showingPause ? onPause : onPlay;
  const canToggle = showingPause ? canPause : canPlay;

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex w-full justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur">
          <Button
            size="icon"
            variant="ghost"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Previous block"
            title="Previous">
            <SkipBack className="h-5 w-5" aria-hidden="true" />
          </Button>

          <Button
            size="icon"
            variant="primary"
            onClick={onToggle}
            disabled={!canToggle}
            aria-label={showingPause ? 'Pause' : 'Play'}
            title={showingPause ? 'Pause' : 'Play'}>
            {showingPause ? (
              <Pause className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Play className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>

          <Button size="icon" variant="ghost" onClick={onNext} disabled={!canNext} aria-label="Next block" title="Next">
            <SkipForward className="h-5 w-5" aria-hidden="true" />
          </Button>

          <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

          <Button size="icon" variant="ghost" onClick={onStop} disabled={!canStop} aria-label="Stop" title="Stop">
            <Square className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
