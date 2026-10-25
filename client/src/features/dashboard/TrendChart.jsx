import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { formatDay } from '../../lib/format.js';

const color = (name) => `hsl(var(--${name}))`;

function TrendTooltip({ active, payload, label }) {
  const t = useT();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-control border border-border bg-surface px-3 py-2 text-sm shadow-lift">
      <p className="font-semibold">{formatDay(label)}</p>
      <p className="text-present">
        {t('status.present')}: {row.present}
      </p>
      <p className="text-half">
        {t('status.halfDay')}: {row.halfDay}
      </p>
      <p className="text-absent">
        {t('status.absent')}: {row.absent}
      </p>
      <p className="num mt-1 font-semibold">
        {t('dashboard.earned')}: {formatINR(row.earned)}
      </p>
    </div>
  );
}

export function TrendChart({ data }) {
  const t = useT();
  const totalPresent = data.reduce((s, d) => s + d.present, 0);
  const totalEarned = data.reduce((s, d) => s + d.earned, 0);
  return (
    <div
      role="img"
      aria-label={t('dashboard.trendSummary', {
        present: totalPresent,
        earned: formatINR(totalEarned),
      })}
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={color('border')} />
          <XAxis
            dataKey="day"
            tickFormatter={(d) => String(Number(d.slice(8)))}
            tick={{ fill: color('ink-muted'), fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            yAxisId="people"
            allowDecimals={false}
            tick={{ fill: color('ink-muted'), fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis yAxisId="money" orientation="right" hide />
          <Tooltip content={<TrendTooltip />} cursor={{ fill: 'hsl(var(--ink) / 0.05)' }} />
          <Bar
            yAxisId="people"
            dataKey="present"
            stackId="a"
            fill={color('present')}
            radius={[0, 0, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="people"
            dataKey="halfDay"
            stackId="a"
            fill={color('half')}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="people"
            dataKey="absent"
            stackId="a"
            fill="hsl(var(--absent) / 0.25)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="earned"
            stroke={color('ink')}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
