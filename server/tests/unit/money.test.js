import {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  earnedFor,
  LIMITS,
  PATTERNS,
  WORKER_ROLES,
} from '@mazdoorpay/shared';

describe('paise money helpers', () => {
  it('rupeesToPaise rounds to the nearest paisa', () => {
    expect(rupeesToPaise('450')).toBe(45000);
    expect(rupeesToPaise(450.555)).toBe(45056);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });

  it('rupeesToPaise rejects garbage and negatives', () => {
    expect(() => rupeesToPaise('abc')).toThrow(TypeError);
    expect(() => rupeesToPaise(-1)).toThrow(TypeError);
    expect(() => rupeesToPaise(Infinity)).toThrow(TypeError);
  });

  it('paiseToRupees', () => {
    expect(paiseToRupees(45050)).toBe(450.5);
  });

  it('formatINR uses Indian grouping and hides zero paise', () => {
    expect(formatINR(12345600)).toBe('₹1,23,456');
    expect(formatINR(45050)).toBe('₹450.50');
    expect(formatINR(0)).toBe('₹0');
  });

  it('earnedFor floors half-days', () => {
    expect(earnedFor('present', 45001)).toBe(45001);
    expect(earnedFor('half-day', 45001)).toBe(22500);
    expect(earnedFor('absent', 45001)).toBe(0);
  });
});

describe('constants', () => {
  it('limits and patterns match the spec', () => {
    expect(LIMITS).toMatchObject({
      RATE_MIN_PAISE: 5000,
      RATE_MAX_PAISE: 1000000,
      PAYMENT_MAX_PAISE: 50000000,
      PAGE_MAX: 100,
    });
    expect(PATTERNS.PHONE_IN.test('9876543210')).toBe(true);
    expect(PATTERNS.PHONE_IN.test('5876543210')).toBe(false);
    expect(PATTERNS.UPI_ID.test('ramesh@oksbi')).toBe(true);
    expect(PATTERNS.UPI_ID.test('ramesh')).toBe(false);
    expect(PATTERNS.UTR.test('123456789012')).toBe(true);
    expect(PATTERNS.UTR.test('12345678901')).toBe(false);
    expect(WORKER_ROLES).toContain('mason');
  });
});
