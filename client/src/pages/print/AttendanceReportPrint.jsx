import { useCurrentQuery } from '../../lib/query.js';
import { useSearchParams } from 'react-router-dom';
import { formatINR } from '@mazdoorpay/shared';
import { api } from '../../lib/api.js';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { PrintLayout, printTable } from '../../components/layout/PrintLayout.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';

const STATUS_KEY = {
  present: 'status.present',
  'half-day': 'status.halfDay',
  absent: 'status.absent',
};

export default function AttendanceReportPrint() {
  const t = useT();
  const { formatDay } = useFormat();
  const [params] = useSearchParams();
  const query = {
    from: params.get('from'),
    to: params.get('to'),
    siteId: params.get('siteId') ?? undefined,
  };
  const { data, isPending, isError, error } = useCurrentQuery({
    queryKey: ['attendance-report', query],
    queryFn: () => api.get('/reports/attendance', { query }),
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
  const site = data.rows[0]?.site;
  return (
    <PrintLayout
      title={t('print.attendanceTitle')}
      subtitle={`${formatDay(data.from)} – ${formatDay(data.to)}${site ? ` · ${site}` : ''}`}
    >
      <table className={printTable}>
        <thead>
          <tr>
            <th>{t('print.date')}</th>
            <th>{t('print.name')}</th>
            <th>{t('workers.role')}</th>
            <th>{t('print.status')}</th>
            <th className="text-right">{t('print.rate')}</th>
            <th className="text-right">{t('print.earned')}</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap">{formatDay(r.day)}</td>
              <td>{r.worker}</td>
              <td>{t(`roles.${r.role}`)}</td>
              <td>{t(STATUS_KEY[r.status])}</td>
              <td className="num text-right">{formatINR(r.rate)}</td>
              <td className="num text-right">{formatINR(r.earned)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintLayout>
  );
}
