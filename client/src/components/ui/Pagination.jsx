import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';

export function Pagination({ page, pages, onChange }) {
  const t = useT();
  if (!pages || pages <= 1) return null;
  const btn =
    'flex h-12 w-12 items-center justify-center rounded-control border border-border bg-surface disabled:opacity-40 hover:bg-surface-2';
  return (
    <nav
      className="flex items-center justify-between gap-3 pt-4"
      aria-label={t('pagination.label')}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t('pagination.previous')}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <span className="num text-sm text-ink-muted">{t('pagination.status', { page, pages })}</span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label={t('pagination.next')}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </nav>
  );
}
