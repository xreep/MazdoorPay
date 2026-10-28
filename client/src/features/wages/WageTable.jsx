import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { formatINR } from '@mazdoorpay/shared';
import { api } from '../../lib/api.js';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { Money } from '../../components/ui/Money.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';

const STATUS_KEY = { present: 'present', 'half-day': 'halfDay', absent: 'absent' };

// A money column's name, with the period it covers underneath.
export function MoneyHeading({ label, basis }) {
  return (
    <>
      {label} <span className="block font-normal">{basis}</span>
    </>
  );
}

// Day by day, as on the wage slip; shares its data (and cache) with the printable slip.
function WorkerDays({ worker, from, to }) {
  const t = useT();
  const { formatDay } = useFormat();
  const query = { from, to };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['wage-slip', worker.workerId, query],
    queryFn: () => api.get(`/workers/${worker.workerId}/slip`, { query }),
  });
  if (isPending) return <SkeletonRows n={3} />;
  if (isError) return <QueryError error={error} onRetry={refetch} />;
  if (data.days.length === 0) return <p className="text-sm text-ink-muted">{t('slip.noDays')}</p>;
  const cell = 'px-3 py-1.5';
  return (
    <table
      aria-label={t('wages.breakdownFor', { name: worker.name })}
      className="w-full max-w-xl text-sm"
    >
      <thead className="text-left text-xs text-ink-muted">
        <tr>
          <th className={cell}>{t('print.date')}</th>
          <th className={cell}>{t('print.status')}</th>
          <th className={`${cell} text-right`}>{t('print.rate')}</th>
          <th className={`${cell} text-right`}>{t('print.earned')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.days.map((d) => (
          <tr key={d.day}>
            <td className={cell}>{formatDay(d.day)}</td>
            <td className={cell}>{t(`status.${STATUS_KEY[d.status]}`)}</td>
            <td className={`num ${cell} text-right`}>{formatINR(d.rate)}</td>
            <td className={`num ${cell} text-right`}>{formatINR(d.earned)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const slipHref = (workerId, data) => `/print/wage-slip/${workerId}?from=${data.from}&to=${data.to}`;

export function WageTable({ data }) {
  const t = useT();
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const th = 'px-3 py-3 text-left text-xs font-semibold text-ink-muted';
  const num = 'num px-3 py-3 text-right';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[54rem] border-collapse">
        <thead className="border-b border-border bg-surface-2/60">
          <tr>
            <th className={`${th} pl-5`}>{t('wages.worker')}</th>
            <th className={`${th} text-right`}>{t('status.present')}</th>
            <th className={`${th} text-right`}>{t('status.halfDay')}</th>
            <th className={`${th} text-right`}>{t('status.absent')}</th>
            <th className={`${th} text-right`}>
              <MoneyHeading label={t('wages.colEarned')} basis={t('wages.thisPeriod')} />
            </th>
            <th className={`${th} text-right`}>
              <MoneyHeading label={t('wages.colWagesPaid')} basis={t('wages.thisPeriod')} />
            </th>
            <th className={`${th} text-right`}>
              <MoneyHeading label={t('wages.colAdvances')} basis={t('wages.thisPeriod')} />
            </th>
            <th className={`${th} text-right`}>
              <MoneyHeading label={t('wages.colBalance')} basis={t('wages.allTime')} />
            </th>
            <th className="w-12" aria-hidden="true" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.workers.map((w) => {
            const expanded = open.has(w.workerId);
            return (
              <Fragment key={w.workerId}>
                <tr className="hover:bg-surface-2/50">
                  <td className="px-3 py-3 pl-5">
                    <Link to={`/workers/${w.workerId}`} className="font-semibold hover:underline">
                      {w.name}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      {t(`roles.${w.role}`)} ·{' '}
                      <Link
                        to={slipHref(w.workerId, data)}
                        aria-label={t('slip.linkFor', { name: w.name })}
                        className="font-medium text-brand-ink hover:underline"
                      >
                        {t('slip.link')}
                      </Link>
                    </p>
                  </td>
                  <td className={num}>{w.present}</td>
                  <td className={num}>{w.halfDay}</td>
                  <td className={num}>{w.absent}</td>
                  <td className={`${num} font-semibold`}>
                    <Money paise={w.earned} />
                  </td>
                  <td className={num}>
                    <Money paise={w.wagesPaidInPeriod} />
                  </td>
                  <td className={num}>
                    <Money paise={w.advancesInPeriod} />
                  </td>
                  <td className={`${num} font-semibold`}>
                    <Money paise={w.balance} tone="auto" />
                  </td>
                  <td className="pr-3 text-right">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={t('wages.showBreakdown', { name: w.name })}
                      onClick={() => toggle(w.workerId)}
                      className="flex h-12 w-12 items-center justify-center rounded-control hover:bg-ink/5"
                    >
                      <ChevronDown
                        className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="bg-surface-2/40">
                    <td colSpan={9} className="px-5 py-3">
                      <WorkerDays worker={w} from={data.from} to={data.to} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-ink/20 font-bold">
          <tr>
            <td className="px-3 py-3 pl-5">{t('wages.total')}</td>
            <td className={num}>{data.totals.present}</td>
            <td className={num}>{data.totals.halfDay}</td>
            <td className={num}>{data.totals.absent}</td>
            <td className={num}>
              <Money paise={data.totals.earned} />
            </td>
            <td className={num}>
              <Money paise={data.totals.wagesPaidInPeriod} />
            </td>
            <td className={num}>
              <Money paise={data.totals.advancesInPeriod} />
            </td>
            <td className={num}>
              <Money paise={data.totals.balance} tone="auto" />
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
