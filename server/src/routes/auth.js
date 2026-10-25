import express from 'express';
import { protect, adminOnly, contractorOrAdmin } from '../middleware/auth.js';
import { whitelist } from '../middleware/validation.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

router.post(
  '/signup',
  whitelist(['name', 'email', 'password', 'phone', 'role']),
  authController.signup
);
router.post(
  '/login',
  whitelist(['email', 'password']),
  authController.login
);
router.post('/refresh', whitelist(['refreshToken']), authController.refresh);
router.post('/logout', whitelist(['refreshToken']), authController.logout);
router.get('/me', protect, authController.me);
router.get('/admin-only', protect, adminOnly, (req, res) => res.json({ ok: true }));

export default router;
