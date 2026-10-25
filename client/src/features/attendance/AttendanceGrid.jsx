import { Check, Contrast, X } from 'lucide-react';
import { formatINR } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';

const OPTIONS = [
  {
    status: 'present',
    key: 'status.present',
    icon: Check,
    on: 'bg-present text-on-solid border-present',
    hover: 'hover:border-present/60',
  },
  {
    status: 'half-day',
    key: 'status.halfDay',
    icon: Contrast,
    on: 'bg-half text-on-solid border-half',
    hover: 'hover:border-half/60',
  },
  {
    status: 'absent',
    key: 'status.absent',
    icon: X,
    on: 'bg-absent text-on-solid border-absent',
    hover: 'hover:border-absent/60',
  },
];

function WorkerRow({ worker, status, changed, error, onSet }) {
  const t = useT();
  const labelId = `att-${worker.workerId}`;
  return (
    <li>
      <div
        role="group"
        aria-labelledby={labelId}
        className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 ${changed ? 'bg-brand-soft/60' : ''}`}
      >
        <div className="min-w-0">
          <p id={labelId} className="truncate font-semibold">
            {worker.name}
          </p>
          <p className="text-sm text-ink-muted">
            {t(`roles.${worker.role}`)}
            {worker.rate != null && <span className="num"> · {formatINR(worker.rate)}</span>}
            {!worker.isActive && <span> · {t('common.inactive')}</span>}
            {changed && (
              <span className="font-semibold text-brand-ink"> · {t('attendance.notSaved')}</span>
            )}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-sm font-medium text-absent">
              {error}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:w-[21rem]">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const pressed = status === o.status;
            return (
              <button
                key={o.status}
                type="button"
                aria-pressed={pressed}
                disabled={!worker.isActive}
                onClick={() => onSet(worker.workerId, o.status)}
                className={`flex h-12 items-center justify-center gap-1.5 rounded-control border-2 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-40 motion-reduce:transition-none ${
                  pressed ? o.on : `border-border bg-surface text-ink ${o.hover}`
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={2.75} />
                {t(o.key)}
              </button>
            );
          })}
        </div>
      </div>
    </li>
  );
}

export function AttendanceGrid({ sheet, draft, errors }) {
  return (
    <ul className="divide-y divide-border">
      {sheet.workers.map((w) => (
        <WorkerRow
          key={w.workerId}
          worker={w}
          status={draft.statusOf(w.workerId)}
          changed={draft.changes.some((c) => c.workerId === w.workerId)}
          error={errors.get(w.workerId)}
          onSet={draft.set}
        />
      ))}
    </ul>
  );
}
