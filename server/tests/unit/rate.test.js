import { rateOn } from '../../src/services/rate.js';

describe('rateOn', () => {
  const w = {
    rateHistory: [
      { rate: 45000, effectiveFrom: '2026-10-01' },
      { rate: 50000, effectiveFrom: '2026-10-20' },
    ],
  };

  it('returns the rate in force on a day', () => {
    expect(rateOn(w, '2026-09-30')).toBeNull();
    expect(rateOn(w, '2026-10-01')).toBe(45000);
    expect(rateOn(w, '2026-10-19')).toBe(45000);
    expect(rateOn(w, '2026-10-20')).toBe(50000);
    expect(rateOn(w, '2027-01-01')).toBe(50000);
  });

  it('does not depend on history order', () => {
    const shuffled = { rateHistory: [...w.rateHistory].reverse() };
    expect(rateOn(shuffled, '2026-10-19')).toBe(45000);
    expect(rateOn({ rateHistory: [] }, '2026-10-19')).toBeNull();
  });
});
