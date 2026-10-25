import { z } from 'zod';

const siteName = z
  .string()
  .trim()
  .min(2, 'Site name must be at least 2 characters')
  .max(150, 'Site name is too long');
const location = z.string().trim().max(300, 'Location is too long');

export const siteCreateSchema = z.object({
  name: siteName,
  location: location.optional(),
});

export const siteUpdateSchema = z
  .object({
    name: siteName.optional(),
    location: location.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const siteListQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});
