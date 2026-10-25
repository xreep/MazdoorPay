import { useEffect } from 'react';

export function PageHeader({ title, subtitle, actions, documentTitle }) {
  useEffect(() => {
    document.title = `${documentTitle ?? title} · MazdoorPay`;
  }, [title, documentTitle]);
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-[2rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
