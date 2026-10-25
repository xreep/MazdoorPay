import { Router } from 'express';
import { loginSchema, registerSchema, updateMeSchema } from '@mazdoorpay/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as ctrl from '../../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate({ body: registerSchema }), ctrl.register);
router.post('/login', validate({ body: loginSchema }), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
router.patch('/me', requireAuth, validate({ body: updateMeSchema }), ctrl.updateMe);

export default router;
