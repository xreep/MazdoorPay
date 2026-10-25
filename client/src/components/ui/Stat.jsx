export function Stat({ label, value, hint, icon: Icon, tone = 'plain' }) {
  const toneClass = {
    plain: 'text-ink',
    brand: 'text-brand-ink',
    present: 'text-present',
    absent: 'text-absent',
  }[tone];
  return (
    <div className="rounded-card bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {Icon && <Icon className="h-5 w-5 text-ink-muted" aria-hidden="true" />}
      </div>
      <p className={`num mt-2 text-[1.75rem] font-bold leading-tight tracking-tight ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}
