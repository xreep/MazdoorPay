import { z } from 'zod';
import { LANGUAGES, LIMITS, WORKER_ROLES } from '../constants.js';
import {
  daySchema,
  objectIdSchema,
  paginationSchema,
  paiseSchema,
  phoneSchema,
  upiIdSchema,
  clearablePhoneSchema,
  clearableUpiIdSchema,
} from './common.js';

export const dailyRateSchema = paiseSchema(LIMITS.RATE_MIN_PAISE, LIMITS.RATE_MAX_PAISE);

const profileFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150, 'Name is too long'),
  role: z.enum(WORKER_ROLES, { error: 'Pick a role from the list' }),
  phone: phoneSchema,
  upiId: upiIdSchema,
  siteId: objectIdSchema.nullable().optional(),
  preferredLanguage: z.enum(LANGUAGES).optional(),
};

export const workerCreateSchema = z.object({
  ...profileFields,
  dailyRate: dailyRateSchema,
  joinedOn: daySchema.optional(),
});

export const workerUpdateSchema = z.object({
  name: profileFields.name.optional(),
  role: profileFields.role.optional(),
  phone: clearablePhoneSchema,
  upiId: clearableUpiIdSchema,
  siteId: profileFields.siteId,
  preferredLanguage: profileFields.preferredLanguage,
  joinedOn: daySchema.optional(),
});

export const rateChangeSchema = z.object({
  dailyRate: dailyRateSchema,
  effectiveFrom: daySchema.optional(),
});

export const workerListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  siteId: objectIdSchema.optional(),
  role: z.enum(WORKER_ROLES).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});
