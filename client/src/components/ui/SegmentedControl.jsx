export function SegmentedControl({ options, value, onChange, label, className = '' }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-control bg-surface-2 p-1 ${className}`}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-[0.6rem] px-4 text-sm font-semibold transition ${checked ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
