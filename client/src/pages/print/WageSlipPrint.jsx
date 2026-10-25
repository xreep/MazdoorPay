import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { formatINR } from '@mazdoorpay/shared';
import { api } from '../../lib/api.js';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { PrintLayout, WorkerLanguage, printTable } from '../../components/layout/PrintLayout.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';

const STATUS_KEY = { present: 'present', 'half-day': 'halfDay', absent: 'absent' };

function Line({ label, children, strong = false }) {
  return (
    <div
      className={`flex justify-between gap-6 py-1.5 ${strong ? 'border-t-2 border-black pt-2.5 text-lg font-bold' : ''}`}
    >
      <dt>{label}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  );
}

// One worker's wages for a period: previous balance + earned − paid = balance at the end.
export default function WageSlipPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const query = { from: params.get('from'), to: params.get('to') };
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['wage-slip', id, query],
    queryFn: () => api.get(`/workers/${id}/slip`, { query }),
  });
  if (isPending)
    return (
      <div className="p-8">
        <SkeletonRows n={6} />
      </div>
    );
  if (isError)
    return (
      <div className="p-8">
        <QueryError error={error} />
      </div>
    );

  return (
    <WorkerLanguage worker={data.worker}>
      <WageSlip data={data} />
    </WorkerLanguage>
  );
}

function WageSlip({ data }) {
  const t = useT();
  const { formatDay, formatDayLong } = useFormat();
  const { worker, site, contractor, days, payments, totals, openingBalance, closingBalance } = data;
  return (
    <PrintLayout
      paper="A5"
      title={t('slip.title')}
      subtitle={t('slip.period', { from: formatDayLong(data.from), to: formatDayLong(data.to) })}
      meta={contractor.phone ? `${contractor.name} · ${contractor.phone}` : contractor.name}
    >
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-2xl font-bold">{worker.name}</p>
          <p className="text-neutral-600">
            {t(`roles.${worker.role}`)}
            {site ? ` · ${site.name}` : ''}
          </p>
        </div>

        <section aria-label={t('slip.summary')} className="rounded border border-black p-4">
          <dl>
            <Line label={openingBalance < 0 ? t('slip.advanceBefore') : t('slip.previous')}>
              {formatINR(Math.abs(openingBalance))}
            </Line>
            <Line label={t('slip.earned')}>+ {formatINR(totals.earned)}</Line>
            <Line label={t('print.wagesPaid')}>− {formatINR(totals.wagesPaid)}</Line>
            {totals.advancesPaid > 0 && (
              <Line label={t('slip.advancesPaid')}>− {formatINR(totals.advancesPaid)}</Line>
            )}
            <Line strong label={closingBalance < 0 ? t('slip.advanceAfter') : t('slip.due')}>
              {formatINR(Math.abs(closingBalance))}
            </Line>
          </dl>
        </section>

        <section>
          <h2 className="mb-2 font-bold">
            {t('slip.attendance')}{' '}
            <span className="num font-normal text-neutral-600">
              ·{' '}
              {t('wages.bucketCounts', {
                present: totals.present,
                halfDay: totals.halfDay,
                absent: totals.absent,
              })}
            </span>
          </h2>
          {days.length === 0 ? (
            <p className="text-neutral-600">{t('slip.noDays')}</p>
          ) : (
            <table aria-label={t('slip.attendance')} className={printTable}>
              <thead>
                <tr>
                  <th>{t('print.date')}</th>
                  <th>{t('print.status')}</th>
                  <th className="text-right">{t('print.rate')}</th>
                  <th className="text-right">{t('print.earned')}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day}>
                    <td>{formatDay(d.day)}</td>
                    <td>{t(`status.${STATUS_KEY[d.status]}`)}</td>
                    <td className="num text-right">{formatINR(d.rate)}</td>
                    <td className="num text-right">{formatINR(d.earned)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={3}>{t('print.total')}</td>
                  <td className="num text-right">{formatINR(totals.earned)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {payments.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">{t('print.paymentsTitle')}</h2>
            <table aria-label={t('print.paymentsTitle')} className={printTable}>
              <thead>
                <tr>
                  <th>{t('print.date')}</th>
                  <th>{t('payments.typeLabel')}</th>
                  <th>{t('print.reference')}</th>
                  <th className="text-right">{t('print.paid')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{formatDay(p.day)}</td>
                    <td>
                      {t(`payments.type.${p.type}`)} · {t(`payments.method.${p.method}`)}
                    </td>
                    <td>{p.reference ?? '—'}</td>
                    <td className="num text-right">{formatINR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className="border-t border-black pt-2 text-sm">{t('print.workerSignature')}</div>
      </div>
    </PrintLayout>
  );
}
