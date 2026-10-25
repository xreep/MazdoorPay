import { useEffect } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';
import { Logo } from './Logo.jsx';

// A plain sheet for printing or saving as PDF: no app chrome, black on white.
export function PrintLayout({ title, subtitle, meta, landscape = false, actions, children }) {
  const t = useT();
  useEffect(() => {
    document.title = `${title} · MazdoorPay`;
  }, [title]);
  return (
    <div className="min-h-dvh bg-white text-black">
      <style>{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm; }`}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}
          className="inline-flex h-11 items-center gap-2 rounded-control px-3 font-medium hover:bg-ink/5"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {t('print.back')}
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-ink"
          >
            <Printer className="h-5 w-5" aria-hidden="true" />
            {t('print.print')}
          </button>
        </div>
      </div>
      <main className="mx-auto max-w-[1100px] px-6 py-8 print:max-w-none print:p-0">
        <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mt-1 text-base">{subtitle}</p>}
            {meta && <p className="mt-1 text-sm text-neutral-600">{meta}</p>}
          </div>
          <Logo />
        </header>
        {children}
        <footer className="mt-10 grid grid-cols-2 gap-10 text-sm">
          <div className="border-t border-black pt-2">{t('print.contractorSignature')}</div>
          <div className="border-t border-black pt-2">
            {t('print.generated', {
              at: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            })}
          </div>
        </footer>
      </main>
    </div>
  );
}

export const printTable =
  'w-full border-collapse text-sm [&_td]:border [&_td]:border-neutral-400 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-neutral-400 [&_th]:bg-neutral-100 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left';
