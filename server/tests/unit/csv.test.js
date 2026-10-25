import { toCsv } from '../../src/utils/csv.js';

describe('toCsv', () => {
  it('neutralises formulas and quotes awkward cells (Review Focus 3)', () => {
    const csv = toCsv(
      [{ key: 'n', header: 'Name' }],
      [{ n: '=HYPERLINK("http://x")' }, { n: 'Ram, "Raju"\nKumar' }, { n: -5 }]
    );
    expect(csv.startsWith('﻿Name\r\n')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(`"Ram, ""Raju""\nKumar"`);
    expect(csv).toContain(`'-5`);
  });

  it('prefixes every dangerous leading character', () => {
    const rows = ['+1', '@SUM(A1)', '\tx', '\rx', 'plain'].map((n) => ({ n }));
    const lines = toCsv([{ key: 'n', header: 'N' }], rows)
      .slice(1)
      .split('\r\n');
    expect(lines).toEqual(['N', "'+1", "'@SUM(A1)", "'\tx", `"'\rx"`, 'plain']);
  });

  it('renders empty values and multiple columns with CRLF', () => {
    const csv = toCsv(
      [
        { key: 'a', header: 'A' },
        { key: 'b', header: 'B, quoted' },
      ],
      [
        { a: 1, b: null },
        { a: undefined, b: 'x' },
      ]
    );
    expect(csv).toBe('﻿A,"B, quoted"\r\n1,\r\n,x');
  });
});
