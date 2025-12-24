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
    <div className="mt-4 px-6">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
        <div className="text-lg font-semibold text-gray-900">Speed</div>

        <div className="flex items-center justify-center gap-2">
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
            className="w-24 rounded border border-gray-300 px-2 py-1 text-center text-sm"
            aria-label="WPM input"
          />
          <span className="text-sm text-gray-700">WPM</span>
        </div>

        <input
          type="range"
          min={minWpm}
          max={maxWpm}
          step={stepWpm}
          value={wpm}
          onChange={event => onWpmChange(Number(event.target.value))}
          className="w-42"
          aria-label="Words per minute"
        />

        <div className="flex flex-wrap justify-center gap-2">
          {presets.map(preset => (
            <button
              key={preset}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
              onClick={() => onWpmChange(preset)}
              type="button">
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
