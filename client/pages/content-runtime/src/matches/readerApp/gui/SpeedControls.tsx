import { ChipButton } from './ChipButton';

interface SpeedControlsProps {
  wpm: number;
  wpmText: string;
  minWpm: number;
  maxWpm: number;
  stepWpm: number;
  presets: number[];
  onWpmChange: (wpm: number) => void;
  onWpmTextChange: (text: string) => void;
  onCommitText: () => void;
}

export function SpeedControls({
  wpm,
  wpmText,
  minWpm,
  maxWpm,
  stepWpm,
  presets,
  onWpmChange,
  onWpmTextChange,
  onCommitText,
}: SpeedControlsProps) {
  return (
    <div className="border-t border-slate-200 px-6 py-4">
      {/* header row */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xl font-bold text-slate-900">Speed</div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
          <input
            type="number"
            min={minWpm}
            max={maxWpm}
            step={stepWpm}
            value={wpmText}
            onChange={e => onWpmTextChange(e.target.value)}
            onBlur={onCommitText}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            }}
            className="h-8 w-16 border-0 bg-transparent px-0 text-center text-sm font-semibold tabular-nums text-slate-900 outline-none focus:ring-0"
            aria-label="WPM input"
          />
          <span className="text-xs font-semibold tracking-wide text-slate-500">WPM</span>
        </div>
      </div>

      {/* slider */}
      {(() => {
        const denom = Math.max(1, maxWpm - minWpm);
        const pct = ((wpm - minWpm) / denom) * 100;

        return (
          <div className="mb-6 mt-4 flex justify-center">
            <input
              type="range"
              min={minWpm}
              max={maxWpm}
              step={stepWpm}
              value={wpm}
              onChange={event => onWpmChange(Number(event.target.value))}
              className="rc-range w-[min(11.5rem,100%)]"
              style={{ ['--rc-pct' as any]: `${pct}%` } as any}
              aria-label="Words per minute"
            />
          </div>
        );
      })()}

      {/* presets */}
      <div className="mt-4 grid w-[min(19rem,100%)] grid-cols-3 gap-3">
        {presets.map(preset => (
          <ChipButton
            key={preset}
            size="lg"
            selected={preset === wpm}
            className="w-full"
            onClick={() => onWpmChange(preset)}>
            {preset}
          </ChipButton>
        ))}
      </div>
    </div>
  );
}
