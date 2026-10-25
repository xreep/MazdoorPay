import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import authRoutes from './auth.js';
import siteRoutes from './sites.js';
import workerRoutes from './workers.js';
import attendanceRoutes from './attendance.js';
import paymentRoutes from './payments.js';
import wageRoutes from './wages.js';
import dashboardRoutes from './dashboard.js';
import reportRoutes from './reports.js';

const router = Router();
const contractor = [requireAuth, requireRole('contractor')];

router.use('/auth', authRoutes);
router.use('/sites', contractor, siteRoutes);
router.use('/workers', contractor, workerRoutes);
router.use('/attendance', contractor, attendanceRoutes);
router.use('/payments', contractor, paymentRoutes);
router.use('/wages', contractor, wageRoutes);
router.use('/dashboard', contractor, dashboardRoutes);
router.use('/reports', contractor, reportRoutes);

export default router;
