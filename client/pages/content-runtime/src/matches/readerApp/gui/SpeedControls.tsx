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
    <div className="border-t border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Speed</div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={minWpm}
            max={maxWpm}
            step={stepWpm}
            value={wpmText}
            onChange={event => onWpmTextChange(event.target.value)}
            onBlur={onCommitText}
            onKeyDown={event => {
              if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
            }}
            className="h-8 w-20 select-text rounded-md border border-slate-300 bg-white px-2 text-center text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label="WPM input"
          />
          <span className="text-xs text-slate-600">WPM</span>
        </div>
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={minWpm}
          max={maxWpm}
          step={stepWpm}
          value={wpm}
          onChange={event => onWpmChange(Number(event.target.value))}
          className="w-full"
          aria-label="Words per minute"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map(preset => (
          <button
            key={preset}
            className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 hover:bg-slate-100 active:bg-slate-200"
            onClick={() => onWpmChange(preset)}
            type="button">
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
