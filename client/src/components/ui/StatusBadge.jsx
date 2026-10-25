import { Check, Circle, Contrast, X } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';

export const STATUS_STYLE = {
  present: { icon: Check, className: 'bg-present-soft text-present', key: 'status.present' },
  absent: { icon: X, className: 'bg-absent-soft text-absent', key: 'status.absent' },
  'half-day': { icon: Contrast, className: 'bg-half-soft text-half', key: 'status.halfDay' },
};
const NOT_MARKED = {
  icon: Circle,
  className: 'bg-surface-2 text-ink-muted',
  key: 'status.notMarked',
};

// Status is always colour + icon + word, never colour alone.
export function StatusBadge({ status, className = '' }) {
  const t = useT();
  const style = STATUS_STYLE[status] ?? NOT_MARKED;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${style.className} ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
      {t(style.key)}
    </span>
  );
}
