import { Router } from 'express';
import * as ctrl from '../../controllers/dashboard.controller.js';

const router = Router();

router.get('/', ctrl.show);

export default router;
