import type * as React from 'react';

type ChipSize = 'md' | 'lg';

export interface ChipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ChipSize;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function ChipButton({ size = 'md', className, ...rest }: ChipButtonProps) {
  const sizes: Record<ChipSize, string> = {
    md: 'h-7 px-2 text-xs',
    lg: 'h-9 px-2.5 text-sm',
  };

  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-800 ' +
        'transition-colors hover:bg-slate-100 active:bg-slate-200' +
        'outline-none focus-visible:ring-2 focus-visible:ring-slate-400' +
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
