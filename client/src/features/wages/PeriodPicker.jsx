import { useState } from 'react';
import { addDays, dateRangeSchema, monthDays, todayIST, weekStart } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx';

const previousMonth = (day) => {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

export function periodRange(preset, today = todayIST()) {
  const monday = weekStart(today);
  switch (preset) {
    case 'last-week':
      return { from: addDays(monday, -7), to: addDays(monday, -1) };
    case 'this-month':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'last-month': {
      const days = monthDays(previousMonth(today));
      return { from: days[0], to: days.at(-1) };
    }
    default:
      return { from: monday, to: today };
  }
}

export function PeriodPicker({ value, onChange, today = todayIST() }) {
  const t = useT();
  const [custom, setCustom] = useState({ from: value.from, to: value.to });
  const check = dateRangeSchema.safeParse(custom);
  const error = check.success ? null : check.error.issues[0].message;

  const pick = (preset) => {
    if (preset === 'custom') {
      onChange({ preset, ...custom });
      return;
    }
    const range = periodRange(preset, today);
    setCustom(range);
    onChange({ preset, ...range });
  };

  const editCustom = (key) => (event) => {
    const next = { ...custom, [key]: event.target.value };
    setCustom(next);
    if (dateRangeSchema.safeParse(next).success) onChange({ preset: 'custom', ...next });
  };

  return (
    <div className="space-y-3">
      <SegmentedControl
        label={t('wages.period')}
        className="flex-wrap"
        value={value.preset}
        onChange={pick}
        options={[
          { value: 'this-week', label: t('wages.thisWeek') },
          { value: 'last-week', label: t('wages.lastWeek') },
          { value: 'this-month', label: t('wages.thisMonth') },
          { value: 'last-month', label: t('wages.lastMonth') },
          { value: 'custom', label: t('wages.custom') },
        ]}
      />
      {value.preset === 'custom' && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Field label={t('attendance.from')}>
            <Input type="date" max={today} value={custom.from} onChange={editCustom('from')} />
          </Field>
          <Field label={t('attendance.to')} error={error ?? undefined}>
            <Input type="date" max={today} value={custom.to} onChange={editCustom('to')} />
          </Field>
        </div>
      )}
    </div>
  );
}
