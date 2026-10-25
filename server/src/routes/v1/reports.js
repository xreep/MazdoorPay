import { Router } from 'express';
import {
  musterRollQuerySchema,
  paymentsReportQuerySchema,
  reportRangeQuerySchema,
} from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import * as ctrl from '../../controllers/report.controller.js';

const router = Router();

router.get('/attendance', validate({ query: reportRangeQuerySchema }), ctrl.attendance);
router.get('/muster-roll', validate({ query: musterRollQuerySchema }), ctrl.musterRoll);
router.get('/wage-register', validate({ query: reportRangeQuerySchema }), ctrl.wageRegister);
router.get('/payments', validate({ query: paymentsReportQuerySchema }), ctrl.payments);

export default router;
