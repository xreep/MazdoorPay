import { Router } from 'express';
import {
  idParamSchema,
  rateChangeSchema,
  workerCreateSchema,
  workerListQuerySchema,
  workerUpdateSchema,
  wageSlipQuerySchema,
} from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import * as ctrl from '../../controllers/worker.controller.js';

const router = Router();
const byId = validate({ params: idParamSchema });

router.get('/', validate({ query: workerListQuerySchema }), ctrl.list);
router.post('/', validate({ body: workerCreateSchema }), ctrl.create);
router.get('/:id', byId, ctrl.get);
router.get('/:id/summary', byId, ctrl.summary);
router.get('/:id/slip', validate({ params: idParamSchema, query: wageSlipQuerySchema }), ctrl.slip);
router.patch('/:id', validate({ params: idParamSchema, body: workerUpdateSchema }), ctrl.update);
router.post(
  '/:id/rate',
  validate({ params: idParamSchema, body: rateChangeSchema }),
  ctrl.changeRate
);
router.post('/:id/deactivate', byId, ctrl.deactivate);
router.post('/:id/reactivate', byId, ctrl.reactivate);

export default router;
