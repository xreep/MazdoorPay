import { Router } from 'express';
import * as ctrl from '../../controllers/statement.controller.js';

// Public: a worker opens their statement from the link their contractor shared.
const router = Router();

router.get('/:token', ctrl.read);

export default router;
