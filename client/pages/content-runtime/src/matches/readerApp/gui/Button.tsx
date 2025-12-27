import type * as React from 'react';

type ButtonVariant = 'neutral' | 'primary' | 'danger';
type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function Button({ variant = 'neutral', size = 'md', className, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-slate-400 ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

  // md: keep for compact spots. lg: your main control size.
  const sizes: Record<ButtonSize, string> = {
    md: 'h-7 px-3 text-sm',
    lg: 'h-9 px-3.5 text-sm', // <- bigger, better click target
  };

  const variants: Record<ButtonVariant, string> = {
    neutral: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 active:bg-slate-200',
    primary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700',
    danger: 'border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200',
  };

  return <button type="button" className={cx(base, sizes[size], variants[variant], className)} {...rest} />;
}
