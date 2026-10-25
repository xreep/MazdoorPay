import { Router } from 'express';
import {
  attendanceListQuerySchema,
  calendarQuerySchema,
  markAttendanceSchema,
  sheetQuerySchema,
} from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import * as ctrl from '../../controllers/attendance.controller.js';

const router = Router();

router.put('/', validate({ body: markAttendanceSchema }), ctrl.mark);
router.get('/', validate({ query: attendanceListQuerySchema }), ctrl.list);
router.get('/sheet', validate({ query: sheetQuerySchema }), ctrl.sheet);
router.get('/calendar', validate({ query: calendarQuerySchema }), ctrl.calendar);

export default router;
