import { ShieldCheck } from 'lucide-react';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { useAnomalies } from './useAdmin.js';

const TYPES = [
  'attendance_inactive_worker',
  'attendance_before_join',
  'wage_payment_exceeds_earnings',
  'upi_without_reference',
  'worker_without_site',
  'possible_duplicate_worker',
];

export function AccuracyTab() {
  const t = useT();
  const { formatDay } = useFormat();
  const { data, isPending, isError, error, refetch } = useAnomalies();
  if (isPending) return <SkeletonRows n={4} className="h-24" />;
  if (isError) return <QueryError error={error} onRetry={refetch} />;
  if (!data.anomalies.length) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title={t('admin.allClear')} body={t('admin.allClearBody')} />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-ink-muted">{t('admin.checksIntro')}</p>
      {TYPES.filter((type) => data.counts[type]).map((type) => {
        const titleId = `anomaly-${type}`;
        return (
          <Card as="section" key={type} aria-labelledby={titleId} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-bold">
                  {t(`anomalies.${type}.title`)}
                </h2>
                <p className="text-sm text-ink-muted">{t(`anomalies.${type}.why`)}</p>
              </div>
              <span className="num rounded-full bg-half-soft px-3 py-1 text-lg font-bold text-half">
                {data.counts[type]}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {data.anomalies
                .filter((a) => a.type === type)
                .slice(0, 20)
                .map((a, i) => (
                  <li key={i} className="rounded-control bg-surface-2 px-3 py-2">
                    {a.day && <span className="num mr-2 font-medium">{formatDay(a.day)}</span>}
                    {a.detail}
                  </li>
                ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
