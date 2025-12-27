import type * as React from 'react';

type ButtonVariant = 'ghost' | 'neutral' | 'primary' | 'danger';
type ButtonSize = 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function Button({ variant = 'neutral', size = 'md', className, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

  const sizes: Record<ButtonSize, string> = {
    md: 'h-7 px-3 text-sm rounded-md',
    lg: 'h-9 px-3.5 text-sm rounded-md',
    icon: 'h-10 w-10 p-0 rounded-xl',
  };

  const variants: Record<ButtonVariant, string> = {
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200',
    neutral: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 active:bg-slate-200',
    primary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950',
    danger: 'border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200',
  };

  return <button type="button" className={cx(base, sizes[size], variants[variant], className)} {...rest} />;
}
