import { addDays, dayOfWeek, eachDay, todayIST } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { formatDay } from '../../lib/format.js';

const CELL = {
  present: 'bg-present text-white',
  'half-day': 'bg-half text-white',
  absent: 'bg-absent/25 text-absent',
};
const STATUS_KEY = {
  present: 'status.present',
  'half-day': 'status.halfDay',
  absent: 'status.absent',
};
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Last `days` days as a Monday-first grid, one coloured cell per day.
export function WorkerCalendar({ records, days = 60 }) {
  const t = useT();
  const today = todayIST();
  const from = addDays(today, -(days - 1));
  const byDay = new Map(records.map((r) => [r.day, r.status]));
  const leading = (dayOfWeek(from) + 6) % 7;
  return (
    <div>
      <div
        className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-ink-muted"
        aria-hidden="true"
      >
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <ol className="mt-1.5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: leading }, (_, i) => (
          <li key={`pad-${i}`} aria-hidden="true" />
        ))}
        {eachDay(from, today).map((day) => {
          const status = byDay.get(day);
          return (
            <li
              key={day}
              aria-label={`${formatDay(day)}: ${t(STATUS_KEY[status] ?? 'status.notMarked')}`}
              title={`${formatDay(day)}: ${t(STATUS_KEY[status] ?? 'status.notMarked')}`}
              className={`num flex aspect-square items-center justify-center rounded-md text-xs font-semibold ${CELL[status] ?? 'bg-surface-2 text-ink-muted'} ${day === today ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface' : ''}`}
            >
              {Number(day.slice(8))}
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-present" />
          {t('status.present')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-half" />
          {t('status.halfDay')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-absent/25" />
          {t('status.absent')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-surface-2" />
          {t('status.notMarked')}
        </li>
      </ul>
    </div>
  );
}
