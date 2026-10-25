import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { LoginAttempt } from '../models/LoginAttempt.js';
import { httpError } from '../utils/httpError.js';
import { hashToken, newRefreshToken, signAccessToken } from '../utils/tokens.js';
import { recordAudit } from './audit.service.js';

const INVALID_LOGIN = 'Email or password is incorrect';
export const SESSION_EXPIRED = 'Please log in again';
export const SUSPENDED = 'Your account is suspended';
const DAY_MS = 24 * 60 * 60 * 1000;
// A cookie rotated this recently is a parallel request from the same browser, not a stolen copy.
const REUSE_GRACE_MS = 30 * 1000;

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

const auditAuth = (user, action, ip) =>
  recordAudit({
    actor: { id: user._id, role: user.role },
    contractorId: user.role === 'contractor' ? user._id : undefined,
    action,
    entity: 'User',
    entityId: user._id,
    ip,
  });

export async function register({ name, email, password, phone }, { ip } = {}) {
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
  await auditAuth(user, 'auth.register', ip);
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

export async function login({ email, password }, { ip } = {}) {
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
  await auditAuth(user, 'auth.login', ip);
  return issueSession(user);
}

export async function refresh(raw) {
  if (!raw) throw httpError(401, SESSION_EXPIRED);
  const current = await RefreshToken.findOne({ tokenHash: hashToken(raw) });
  if (!current) throw httpError(401, SESSION_EXPIRED);

  // A cookie replaced moments ago is the same browser (a lost response or a second tab), not a thief.
  const recentlyRotated = (doc) =>
    Boolean(doc.replacedByHash) && Date.now() - doc.revokedAt.getTime() < REUSE_GRACE_MS;

  // An older rotated token coming back means it was copied: end that whole session.
  if (current.revokedAt && !recentlyRotated(current)) {
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
  if (!current.revokedAt) {
    const claimed = await RefreshToken.findOneAndUpdate(
      { _id: current._id, revokedAt: null },
      { revokedAt: new Date(), replacedByHash: hashToken(next) }
    );
    // Lost the race to a parallel refresh of the same cookie: treat it like the grace case below.
    if (!claimed && !(await RefreshToken.exists({ family: current.family, revokedAt: null }))) {
      throw httpError(401, SESSION_EXPIRED);
    }
  } else if (!(await RefreshToken.exists({ family: current.family, revokedAt: null }))) {
    // Logged out (or the session was revoked) since the rotation: nothing to continue.
    throw httpError(401, SESSION_EXPIRED);
  }

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

export async function updateMe(userId, changes, { ip } = {}) {
  const before = await User.findById(userId).lean();
  if (!before) throw httpError(401, SESSION_EXPIRED);
  const user = await User.findByIdAndUpdate(userId, changes, {
    new: true,
    runValidators: true,
  }).lean();
  const fields = Object.keys(changes);
  await recordAudit({
    actor: { id: user._id, role: user.role },
    contractorId: user.role === 'contractor' ? user._id : undefined,
    action: 'user.update',
    entity: 'User',
    entityId: user._id,
    before: Object.fromEntries(fields.map((f) => [f, before[f]])),
    after: Object.fromEntries(fields.map((f) => [f, user[f]])),
    ip,
  });
  return publicUser(user);
}
