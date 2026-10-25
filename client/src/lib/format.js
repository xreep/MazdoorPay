import { rupeesToPaise } from '@mazdoorpay/shared';

// Business days are IST calendar strings; format them as UTC dates so the device timezone never shifts them.
const asUTC = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d ?? 1));
};

const fmt = (options) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...options });
const shortDay = fmt({ day: 'numeric', month: 'short' });
const weekday = fmt({ weekday: 'short' });
const longDay = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthYear = fmt({ month: 'long', year: 'numeric' });

export const formatDay = (day) => `${shortDay.format(asUTC(day))}, ${weekday.format(asUTC(day))}`;

export const formatDayLong = (day) => {
  const parts = Object.fromEntries(longDay.formatToParts(asUTC(day)).map((p) => [p.type, p.value]));
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
};

export const formatMonth = (month) => monthYear.format(asUTC(month));

const RUPEES = /^\d+(\.\d{1,2})?$/;

// Accepts what people type ("₹ 1,200.50") and returns integer paise, or an error key.
export function parseRupeesInput(text) {
  const cleaned = String(text ?? '').replace(/[₹,\s]/g, '');
  if (!cleaned) return { error: 'errors.amountRequired' };
  if (!RUPEES.test(cleaned)) return { error: 'errors.amountInvalid' };
  const paise = rupeesToPaise(cleaned);
  if (paise <= 0) return { error: 'errors.amountPositive' };
  return { paise };
}

export const initials = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words.at(-1)[0] : '';
  return `${first}${last}`.toUpperCase();
};

export const paiseToInput = (paise) => (paise == null ? '' : String(paise / 100));
