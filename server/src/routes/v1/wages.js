import { Router } from 'express';
import { wageSummaryQuerySchema } from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import * as ctrl from '../../controllers/wage.controller.js';

const router = Router();

router.get('/summary', validate({ query: wageSummaryQuerySchema }), ctrl.summary);

export default router;
