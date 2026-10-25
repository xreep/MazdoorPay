import { forwardRef } from 'react';

export const controlClass =
  'block w-full rounded-control border border-control-border bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted/70 shadow-sm transition focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/30 aria-[invalid=true]:border-absent';

export const Input = forwardRef(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`${controlClass} h-12 ${className}`} {...rest} />;
});
