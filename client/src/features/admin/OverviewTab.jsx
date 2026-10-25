import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR } from '@mazdoorpay/shared';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Stat } from '../../components/ui/Stat.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { useAdminGrowth, useAdminOverview, useDailyActivity } from './useAdmin.js';

const n = (v) => new Intl.NumberFormat('en-IN').format(v);
const axis = {
  tick: { fill: 'hsl(var(--ink-muted))', fontSize: 12 },
  axisLine: false,
  tickLine: false,
};

export function OverviewTab() {
  const t = useT();
  const { formatDay } = useFormat();
  const overview = useAdminOverview();
  const growth = useAdminGrowth(12);
  const daily = useDailyActivity(30);
  if (overview.isPending) {
    return (
      <div role="status" aria-label="Loading" className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  if (overview.isError) return <QueryError error={overview.error} onRetry={overview.refetch} />;
  const { totals, engagement } = overview.data;
  const newContractors = growth.data?.weeks.reduce((s, w) => s + w.newContractors, 0) ?? 0;
  const actions = daily.data?.days.reduce((s, d) => s + d.actions, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label={t('admin.contractors')}
          value={n(totals.contractors)}
          hint={t('admin.contractorsHint', {
            active: totals.activeContractors,
            suspended: totals.suspendedContractors,
          })}
        />
        <Stat
          label={t('admin.workers')}
          value={n(totals.workers)}
          hint={t('admin.activeHint', { n: n(totals.activeWorkers) })}
        />
        <Stat label={t('admin.sites')} value={n(totals.sites)} />
        <Stat label={t('admin.attendanceRecords')} value={n(totals.attendanceRecords)} />
        <Stat
          label={t('admin.payments')}
          value={n(totals.payments)}
          hint={t('admin.paidHint', { amount: formatINR(totals.totalPaid) })}
        />
        <Stat
          label={t('admin.totalPaid')}
          value={formatINR(totals.totalPaid)}
          hint={t('admin.engagementHint', { d7: engagement.active7d, d30: engagement.active30d })}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-bold">{t('admin.growthTitle')}</h2>
          <div
            role="img"
            aria-label={t('admin.growthSummary', { n: newContractors })}
            className="h-64"
          >
            {growth.data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={growth.data.weeks}
                  margin={{ top: 8, right: 4, left: -16, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="weekStart"
                    tickFormatter={(d) => formatDay(d).split(',')[0]}
                    {...axis}
                  />
                  <YAxis allowDecimals={false} {...axis} />
                  <Tooltip labelFormatter={(d) => t('admin.weekOf', { day: formatDay(d) })} />
                  <Legend />
                  <Bar
                    name={t('admin.newContractors')}
                    dataKey="newContractors"
                    fill="hsl(var(--brand))"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    name={t('admin.newWorkers')}
                    dataKey="newWorkers"
                    fill="hsl(var(--ink))"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-bold">{t('admin.activityTitle')}</h2>
          <div role="img" aria-label={t('admin.activitySummary', { n: actions })} className="h-64">
            {daily.data && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={daily.data.days}
                  margin={{ top: 8, right: 4, left: -16, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => String(Number(d.slice(8)))}
                    minTickGap={12}
                    {...axis}
                  />
                  <YAxis allowDecimals={false} {...axis} />
                  <Tooltip labelFormatter={formatDay} />
                  <Legend />
                  <Area
                    name={t('admin.actions')}
                    dataKey="actions"
                    stroke="hsl(var(--ink))"
                    fill="hsl(var(--ink) / 0.12)"
                    isAnimationActive={false}
                  />
                  <Area
                    name={t('admin.activeContractors')}
                    dataKey="activeContractors"
                    stroke="hsl(var(--brand))"
                    fill="hsl(var(--brand) / 0.2)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
