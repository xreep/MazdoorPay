import { Router } from 'express';
import {
  duesQuerySchema,
  idParamSchema,
  paymentCreateSchema,
  paymentListQuerySchema,
  voidPaymentSchema,
} from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import * as ctrl from '../../controllers/payment.controller.js';

const router = Router();

router.post('/', validate({ body: paymentCreateSchema }), ctrl.create);
router.get('/', validate({ query: paymentListQuerySchema }), ctrl.list);
router.get('/dues', validate({ query: duesQuerySchema }), ctrl.dues);
router.get('/:id', validate({ params: idParamSchema }), ctrl.get);
router.post(
  '/:id/void',
  validate({ params: idParamSchema, body: voidPaymentSchema }),
  ctrl.voidOne
);

export default router;
