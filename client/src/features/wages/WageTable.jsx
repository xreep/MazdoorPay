import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentQuery } from '../../lib/query.js';
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
  const query = { from, to };
  const { data, isPending, isError, error, refetch } = useCurrentQuery({
    queryKey: ['wage-slip', worker.workerId, query],
    queryFn: () => api.get(`/workers/${worker.workerId}/slip`, { query }),
  });
  if (isPending) return <SkeletonRows n={3} />;
  if (isError) return <QueryError error={error} onRetry={refetch} />;
  const cell = 'px-3 py-1.5';
  return (
    <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
      {data.days.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('slip.noDays')}</p>
      ) : (
        <DaysTable worker={worker} days={data.days} cell={cell} />
      )}
      <BalanceMadeUp worker={worker} slip={data} />
    </div>
  );
}

const signed = (paise) => `${paise < 0 ? '−' : '+'} ${formatINR(Math.abs(paise))}`;

// Why the all-time balance differs from this period's figures: what was owed before the period,
// the period itself, and anything earned or paid after it.
function BalanceMadeUp({ worker, slip }) {
  const t = useT();
  const paid = slip.totals.wagesPaid + slip.totals.advancesPaid;
  const after = worker.balance - slip.closingBalance;
  const rows = [
    [t('wages.madeUpBefore'), formatINR(slip.openingBalance)],
    [t('wages.madeUpEarned'), signed(slip.totals.earned)],
    [t('wages.madeUpPaid'), `− ${formatINR(paid)}`],
    ...(after !== 0 ? [[t('wages.madeUpAfter'), signed(after)]] : []),
  ];
  return (
    <ul aria-label={t('wages.madeUpTitle')} className="w-full max-w-xs text-sm">
      {rows.map(([label, value]) => (
        <li key={label} className="flex justify-between gap-4 py-1">
          <span className="text-ink-muted">{label}</span>
          <span className="num">{value}</span>
        </li>
      ))}
      <li className="mt-1 flex justify-between gap-4 border-t border-border pt-2 font-semibold">
        <span>{t('wages.dueAllTime')}</span>
        <span className="num">{formatINR(worker.balance)}</span>
      </li>
    </ul>
  );
}

function DaysTable({ worker, days, cell }) {
  const t = useT();
  const { formatDay } = useFormat();
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
        {days.map((d) => (
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
