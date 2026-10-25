import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { formatINR } from '@mazdoorpay/shared';
import { api } from '../../lib/api.js';
import { useT } from '../../lib/i18n.jsx';
import { formatMonth } from '../../lib/format.js';
import { PrintLayout, printTable } from '../../components/layout/PrintLayout.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';

export default function MusterRollPrint() {
  const t = useT();
  const [params] = useSearchParams();
  const month = params.get('month');
  const siteId = params.get('siteId');
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['muster-roll', month, siteId],
    queryFn: () => api.get('/reports/muster-roll', { query: { month, siteId } }),
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

  const totals = data.rows.reduce(
    (s, r) => ({
      present: s.present + r.present,
      halfDay: s.halfDay + r.halfDay,
      absent: s.absent + r.absent,
      earned: s.earned + r.earned,
    }),
    { present: 0, halfDay: 0, absent: 0, earned: 0 }
  );
  return (
    <PrintLayout
      landscape
      title={t('print.musterTitle')}
      subtitle={`${data.site.name} · ${formatMonth(month)}`}
      meta={data.site.location}
    >
      <div className="overflow-x-auto">
        <table className={`${printTable} text-xs`}>
          <thead>
            <tr>
              <th>{t('print.name')}</th>
              <th>{t('workers.role')}</th>
              {data.days.map((d) => (
                <th key={d} className="!px-1 text-center">
                  {Number(d.slice(8))}
                </th>
              ))}
              <th className="text-center">P</th>
              <th className="text-center">H</th>
              <th className="text-center">A</th>
              <th className="text-right">{t('print.earned')}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.workerId}>
                <td className="whitespace-nowrap font-medium">{r.name}</td>
                <td>{t(`roles.${r.role}`)}</td>
                {data.days.map((d) => (
                  <td key={d} className="!px-1 text-center">
                    {r.marks[d] ?? ''}
                  </td>
                ))}
                <td className="text-center">{r.present}</td>
                <td className="text-center">{r.halfDay}</td>
                <td className="text-center">{r.absent}</td>
                <td className="num whitespace-nowrap text-right">{formatINR(r.earned)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td colSpan={2 + data.days.length}>{t('print.total')}</td>
              <td className="text-center">{totals.present}</td>
              <td className="text-center">{totals.halfDay}</td>
              <td className="text-center">{totals.absent}</td>
              <td className="num whitespace-nowrap text-right">{formatINR(totals.earned)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs">{t('print.musterKey')}</p>
    </PrintLayout>
  );
}
