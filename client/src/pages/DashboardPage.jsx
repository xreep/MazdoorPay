import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, ClipboardCheck, HandCoins, UserPlus, Wallet } from 'lucide-react';
import { formatINR } from '@mazdoorpay/shared';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useFormat, useT } from '../lib/i18n.jsx';
import { useDashboard } from '../features/dashboard/useDashboard.js';
import { TrendChart } from '../features/dashboard/TrendChart.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Stat } from '../components/ui/Stat.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { QueryError } from '../components/ui/QueryError.jsx';

const greetingKey = () => {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Asia/Kolkata',
    }).format(new Date())
  );
  if (hour < 12) return 'dashboard.morning';
  if (hour < 17) return 'dashboard.afternoon';
  return 'dashboard.evening';
};

const linkButton =
  'inline-flex h-12 items-center justify-center gap-2 rounded-control px-5 font-semibold transition';

function SiteProgress({ site }) {
  const t = useT();
  const done = site.activeWorkers > 0 && site.marked >= site.activeWorkers;
  const pct = site.activeWorkers
    ? Math.min(100, Math.round((site.marked / site.activeWorkers) * 100))
    : 0;
  const titleId = `site-${site.siteId}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col rounded-card bg-surface p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={titleId} className="font-semibold leading-snug">
          {site.name}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            done
              ? 'bg-present-soft text-present'
              : site.marked
                ? 'bg-half-soft text-half'
                : 'bg-surface-2 text-ink-muted'
          }`}
        >
          {done
            ? t('dashboard.done')
            : site.marked
              ? t('dashboard.inProgress')
              : t('dashboard.notStarted')}
        </span>
      </div>
      <p className="num mt-4 text-sm text-ink-muted">
        {t('dashboard.marked', { marked: site.marked, total: site.activeWorkers })}
      </p>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div
          className="h-full rounded-full bg-present transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <dl className="num mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        {[
          ['present', 'status.present', 'text-present'],
          ['halfDay', 'status.halfDay', 'text-half'],
          ['absent', 'status.absent', 'text-absent'],
        ].map(([key, label, tone]) => (
          <div key={key} className="rounded-control bg-surface-2 py-2">
            <dt className="text-ink-muted">{t(label)}</dt>
            <dd className={`text-lg font-bold ${tone}`}>{site[key]}</dd>
          </div>
        ))}
      </dl>
      <Link
        to={`/attendance?siteId=${site.siteId}`}
        className={`${linkButton} mt-4 ${done ? 'border border-border bg-surface hover:bg-surface-2' : 'bg-ink text-white hover:bg-ink/90'}`}
      >
        <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        {done ? t('dashboard.review') : t('dashboard.markAttendance')}
      </Link>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function DashboardPage() {
  const t = useT();
  const { formatDayLong } = useFormat();
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useDashboard();
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        title={t(greetingKey(), { name: firstName })}
        documentTitle={t('nav.home')}
        subtitle={data ? formatDayLong(data.today) : ' '}
        actions={
          data?.sites.length ? (
            <>
              <Link
                to="/payments?record=1"
                className={`${linkButton} border border-border bg-surface hover:bg-surface-2`}
              >
                <HandCoins className="h-5 w-5" aria-hidden="true" />
                {t('dashboard.recordPayment')}
              </Link>
              <Link
                to="/workers?new=1"
                className={`${linkButton} border border-border bg-surface hover:bg-surface-2`}
              >
                <UserPlus className="h-5 w-5" aria-hidden="true" />
                {t('dashboard.addWorker')}
              </Link>
            </>
          ) : null
        }
      />

      {isPending && <DashboardSkeleton />}
      {isError && <QueryError error={error} onRetry={refetch} />}

      {data && !data.sites.length && (
        <Card>
          <EmptyState
            icon={Building2}
            title={t('dashboard.emptyTitle')}
            body={t('dashboard.emptyBody')}
            action={
              <Link to="/sites?new=1" className={`${linkButton} bg-brand text-ink`}>
                {t('dashboard.addFirstSite')}
              </Link>
            }
          />
        </Card>
      )}

      {data && data.sites.length > 0 && (
        <div className="space-y-8">
          <section aria-labelledby="today-title">
            <h2 id="today-title" className="mb-3 text-lg font-bold">
              {t('dashboard.today')}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.sites.map((site) => (
                <SiteProgress key={site.siteId} site={site} />
              ))}
            </div>
          </section>

          <section aria-labelledby="money-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="money-title" className="text-lg font-bold">
                {t('dashboard.money')}
              </h2>
              <Link
                to="/payments"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
              >
                {t('dashboard.seeDues')}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label={t('dashboard.pendingDues')}
                value={formatINR(data.money.pendingDues)}
                hint={t('dashboard.workersToPay', { n: data.money.workersWithDues })}
                icon={Wallet}
              />
              <Stat
                label={t('dashboard.advances')}
                value={formatINR(data.money.advanceOutstanding)}
                hint={t('dashboard.advancesHint')}
                icon={HandCoins}
                tone={data.money.advanceOutstanding > 0 ? 'brand' : 'plain'}
              />
              <Stat
                label={t('dashboard.paidThisWeek')}
                value={formatINR(data.money.paidThisWeek)}
                hint={t('dashboard.paidThisWeekHint')}
              />
            </div>
          </section>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">{t('dashboard.trendTitle')}</h2>
              <ul className="flex gap-4 text-sm text-ink-muted">
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-present" />
                  {t('status.present')}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-half" />
                  {t('status.halfDay')}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-absent/25" />
                  {t('status.absent')}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-ink" />
                  {t('dashboard.earned')}
                </li>
              </ul>
            </div>
            <TrendChart data={data.trend} />
          </Card>
        </div>
      )}
    </>
  );
}
