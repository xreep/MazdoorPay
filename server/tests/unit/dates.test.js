import {
  todayIST,
  isValidDay,
  isValidMonth,
  addDays,
  diffDays,
  weekStart,
  weekEnd,
  dayOfWeek,
  eachDay,
  monthDays,
} from '@mazdoorpay/shared';

describe('IST day helpers', () => {
  it('todayIST switches at Indian midnight, not UTC midnight', () => {
    expect(todayIST(new Date('2026-10-24T19:00:00Z'))).toBe('2026-10-25');
    expect(todayIST(new Date('2026-10-24T18:29:59Z'))).toBe('2026-10-24');
    expect(todayIST(new Date('2026-10-24T18:30:00Z'))).toBe('2026-10-25');
  });

  it('isValidDay rejects impossible or malformed days', () => {
    for (const bad of [
      '2026-02-30',
      '2026-13-01',
      '24-10-2026',
      '2026-10-5',
      '',
      null,
      20261024,
      '2027-02-29',
    ])
      expect(isValidDay(bad)).toBe(false);
    expect(isValidDay('2028-02-29')).toBe(true);
    expect(isValidDay('2026-10-25')).toBe(true);
  });

  it('isValidMonth', () => {
    expect(isValidMonth('2026-10')).toBe(true);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-1')).toBe(false);
  });

  it('day arithmetic crosses month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-01', '2026-10-25')).toBe(24);
    expect(diffDays('2026-10-25', '2026-10-01')).toBe(-24);
  });

  it('weeks run Monday to Sunday', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekEnd('2026-10-19')).toBe('2026-10-25');
    expect(weekEnd('2026-10-25')).toBe('2026-10-25');
    expect(dayOfWeek('2026-10-25')).toBe(0);
    expect(dayOfWeek('2026-10-19')).toBe(1);
  });

  it('eachDay and monthDays list days inclusively', () => {
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(eachDay('2026-10-02', '2026-10-01')).toEqual([]);
    expect(monthDays('2026-02')).toHaveLength(28);
    expect(monthDays('2028-02')).toHaveLength(29);
    expect(monthDays('2026-10')[30]).toBe('2026-10-31');
  });
});
