import { z } from 'zod';
import { checkDateRange, dateRangeFields, monthSchema, objectIdSchema } from './common.js';
import { booleanFlag } from './payment.js';

const format = z.enum(['json', 'csv']).default('json');

export const reportRangeQuerySchema = z
  .object({ ...dateRangeFields, siteId: objectIdSchema.optional(), format })
  .superRefine(checkDateRange);

export const paymentsReportQuerySchema = z
  .object({
    ...dateRangeFields,
    siteId: objectIdSchema.optional(),
    includeVoided: booleanFlag,
    format,
  })
  .superRefine(checkDateRange);

export const musterRollQuerySchema = z.object({
  month: monthSchema,
  siteId: objectIdSchema,
  format,
});
