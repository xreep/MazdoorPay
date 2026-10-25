import { z } from 'zod';
import { LIMITS, PATTERNS } from '../constants.js';
import { diffDays, isValidDay, isValidMonth } from '../dates.js';
import { formatINR } from '../money.js';

export const daySchema = z.string().refine(isValidDay, 'Enter a valid date (YYYY-MM-DD)');

export const monthSchema = z.string().refine(isValidMonth, 'Enter a valid month (YYYY-MM)');

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParamSchema = z.object({ id: objectIdSchema });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(LIMITS.PAGE_DEFAULT)
    .transform((n) => Math.min(n, LIMITS.PAGE_MAX)),
});

export const paiseSchema = (min, max) =>
  z
    .number({ error: 'Enter an amount' })
    .int('Amount must be in whole paise')
    .min(min, `Must be at least ${formatINR(min)}`)
    .max(max, `Must be at most ${formatINR(max)}`);

const emptyToUndefined = z.literal('').transform(() => undefined);

export const phoneSchema = z
  .union([
    emptyToUndefined,
    z.string().trim().regex(PATTERNS.PHONE_IN, 'Enter a 10-digit Indian mobile number'),
  ])
  .optional();

export const upiIdSchema = z
  .union([
    emptyToUndefined,
    z.string().trim().regex(PATTERNS.UPI_ID, 'Enter a UPI ID like name@bank'),
  ])
  .optional();

// Range rule shared by every from/to query; attach with .superRefine(checkDateRange).
export const checkDateRange = (value, ctx) => {
  if (!value.from || !value.to) return;
  if (value.from > value.to) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: 'End date must be on or after start date',
    });
  } else if (diffDays(value.from, value.to) > LIMITS.MAX_RANGE_DAYS) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: `Pick a range of at most ${LIMITS.MAX_RANGE_DAYS} days`,
    });
  }
};

export const dateRangeFields = { from: daySchema, to: daySchema };

export const dateRangeSchema = z.object(dateRangeFields).superRefine(checkDateRange);
