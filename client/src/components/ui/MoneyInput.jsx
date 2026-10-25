import { forwardRef, useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useT } from '../../lib/i18n.jsx';
import { paiseToInput, parseRupeesInput } from '../../lib/format.js';
import { controlClass } from './Input.jsx';

// A rupee text box that reports integer paise (or null while the text is not a valid amount).
export const MoneyInput = forwardRef(function MoneyInput(
  { value, onChange, onBlur, error, className = '', ...rest },
  ref
) {
  const t = useT();
  const [text, setText] = useState(paiseToInput(value));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const parsed = parseRupeesInput(text);
    if ((parsed.paise ?? null) !== (value ?? null)) setText(paiseToInput(value));
    // Only react to values pushed in from outside (e.g. a pre-filled due amount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const parsed = parseRupeesInput(text);
  const ownError = touched && parsed.error ? t(parsed.error) : null;
  const shown = error ?? ownError;

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-ink-muted">
          ₹
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          aria-invalid={shown ? true : rest['aria-invalid']}
          className={`${controlClass} num h-12 pl-9 text-lg font-semibold ${className}`}
          onChange={(event) => {
            setText(event.target.value);
            onChange?.(parseRupeesInput(event.target.value).paise ?? null);
          }}
          onBlur={(event) => {
            setTouched(true);
            onBlur?.(event);
          }}
          {...rest}
        />
      </div>
      {ownError && !error && <p className="mt-1.5 text-sm font-medium text-absent">{ownError}</p>}
    </div>
  );
});

// MoneyInput bound to react-hook-form; extra props (id, aria-*) from <Field> reach the input.
export function MoneyField({ control, name, ...rest }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <MoneyInput
          ref={field.ref}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          {...rest}
        />
      )}
    />
  );
}
