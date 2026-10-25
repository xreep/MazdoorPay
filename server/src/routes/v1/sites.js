import { Router } from 'express';
import {
  idParamSchema,
  siteCreateSchema,
  siteListQuerySchema,
  siteUpdateSchema,
} from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import * as ctrl from '../../controllers/site.controller.js';

const router = Router();

router.get('/', validate({ query: siteListQuerySchema }), ctrl.list);
router.post('/', validate({ body: siteCreateSchema }), ctrl.create);
router.get('/:id', validate({ params: idParamSchema }), ctrl.get);
router.patch('/:id', validate({ params: idParamSchema, body: siteUpdateSchema }), ctrl.update);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

export default router;
