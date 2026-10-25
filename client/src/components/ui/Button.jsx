import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-brand text-ink font-semibold shadow-sm hover:brightness-95 active:brightness-90',
  secondary: 'bg-surface text-ink border border-border hover:bg-surface-2',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-absent text-white font-semibold hover:brightness-95',
};
const SIZES = {
  sm: 'h-12 px-4 text-sm',
  md: 'h-12 px-5 text-[0.95rem]',
  lg: 'h-14 px-6 text-base',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      )}
      {children}
    </button>
  );
});
