import { z } from 'zod';
import { USER_ROLES, USER_STATUSES } from '../constants.js';
import { checkDateRange, daySchema, objectIdSchema, paginationSchema } from './common.js';
import { reasonSchema } from './attendance.js';

export const adminUserListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
});

export const suspendUserSchema = z.object({ reason: reasonSchema });

export const growthQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
});

export const activityQuerySchema = paginationSchema
  .extend({
    contractorId: objectIdSchema.optional(),
    action: z
      .string()
      .trim()
      .regex(/^[a-z]+\.[a-z]+$/, 'Unknown action')
      .optional(),
    from: daySchema.optional(),
    to: daySchema.optional(),
  })
  .superRefine(checkDateRange);

export const kpiQuerySchema = z.object({ format: z.enum(['json', 'csv']).default('json') });
