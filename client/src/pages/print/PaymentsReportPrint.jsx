import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { formatINR } from '@mazdoorpay/shared';
import { api } from '../../lib/api.js';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { PrintLayout, printTable } from '../../components/layout/PrintLayout.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';

export default function PaymentsReportPrint() {
  const t = useT();
  const { formatDay } = useFormat();
  const [params] = useSearchParams();
  const query = Object.fromEntries(params);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['payments-report', query],
    queryFn: () => api.get('/reports/payments', { query }),
  });
  if (isPending)
    return (
      <div className="p-8">
        <SkeletonRows n={8} />
      </div>
    );
  if (isError)
    return (
      <div className="p-8">
        <QueryError error={error} />
      </div>
    );
  const paid = data.rows.filter((r) => r.status === 'Paid').reduce((s, r) => s + r.amount, 0);
  return (
    <PrintLayout
      title={t('print.paymentsTitle')}
      subtitle={`${formatDay(data.from)} – ${formatDay(data.to)}`}
    >
      <table className={printTable}>
        <thead>
          <tr>
            <th>{t('print.date')}</th>
            <th>{t('print.name')}</th>
            <th>{t('payments.typeLabel')}</th>
            <th>{t('payments.methodLabel')}</th>
            <th>{t('print.reference')}</th>
            <th className="text-right">{t('payments.amount')}</th>
            <th>{t('print.status')}</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr
              key={r.paymentId}
              className={r.status === 'Void' ? 'text-neutral-500 line-through' : ''}
            >
              <td className="whitespace-nowrap">{formatDay(r.day)}</td>
              <td>{r.worker}</td>
              <td>{t(`payments.type.${r.type}`)}</td>
              <td>{t(`payments.method.${r.method}`)}</td>
              <td>{r.reference}</td>
              <td className="num text-right">{formatINR(r.amount)}</td>
              <td>{r.status === 'Void' ? t('payments.void') : t('print.paid')}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={5}>{t('print.totalPaid')}</td>
            <td className="num text-right">{formatINR(paid)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </PrintLayout>
  );
}
