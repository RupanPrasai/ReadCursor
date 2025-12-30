import type * as React from 'react';

type ChipSize = 'md' | 'lg';

export interface ChipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ChipSize;
  selected?: boolean;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function ChipButton({ size = 'md', selected = false, className, ...rest }: ChipButtonProps) {
  const sizes: Record<ChipSize, string> = {
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-base',
  };

  return (
    <button
      type="button"
      data-selected={selected ? 'true' : 'false'}
      className={cx(
        // base: mac-like pill control
        'inline-flex select-none items-center justify-center rounded-full border bg-white font-semibold tabular-nums ' +
        'transition-[background,box-shadow,border-color,transform] duration-150' +
        'outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white' +
        'disabled:cursor-not-allowed disabled:opacity-50',
        // default (unselected)
        !selected &&
        'border-slate-200 text-slate-800 ' +
        'shadow-[0_1px_0_rgba(15,23,42,0.04)]' +
        'bg-gradient-to-b from-white to-slate-50' +
        'hover:border-slate-300 hover:shadow-[0_1px_0_rgba(15,23,42,0.06),0_6px_14px_rgba(15,23,42,0.08)]' +
        'active:translate-y-[0.5px] active:shadow-[0_1px_0_rgba(15,23,42,0.04)]',
        // selected
        selected &&
        'border-slate-300 text-slate-900 ' +
        'bg-gradient-to-b from-slate-100 to-slate-200' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_0_rgba(15,23,42,0.06)]',
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
