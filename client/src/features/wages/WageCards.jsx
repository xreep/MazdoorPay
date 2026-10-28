import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n.jsx';
import { Money } from '../../components/ui/Money.jsx';

// Phone layout of the wage table: one card per worker, money first.
export function WageCards({ data }) {
  const t = useT();
  return (
    <ul aria-label={t('wages.perWorker')} className="divide-y divide-border">
      {data.workers.map((w) => (
        <li key={w.workerId} className="px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              to={`/workers/${w.workerId}`}
              className="min-w-0 truncate font-semibold hover:underline"
            >
              {w.name}
            </Link>
            <Money paise={w.earned} className="shrink-0 text-lg font-bold" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-sm text-ink-muted">
            <span className="num">
              {t(`roles.${w.role}`)} ·{' '}
              {t('wages.bucketCounts', {
                present: w.present,
                halfDay: w.halfDay,
                absent: w.absent,
              })}
            </span>
            <span className="shrink-0">{t('wages.earned')}</span>
          </div>
          <Link
            to={`/print/wage-slip/${w.workerId}?from=${data.from}&to=${data.to}`}
            aria-label={t('slip.linkFor', { name: w.name })}
            className="mt-1 inline-flex min-h-12 items-center text-sm font-semibold text-brand-ink hover:underline"
          >
            {t('slip.link')}
          </Link>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-control bg-surface-2 px-3 py-2">
              <dt className="text-ink-muted">{`${t('wages.colWagesPaid')} ${t('wages.thisPeriod')}`}</dt>
              <dd>
                <Money paise={w.wagesPaidInPeriod} className="font-semibold" />
              </dd>
            </div>
            <div className="rounded-control bg-surface-2 px-3 py-2">
              <dt className="text-ink-muted">{`${t('wages.colAdvances')} ${t('wages.thisPeriod')}`}</dt>
              <dd>
                <Money paise={w.advancesInPeriod} className="font-semibold" />
              </dd>
            </div>
            <div className="col-span-2 rounded-control bg-surface-2 px-3 py-2">
              <dt className="text-ink-muted">{`${t('wages.colBalance')} ${t('wages.allTime')}`}</dt>
              <dd>
                <Money paise={w.balance} tone="auto" className="font-semibold" />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
