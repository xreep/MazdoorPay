// Business days are 'YYYY-MM-DD' strings in Asia/Kolkata (UTC+05:30, no DST).
// All arithmetic runs on UTC-midnight Dates so the host timezone never matters.
import { PATTERNS } from './constants.js';

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const toUTC = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export const todayIST = (now = new Date()) => fromUTC(now.getTime() + IST_OFFSET_MS);

export const isValidDay = (s) =>
  typeof s === 'string' && PATTERNS.DAY.test(s) && fromUTC(toUTC(s)) === s;

export const isValidMonth = (s) =>
  typeof s === 'string' && PATTERNS.MONTH.test(s) && isValidDay(`${s}-01`);

export const addDays = (day, n) => fromUTC(toUTC(day) + n * DAY_MS);

export const diffDays = (from, to) => Math.round((toUTC(to) - toUTC(from)) / DAY_MS);

export const dayOfWeek = (day) => new Date(toUTC(day)).getUTCDay();

export const weekStart = (day) => addDays(day, -((dayOfWeek(day) + 6) % 7));

export const weekEnd = (day) => addDays(weekStart(day), 6);

export const eachDay = (from, to) => {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
};

export const monthDays = (month) => {
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const last = fromUTC(Date.UTC(y, m, 0));
  return eachDay(first, last);
};
