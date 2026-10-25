import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatINR } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { formatDay } from '../../lib/format.js';

export function BucketChart({ buckets, groupBy }) {
  const t = useT();
  const total = buckets.reduce((s, b) => s + b.earned, 0);
  const tick = (start) =>
    groupBy === 'day' ? String(Number(start.slice(8))) : formatDay(start).split(',')[0];
  return (
    <div
      role="img"
      aria-label={t('wages.chartSummary', { total: formatINR(total), n: buckets.length })}
      className="h-56 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="start"
            tickFormatter={tick}
            tick={{ fill: 'hsl(var(--ink-muted))', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={8}
          />
          <YAxis
            tickFormatter={(p) => formatINR(Math.round(p / 100) * 100)}
            width={72}
            tick={{ fill: 'hsl(var(--ink-muted))', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--ink) / 0.05)' }}
            formatter={(v) => [formatINR(v), t('wages.earned')]}
            labelFormatter={(start, payload) => {
              const b = payload?.[0]?.payload;
              return b && groupBy === 'week'
                ? `${formatDay(b.start)} – ${formatDay(b.end)}`
                : formatDay(start);
            }}
          />
          <Bar
            dataKey="earned"
            fill="hsl(var(--ink))"
            radius={[6, 6, 0, 0]}
            maxBarSize={56}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
