import { forwardRef } from 'react';
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
