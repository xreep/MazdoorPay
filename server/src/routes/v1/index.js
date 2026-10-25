import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import authRoutes from './auth.js';
import siteRoutes from './sites.js';

const router = Router();
const contractor = [requireAuth, requireRole('contractor')];

router.use('/auth', authRoutes);
router.use('/sites', contractor, siteRoutes);

export default router;
