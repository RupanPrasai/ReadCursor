import type * as React from 'react';

type IconButtonVariant = 'neutral' | 'warning' | 'success' | 'danger';
type IconButtonSize = 'sm' | 'md';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'aria-label'> {
  ariaLabel: string;
  title?: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: React.ReactNode;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function IconButton({
  ariaLabel,
  title,
  variant = 'neutral',
  size = 'md',
  className,
  onMouseDown,
  disabled,
  children,
  ...rest
}: IconButtonProps) {
  const base =
    'grid place-items-center rounded-full shadow-sm outline-none transition-colors ' +
    'focus-visible:ring-2 focus-visible:ring-slate-400 ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

  const sizes: Record<IconButtonSize, string> = {
    sm: 'h-6 w-6 text-[12px] font-bold leading-none',
    md: 'h-7 w-7 text-[14px] font-bold leading-none',
  };

  const variants: Record<IconButtonVariant, string> = {
    neutral: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    warning: 'border border-black/40 bg-[#ffbd2e] text-slate-900 hover:bg-amber-400',
    success: 'border border-black/40 bg-[#28c840] text-slate-900 hover:bg-emerald-500',
    danger: 'border border-black/60 bg-[#ff5f56] text-slate-800 hover:bg-red-500 hover:text-white',
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      disabled={disabled}
      onMouseDown={e => {
        e.preventDefault();
        e.stopPropagation();
        onMouseDown?.(e);
      }}
      className={cx(base, sizes[size], variants[variant], className)}
      {...rest}>
      {children}
    </button>
  );
}
