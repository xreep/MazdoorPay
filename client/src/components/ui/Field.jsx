import { Children, cloneElement, isValidElement, useId } from 'react';

// Wraps one control and wires label, hint and error to it for screen readers.
export function Field({ label, hint, error, children, className = '' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = Children.only(children);
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {isValidElement(control) &&
        cloneElement(control, {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
        })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-absent">
          {error}
        </p>
      )}
    </div>
  );
}
