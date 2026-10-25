import { z } from 'zod';
import { ATTENDANCE_STATUSES } from '../constants.js';
import { todayIST } from '../dates.js';
import {
  checkDateRange,
  daySchema,
  monthSchema,
  objectIdSchema,
  paginationSchema,
} from './common.js';

export const MAX_RECORDS_PER_REQUEST = 500;

export const reasonSchema = z
  .string()
  .trim()
  .min(3, 'Reason must be at least 3 characters')
  .max(200, 'Reason is too long');

export const markAttendanceSchema = z.object({
  day: daySchema,
  records: z
    .array(
      z.object({
        workerId: objectIdSchema,
        status: z.enum(ATTENDANCE_STATUSES, { error: 'Pick present, half-day or absent' }),
      })
    )
    .min(1, 'Mark at least one worker')
    .max(MAX_RECORDS_PER_REQUEST, `At most ${MAX_RECORDS_PER_REQUEST} workers at a time`)
    .superRefine((records, ctx) => {
      const seen = new Set();
      records.forEach((r, i) => {
        if (seen.has(r.workerId))
          ctx.addIssue({
            code: 'custom',
            path: [i, 'workerId'],
            message: 'This worker appears twice',
          });
        seen.add(r.workerId);
      });
    }),
  reason: reasonSchema.optional(),
});

export const sheetQuerySchema = z.object({
  siteId: objectIdSchema,
  day: daySchema.default(() => todayIST()),
});

export const attendanceListQuerySchema = paginationSchema
  .extend({
    siteId: objectIdSchema.optional(),
    workerId: objectIdSchema.optional(),
    from: daySchema.optional(),
    to: daySchema.optional(),
  })
  .superRefine(checkDateRange);

export const calendarQuerySchema = z.object({
  siteId: objectIdSchema.optional(),
  month: monthSchema,
});
