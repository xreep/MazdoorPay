import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';
import { formatDay } from '../../lib/format.js';
import { Money } from '../../components/ui/Money.jsx';

const bucketLabel = (bucket, groupBy) =>
  groupBy === 'day'
    ? formatDay(bucket.start)
    : `${formatDay(bucket.start)} – ${formatDay(bucket.end)}`;

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
      <table className="w-full min-w-[44rem] border-collapse">
        <thead className="border-b border-border bg-surface-2/60">
          <tr>
            <th className={`${th} pl-5`}>{t('wages.worker')}</th>
            <th className={`${th} text-right`}>{t('status.present')}</th>
            <th className={`${th} text-right`}>{t('status.halfDay')}</th>
            <th className={`${th} text-right`}>{t('status.absent')}</th>
            <th className={`${th} text-right`}>{t('wages.earned')}</th>
            <th className={`${th} text-right`}>{t('wages.paid')}</th>
            <th className={`${th} text-right`}>{t('wages.balanceNow')}</th>
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
                    <p className="text-sm text-ink-muted">{t(`roles.${w.role}`)}</p>
                  </td>
                  <td className={num}>{w.present}</td>
                  <td className={num}>{w.halfDay}</td>
                  <td className={num}>{w.absent}</td>
                  <td className={`${num} font-semibold`}>
                    <Money paise={w.earned} />
                  </td>
                  <td className={num}>
                    <Money paise={w.paidInPeriod} />
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
                    <td colSpan={8} className="px-5 py-3">
                      <ul
                        aria-label={t('wages.breakdownFor', { name: w.name })}
                        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                      >
                        {w.buckets.map((b, i) => (
                          <li
                            key={b.start}
                            className="flex items-center justify-between gap-3 rounded-control bg-surface px-3 py-2 text-sm"
                          >
                            <span>
                              <span className="block font-medium">
                                {bucketLabel(data.buckets[i], data.groupBy)}
                              </span>
                              <span className="num text-ink-muted">
                                {t('wages.bucketCounts', {
                                  present: b.present,
                                  halfDay: b.halfDay,
                                  absent: b.absent,
                                })}
                              </span>
                            </span>
                            <Money paise={b.earned} className="font-semibold" />
                          </li>
                        ))}
                      </ul>
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
              <Money paise={data.totals.paidInPeriod} />
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
