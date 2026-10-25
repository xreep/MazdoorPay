import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';
import { downloadCsv } from '../../lib/download.js';
import { Button } from '../../components/ui/Button.jsx';
import { Stat } from '../../components/ui/Stat.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { useKpis } from './useAdmin.js';

const KPIS = [
  ['contractors', 'count'],
  ['activeContractors7d', 'count'],
  ['activeContractors30d', 'count'],
  ['engagementRate7d', 'pct'],
  ['workersManaged', 'count'],
  ['attendanceRecords', 'count'],
  ['paymentAccuracyPct', 'pct'],
  ['digitalReferencePct', 'pct'],
];

export function AnalyticsTab() {
  const t = useT();
  const { data, isPending, isError, error, refetch } = useKpis();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await downloadCsv(
        '/admin/kpis',
        {},
        `mazdoorpay-kpis-${new Date().toISOString().slice(0, 10)}`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  if (isPending) return <SkeletonRows n={4} className="h-28" />;
  if (isError) return <QueryError error={error} onRetry={refetch} />;
  const fmt = (v, kind) => (kind === 'pct' ? `${v}%` : new Intl.NumberFormat('en-IN').format(v));
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" onClick={download} loading={busy}>
          <Download className="h-5 w-5" aria-hidden="true" />
          {t('admin.downloadKpis')}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map(([key, kind]) => (
          <Stat
            key={key}
            label={t(`kpis.${key}.label`)}
            value={fmt(data[key], kind)}
            hint={t(`kpis.${key}.hint`)}
          />
        ))}
      </div>
    </>
  );
}
