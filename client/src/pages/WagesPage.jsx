import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Calculator, Download, Printer } from 'lucide-react';
import { formatINR } from '@mazdoorpay/shared';
import { useFormat, useT } from '../lib/i18n.jsx';
import { downloadCsv } from '../lib/download.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Field } from '../components/ui/Field.jsx';
import { QueryError } from '../components/ui/QueryError.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Stat } from '../components/ui/Stat.jsx';
import { useSiteOptions } from '../features/sites/useSites.js';
import { PeriodPicker, periodRange } from '../features/wages/PeriodPicker.jsx';
import { useWageSummary } from '../features/wages/useWageSummary.js';
import { WageTable } from '../features/wages/WageTable.jsx';
import { WageCards } from '../features/wages/WageCards.jsx';
import { useMediaQuery } from '../lib/hooks.js';
import { BucketChart } from '../features/wages/BucketChart.jsx';

export default function WagesPage() {
  const t = useT();
  const { formatDay } = useFormat();
  const [period, setPeriod] = useState(() => ({
    preset: 'this-week',
    ...periodRange('this-week'),
  }));
  const [groupBy, setGroupBy] = useState('week');
  const [siteId, setSiteId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const narrow = useMediaQuery('(max-width: 767px)');
  const { options: siteOptions } = useSiteOptions();
  const query = { from: period.from, to: period.to, groupBy, siteId };
  const { data, isPending, isError, error, refetch, isFetching } = useWageSummary(query);
  const rangeQuery = new URLSearchParams(
    Object.entries({ from: period.from, to: period.to, siteId }).filter(([, v]) => v)
  ).toString();

  const download = async () => {
    setDownloading(true);
    try {
      await downloadCsv(
        '/reports/wage-register',
        { from: period.from, to: period.to, siteId },
        `wage-register-${period.from}-to-${period.to}`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('nav.wages')}
        subtitle={`${formatDay(period.from)} – ${formatDay(period.to)}`}
        actions={
          <>
            <Button variant="secondary" onClick={download} loading={downloading}>
              <Download className="h-5 w-5" aria-hidden="true" />
              {t('wages.downloadRegister')}
            </Button>
            <Link
              to={`/print/wage-register?${rangeQuery}`}
              target="_blank"
              className="inline-flex h-12 items-center gap-2 rounded-control border border-border bg-surface px-5 font-medium hover:bg-surface-2"
            >
              <Printer className="h-5 w-5" aria-hidden="true" />
              {t('wages.printRegister')}
            </Link>
          </>
        }
      />

      <Card className="mb-6 space-y-4 p-4 sm:p-5">
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('workers.site')} className="min-w-[14rem] flex-1 sm:max-w-xs">
            <Select
              placeholder={t('workers.allSites')}
              options={siteOptions}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            />
          </Field>
          <SegmentedControl
            label={t('wages.groupBy')}
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: 'day', label: t('wages.daily') },
              { value: 'week', label: t('wages.weekly') },
            ]}
          />
        </div>
      </Card>

      {isPending && (
        <div role="status" aria-label="Loading" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-72" />
        </div>
      )}
      {isError && <QueryError error={error} onRetry={refetch} />}
      {data && (
        <div className={`space-y-6 transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label={t('wages.earnedInPeriod')}
              value={formatINR(data.totals.earned)}
              hint={t('wages.daysHint', {
                present: data.totals.present,
                halfDay: data.totals.halfDay,
              })}
            />
            <Stat
              label={t('wages.paidInPeriod')}
              value={formatINR(data.totals.paidInPeriod)}
              hint={t('wages.paidHint')}
            />
            <Stat
              label={data.totals.balance >= 0 ? t('wages.dueNow') : t('workers.advanceOutstanding')}
              value={formatINR(Math.abs(data.totals.balance))}
              hint={t('wages.dueHint')}
              tone={data.totals.balance >= 0 ? 'plain' : 'brand'}
            />
          </div>
          {data.workers.length === 0 ? (
            <Card>
              <EmptyState
                icon={Calculator}
                title={t('wages.emptyTitle')}
                body={t('wages.emptyBody')}
              />
            </Card>
          ) : (
            <>
              {data.buckets.length > 1 && (
                <Card className="p-5">
                  <h2 className="mb-3 text-lg font-bold">
                    {groupBy === 'day' ? t('wages.perDay') : t('wages.perWeek')}
                  </h2>
                  <BucketChart buckets={data.buckets} groupBy={data.groupBy} />
                </Card>
              )}
              <Card className="overflow-hidden">
                {narrow ? <WageCards data={data} /> : <WageTable data={data} />}
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
