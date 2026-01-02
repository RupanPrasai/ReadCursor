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
  const showingPause = canPause;
  const onToggle = showingPause ? onPause : onPlay;
  const canToggle = showingPause ? canPause : canPlay;

  const playCls = '!bg-[#28c840] !text-white hover:!bg-[#22b737] active:!bg-[#1eaa32]';
  const pauseCls = '!bg-[#ffbd2e] !text-slate-900 hover:!bg-[#ffb000] active:!bg-[#f0a000]';
  const stopCls = '!bg-[#ff5f57] !text-white hover:!bg-[#ff4b42] active:!bg-[#e6453f]';

  const toggleCls = showingPause ? pauseCls : playCls;

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex w-full justify-center">
        {/* outer chrome (soft track) */}
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-md">
          {/* segment 1: prev / play-pause / next */}
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white">
            <Button
              size="icon"
              variant="ghost"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Previous"
              title="Previous"
              className="rounded-none border-r border-slate-200 shadow-sm ring-1 ring-black/5">
              <SkipBack className="h-6 w-6" aria-hidden="true" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className={`rounded-none border-r border-slate-200 shadow-sm ring-1 ring-black/10 ${toggleCls}`}
              onClick={onToggle}
              disabled={!canToggle}
              aria-label={showingPause ? 'Pause' : 'Play'}
              title={showingPause ? 'Pause' : 'Play'}>
              {showingPause ? (
                <Pause className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Play className="h-6 w-6" aria-hidden="true" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Next"
              title="Next"
              className="rounded-none shadow-sm ring-1 ring-black/5">
              <SkipForward className="h-6 w-6" aria-hidden="true" />
            </Button>
          </div>

          {/* segment 2: stop */}
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white">
            <Button
              size="icon"
              variant="ghost"
              className={`rounded-xl shadow-sm ring-1 ring-black/10 ${stopCls}`}
              onClick={onStop}
              disabled={!canStop}
              aria-label="Stop"
              title="Stop">
              <Square className="h-6 w-6" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
