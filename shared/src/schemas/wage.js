import { z } from 'zod';
import { checkDateRange, dateRangeFields, objectIdSchema } from './common.js';

export const wageSummaryQuerySchema = z
  .object({
    ...dateRangeFields,
    groupBy: z.enum(['day', 'week']).default('week'),
    siteId: objectIdSchema.optional(),
    workerId: objectIdSchema.optional(),
  })
  .superRefine(checkDateRange);
