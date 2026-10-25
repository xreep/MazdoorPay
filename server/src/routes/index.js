import express from 'express';
import authRoutes from './auth.js';
import apiRoutes from './api.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/', apiRoutes);

export default router;
