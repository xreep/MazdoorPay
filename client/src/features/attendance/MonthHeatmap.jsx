import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayOfWeek, todayIST } from '@mazdoorpay/shared';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { useAttendanceCalendar } from './useAttendance.js';

const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Darker green = more of the day's register marked present.
const shade = (d) => {
  if (!d.marked) return 'bg-surface-2 text-ink-muted';
  const ratio = (d.present + d.halfDay / 2) / d.marked;
  if (ratio >= 0.8) return 'bg-present text-on-solid';
  if (ratio >= 0.5) return 'bg-present/60 text-ink';
  return 'bg-present/25 text-ink';
};

export function MonthHeatmap({ siteId, onPickDay }) {
  const t = useT();
  const { formatDay, formatMonth } = useFormat();
  const today = todayIST();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { data, isPending, isError, error, refetch } = useAttendanceCalendar(siteId, month);
  const navBtn =
    'flex h-12 w-12 items-center justify-center rounded-control border border-border bg-surface hover:bg-surface-2 disabled:opacity-40';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          className={navBtn}
          onClick={() => setMonth(shiftMonth(month, -1))}
          aria-label={t('attendance.prevMonth')}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="text-lg font-bold">{formatMonth(month)}</h2>
        <button
          type="button"
          className={navBtn}
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= today.slice(0, 7)}
          aria-label={t('attendance.nextMonth')}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {isPending && <SkeletonRows n={5} className="h-14" />}
      {isError && <QueryError error={error} onRetry={refetch} />}
      {data && (
        <>
          <div
            className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-ink-muted"
            aria-hidden="true"
          >
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ol className="mt-1.5 grid grid-cols-7 gap-1.5">
            {Array.from({ length: (dayOfWeek(`${month}-01`) + 6) % 7 }, (_, i) => (
              <li key={`pad-${i}`} aria-hidden="true" />
            ))}
            {(data.days ?? []).map((d) => {
              const future = d.day > today;
              const label = t('attendance.calendarCell', {
                day: formatDay(d.day),
                present: d.present,
                halfDay: d.halfDay,
                absent: d.absent,
              });
              return (
                <li key={d.day}>
                  <button
                    type="button"
                    title={label}
                    disabled={future}
                    onClick={() => onPickDay(d.day)}
                    className={`num flex aspect-square w-full flex-col items-center justify-center rounded-control text-sm font-semibold transition hover:ring-2 hover:ring-ink/30 disabled:opacity-30 ${shade(d)} ${d.day === today ? 'ring-2 ring-ink' : ''}`}
                  >
                    <span aria-hidden="true">{Number(d.day.slice(8))}</span>
                    {d.marked > 0 && (
                      <span aria-hidden="true" className="text-[0.65rem] font-medium opacity-90">
                        {d.present}
                      </span>
                    )}
                    <span className="sr-only">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-sm text-ink-muted">{t('attendance.calendarHint')}</p>
        </>
      )}
    </div>
  );
}
