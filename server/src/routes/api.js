import express from 'express';
import { protect, adminOnly, contractorOrAdmin } from '../middleware/auth.js';
import { whitelist } from '../middleware/validation.js';
import * as siteController from '../controllers/siteController.js';
import * as workerController from '../controllers/workerController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as wageController from '../controllers/wageController.js';
import * as paymentController from '../controllers/paymentController.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// Sites (contractor scoped; admin can view all)
router.get('/sites', protect, siteController.listSites);
router.get('/sites/:id', protect, siteController.getSite);
router.post('/sites', protect, whitelist(['name', 'location', 'isActive']), siteController.createSite);
router.put('/sites/:id', protect, whitelist(['name', 'location', 'isActive']), siteController.updateSite);
router.delete('/sites/:id', protect, siteController.deleteSite);

// Workers
router.get('/workers', protect, workerController.listWorkers);
router.get('/workers/:id', protect, workerController.getWorker);
router.get('/workers/:id/profile', protect, workerController.getWorkerProfile);
router.post('/workers', protect, whitelist(['name', 'role', 'dailyWageRate', 'phone', 'siteId', 'isActive']), workerController.createWorker);
router.put('/workers/:id', protect, whitelist(['name', 'role', 'dailyWageRate', 'phone', 'siteId', 'isActive']), workerController.updateWorker);
router.patch('/workers/:id/deactivate', protect, workerController.deactivateWorker);

// Attendance
router.get('/attendance', protect, attendanceController.getAttendance);
router.get('/attendance/grid', protect, attendanceController.getAttendanceGrid);
router.post('/attendance', protect, whitelist(['date', 'records']), attendanceController.markAttendance);

// Wages
router.get('/wages/worker', protect, wageController.wageSummaryWorker);
router.get('/wages/site', protect, wageController.wageSummarySite);
router.get('/wages/dashboard', protect, wageController.wageSummaryDashboard);

// Payments
router.post('/payments', protect, whitelist(['workerId', 'amount', 'date', 'method', 'notes']), paymentController.recordPayment);
router.get('/payments', protect, paymentController.listPayments);
router.get('/payments/pending-dues', protect, paymentController.pendingDues);

// Admin
router.get('/admin/dashboard', protect, adminOnly, adminController.adminDashboard);
router.get('/admin/users', protect, adminOnly, adminController.listAllUsers);
router.get('/admin/data-accuracy', protect, adminOnly, adminController.dataAccuracy);

export default router;
