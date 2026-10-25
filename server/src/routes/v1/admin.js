import { Router } from 'express';
import {
  activityQuerySchema,
  adminUserListQuerySchema,
  growthQuerySchema,
  idParamSchema,
  kpiQuerySchema,
  suspendUserSchema,
} from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import * as ctrl from '../../controllers/admin.controller.js';

const router = Router();
const byId = validate({ params: idParamSchema });

router.get('/overview', ctrl.overview);
router.get('/growth', validate({ query: growthQuerySchema }), ctrl.growth);
router.get('/users', validate({ query: adminUserListQuerySchema }), ctrl.users);
router.get('/users/:id', byId, ctrl.user);
router.post(
  '/users/:id/suspend',
  validate({ params: idParamSchema, body: suspendUserSchema }),
  ctrl.suspend
);
router.post('/users/:id/reactivate', byId, ctrl.reactivate);
router.get('/activity', validate({ query: activityQuerySchema }), ctrl.activity);
router.get('/anomalies', ctrl.anomalies);
router.get('/kpis', validate({ query: kpiQuerySchema }), ctrl.kpis);

export default router;
