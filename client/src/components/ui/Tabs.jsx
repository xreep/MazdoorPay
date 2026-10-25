export function Tabs({ tabs, value, onChange, label, className = '' }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`-mb-px flex h-12 shrink-0 items-center gap-2 border-b-[3px] px-4 text-sm font-semibold transition ${
              selected
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={`num rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-ink text-white' : 'bg-surface-2 text-ink-muted'}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
