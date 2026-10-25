import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { formatINR } from '@mazdoorpay/shared';
import { api } from '../../lib/api.js';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { PrintLayout, printTable } from '../../components/layout/PrintLayout.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';

const SUM_KEYS = ['present', 'halfDay', 'absent', 'gross', 'advancesPaid', 'wagesPaid', 'balance'];

export default function WageRegisterPrint() {
  const t = useT();
  const { formatDay } = useFormat();
  const [params] = useSearchParams();
  const query = {
    from: params.get('from'),
    to: params.get('to'),
    siteId: params.get('siteId') ?? undefined,
  };
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['wage-register', query],
    queryFn: () => api.get('/reports/wage-register', { query }),
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
  const totals = Object.fromEntries(
    SUM_KEYS.map((k) => [k, data.rows.reduce((s, r) => s + r[k], 0)])
  );
  return (
    <PrintLayout
      landscape
      title={t('print.wageRegisterTitle')}
      subtitle={`${formatDay(data.from)} – ${formatDay(data.to)}`}
    >
      <table className={printTable}>
        <thead>
          <tr>
            <th>{t('print.name')}</th>
            <th>{t('workers.role')}</th>
            <th>{t('workers.site')}</th>
            <th className="text-center">P</th>
            <th className="text-center">H</th>
            <th className="text-center">A</th>
            <th>{t('print.rates')}</th>
            <th className="text-right">{t('print.gross')}</th>
            <th className="text-right">{t('print.advances')}</th>
            <th className="text-right">{t('print.wagesPaid')}</th>
            <th className="text-right">{t('print.balance')}</th>
            <th>{t('print.workerSignature')}</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.workerId}>
              <td className="font-medium">{r.name}</td>
              <td>{t(`roles.${r.role}`)}</td>
              <td>{r.site}</td>
              <td className="text-center">{r.present}</td>
              <td className="text-center">{r.halfDay}</td>
              <td className="text-center">{r.absent}</td>
              <td className="whitespace-nowrap">{r.rates}</td>
              <td className="num text-right">{formatINR(r.gross)}</td>
              <td className="num text-right">{formatINR(r.advancesPaid)}</td>
              <td className="num text-right">{formatINR(r.wagesPaid)}</td>
              <td className="num text-right font-semibold">
                {r.balance < 0 ? `−${formatINR(-r.balance)}` : formatINR(r.balance)}
              </td>
              <td className="min-w-[6rem]" />
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={3}>{t('print.total')}</td>
            <td className="text-center">{totals.present}</td>
            <td className="text-center">{totals.halfDay}</td>
            <td className="text-center">{totals.absent}</td>
            <td />
            <td className="num text-right">{formatINR(totals.gross)}</td>
            <td className="num text-right">{formatINR(totals.advancesPaid)}</td>
            <td className="num text-right">{formatINR(totals.wagesPaid)}</td>
            <td className="num text-right">
              {totals.balance < 0 ? `−${formatINR(-totals.balance)}` : formatINR(totals.balance)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs">{t('print.registerNote')}</p>
    </PrintLayout>
  );
}
