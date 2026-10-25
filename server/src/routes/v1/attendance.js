import { Router } from 'express';
import {
  attendanceListQuerySchema,
  calendarQuerySchema,
  markAttendanceSchema,
  scanCardSchema,
  sheetQuerySchema,
} from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import * as ctrl from '../../controllers/attendance.controller.js';

const router = Router();

router.put('/', validate({ body: markAttendanceSchema }), ctrl.mark);
router.get('/', validate({ query: attendanceListQuerySchema }), ctrl.list);
router.get('/sheet', validate({ query: sheetQuerySchema }), ctrl.sheet);
router.get('/calendar', validate({ query: calendarQuerySchema }), ctrl.calendar);
router.post('/scan', validate({ body: scanCardSchema }), ctrl.scan);

export default router;
