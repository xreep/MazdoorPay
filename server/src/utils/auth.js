import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { LoginAttempt } from '../models/LoginAttempt.js';

const getAccessSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return secret;
};
const getRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
  return secret;
};

export const generateAccessToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    getAccessSecret(),
    { expiresIn: process.env.JWT_ACCESS_TTL || '15m', subject: 'access' }
  );

export const generateRefreshToken = () =>
  jwt.sign({ type: 'refresh', jti: crypto.randomUUID() }, getRefreshSecret(), {
    expiresIn: process.env.JWT_REFRESH_TTL || '7d',
  });

export const verifyAccessToken = (token) => jwt.verify(token, getAccessSecret());

export const verifyRefreshToken = (token) => jwt.verify(token, getRefreshSecret());

const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
const LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10);

export const getLoginAttempt = async (email) => {
  return LoginAttempt.findOne({ email });
};

export const recordFailedAttempt = async (email) => {
  const now = new Date();
  let attempt = await LoginAttempt.findOne({ email });
  if (!attempt) {
    attempt = new LoginAttempt({ email, attempts: 1, lockoutUntil: undefined });
  } else if (attempt.lockoutUntil && attempt.lockoutUntil > now) {
    attempt.attempts += 1;
  } else {
    attempt.attempts = 1;
    attempt.lockoutUntil = undefined;
  }
  if (attempt.attempts >= MAX_ATTEMPTS) {
    attempt.lockoutUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
  }
  await attempt.save();
  return attempt;
};

export const resetLoginAttempts = async (email) => {
  await LoginAttempt.deleteOne({ email });
};

export const isLocked = (attempt) => {
  if (!attempt || !attempt.lockoutUntil) return false;
  return attempt.lockoutUntil > new Date();
};

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
