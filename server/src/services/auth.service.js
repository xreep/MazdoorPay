import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { LoginAttempt } from '../models/LoginAttempt.js';
import { httpError } from '../utils/httpError.js';
import { hashToken, newRefreshToken, signAccessToken } from '../utils/tokens.js';

const INVALID_LOGIN = 'Email or password is incorrect';
export const SESSION_EXPIRED = 'Please log in again';
export const SUSPENDED = 'Your account is suspended';
const DAY_MS = 24 * 60 * 60 * 1000;

// Compared against when the email is unknown, so both failures take the same time.
let dummyHash;
const getDummyHash = () =>
  (dummyHash ??= bcrypt.hashSync('not-a-real-password-1', config.bcryptCost));

export const publicUser = (u) => ({
  _id: String(u._id),
  name: u.name,
  email: u.email,
  phone: u.phone ?? null,
  role: u.role,
  preferredLanguage: u.preferredLanguage ?? 'en',
});

async function issueSession(user, family = crypto.randomUUID()) {
  const refreshToken = newRefreshToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: new Date(Date.now() + config.refreshTtlDays * DAY_MS),
  });
  return { user: publicUser(user), accessToken: signAccessToken(user), refreshToken };
}

const revokeFamily = (family) =>
  RefreshToken.updateMany({ family, revokedAt: null }, { revokedAt: new Date() });

export const revokeAllForUser = async (userId) => {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
};

export async function register({ name, email, password, phone }) {
  if (await User.exists({ email }))
    throw httpError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, config.bcryptCost);
  let user;
  try {
    user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: 'contractor',
      lastLoginAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'An account with this email already exists');
    throw err;
  }
  return issueSession(user);
}

async function recordFailedLogin(email) {
  const attempt = await LoginAttempt.findOneAndUpdate(
    { email },
    { $inc: { attempts: 1 } },
    { upsert: true, new: true }
  );
  if (attempt.attempts >= config.loginMaxAttempts) {
    await LoginAttempt.updateOne(
      { email },
      { attempts: 0, lockoutUntil: new Date(Date.now() + config.lockoutMinutes * 60 * 1000) }
    );
  }
}

export async function login({ email, password }) {
  const attempt = await LoginAttempt.findOne({ email }).lean();
  if (attempt?.lockoutUntil && attempt.lockoutUntil > new Date()) {
    const minutes = Math.ceil((attempt.lockoutUntil - Date.now()) / 60000);
    throw httpError(
      423,
      `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
    );
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !matches) {
    await recordFailedLogin(email);
    throw httpError(401, INVALID_LOGIN);
  }
  await LoginAttempt.deleteOne({ email });
  if (user.status === 'suspended') throw httpError(403, SUSPENDED);

  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
  return issueSession(user);
}

export async function refresh(raw) {
  if (!raw) throw httpError(401, SESSION_EXPIRED);
  const current = await RefreshToken.findOne({ tokenHash: hashToken(raw) });
  if (!current) throw httpError(401, SESSION_EXPIRED);

  // A rotated token coming back means it was copied: end that whole session.
  if (current.revokedAt) {
    await revokeFamily(current.family);
    throw httpError(401, SESSION_EXPIRED);
  }
  if (current.expiresAt <= new Date()) throw httpError(401, SESSION_EXPIRED);

  const user = await User.findById(current.userId);
  if (!user || user.status !== 'active') {
    await revokeFamily(current.family);
    throw httpError(401, user ? SUSPENDED : SESSION_EXPIRED);
  }

  const next = newRefreshToken();
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: current._id, revokedAt: null },
    { revokedAt: new Date(), replacedByHash: hashToken(next) }
  );
  if (!claimed) throw httpError(401, SESSION_EXPIRED);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(next),
    family: current.family,
    expiresAt: new Date(Date.now() + config.refreshTtlDays * DAY_MS),
  });
  return { user: publicUser(user), accessToken: signAccessToken(user), refreshToken: next };
}

export async function logout(raw) {
  if (!raw) return;
  const current = await RefreshToken.findOne({ tokenHash: hashToken(raw) }).lean();
  if (current) await revokeFamily(current.family);
}

export async function getMe(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw httpError(401, SESSION_EXPIRED);
  return publicUser(user);
}

export async function updateMe(userId, changes) {
  const user = await User.findByIdAndUpdate(userId, changes, {
    new: true,
    runValidators: true,
  }).lean();
  if (!user) throw httpError(401, SESSION_EXPIRED);
  return publicUser(user);
}
