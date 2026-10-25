import { describe, expect, it } from 'vitest';
import { formatDay, formatDayLong, formatMonth, initials, parseRupeesInput } from './format.js';

describe('format helpers', () => {
  it('formats business days without the host timezone', () => {
    expect(formatDay('2026-10-24')).toBe('24 Oct, Sat');
    expect(formatDayLong('2026-10-25')).toBe('Sunday, 25 October 2026');
    expect(formatMonth('2026-02')).toBe('February 2026');
  });

  it('parses rupee input into paise (Review Focus 4)', () => {
    expect(parseRupeesInput('450.50')).toEqual({ paise: 45050 });
    expect(parseRupeesInput('1,200')).toEqual({ paise: 120000 });
    expect(parseRupeesInput(' ₹ 600 ')).toEqual({ paise: 60000 });
    expect(parseRupeesInput('0.5')).toEqual({ paise: 50 });
  });

  it('rejects garbage rupee input', () => {
    for (const bad of ['', '   ', 'abc', '-5', '0', '12.345.6', '1.234', '1e5']) {
      expect(parseRupeesInput(bad)).toHaveProperty('error');
    }
  });

  it('initials', () => {
    expect(initials('Ravi Kumar')).toBe('RK');
    expect(initials('sunita')).toBe('S');
    expect(initials('Sohan Lal Meena')).toBe('SM');
  });
});
