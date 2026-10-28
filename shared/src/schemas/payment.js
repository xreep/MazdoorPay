import { z } from 'zod';
import { LIMITS, PATTERNS, PAYMENT_METHODS, PAYMENT_TYPES } from '../constants.js';
import {
  checkDateRange,
  daySchema,
  objectIdSchema,
  paginationSchema,
  paiseSchema,
} from './common.js';
import { reasonSchema } from './attendance.js';

const BANK_REFERENCE = /^[A-Za-z0-9-]{1,30}$/;

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const paymentCreateSchema = z
  .object({
    workerId: z.string({ error: 'Choose a worker' }).regex(/^[a-f\d]{24}$/i, 'Choose a worker'),
    amount: paiseSchema(1, LIMITS.PAYMENT_MAX_PAISE),
    type: z.enum(PAYMENT_TYPES, { error: 'Pick wage or advance' }),
    method: z.enum(PAYMENT_METHODS, { error: 'Pick cash, UPI or bank' }),
    reference: optionalText(30),
    notes: optionalText(500),
    day: daySchema.optional(),
    idempotencyKey: z.uuid('Invalid request key'),
  })
  .superRefine((p, ctx) => {
    const issue = (message) => ctx.addIssue({ code: 'custom', path: ['reference'], message });
    if (p.method === 'upi' && !PATTERNS.UTR.test(p.reference ?? ''))
      issue('Enter the 12-digit UPI reference (UTR)');
    if (p.method === 'bank' && p.reference && !BANK_REFERENCE.test(p.reference))
      issue('Use letters, numbers and dashes only');
    if (p.method === 'cash' && p.reference) issue('Cash payments do not have a reference');
  });

export const voidPaymentSchema = z.object({ reason: reasonSchema });

const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

export const paymentListQuerySchema = paginationSchema
  .extend({
    workerId: objectIdSchema.optional(),
    siteId: objectIdSchema.optional(),
    from: daySchema.optional(),
    to: daySchema.optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    type: z.enum(PAYMENT_TYPES).optional(),
    includeVoided: booleanFlag,
  })
  .superRefine(checkDateRange);

export const duesQuerySchema = z.object({ siteId: objectIdSchema.optional() });

export { booleanFlag };
