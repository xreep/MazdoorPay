// Spreadsheet-safe CSV: UTF-8 BOM so Excel reads ₹ and Hindi, CRLF rows, RFC 4180 quoting,
// and a leading apostrophe on anything a spreadsheet would run as a formula.
const BOM = String.fromCharCode(0xfeff);
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

const cell = (value) => {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c.key])).join(','));
  return `${BOM}${lines.join('\r\n')}`;
}

export function sendReport(res, { format, filename, columns, rows, json }) {
  if (format !== 'csv') return res.json(json);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(toCsv(columns, rows));
}

export const rupees = (paise) =>
  paise === null || paise === undefined ? '' : (paise / 100).toFixed(2);
