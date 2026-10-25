import { forwardRef } from 'react';
import { Controller } from 'react-hook-form';
import { ChevronDown } from 'lucide-react';
import { controlClass } from './Input.jsx';

export const Select = forwardRef(function Select(
  { options, placeholder, className = '', ...rest },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={`${controlClass} h-12 appearance-none pr-10 ${className}`}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
    </div>
  );
});

// Select bound to react-hook-form as a controlled field, so a value set before the
// options load is kept; extra props (id, aria-*) from <Field> reach the select.
export function SelectField({ control, name, onValueChange, ...rest }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          ref={field.ref}
          value={field.value ?? ''}
          onBlur={field.onBlur}
          onChange={(event) => {
            field.onChange(event.target.value);
            onValueChange?.(event.target.value);
          }}
          {...rest}
        />
      )}
    />
  );
}
