import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  recordFailedAttempt,
  resetLoginAttempts,
  isLocked,
  getLoginAttempt,
} from '../utils/auth.js';
import { RefreshToken } from '../models/RefreshToken.js';

const COST = parseInt(process.env.BCRYPT_COST || '10', 10);

const setTokenCookies = (res, accessToken, refreshToken) => {
  res.setHeader('Access-Token', accessToken);
  res.setHeader('Refresh-Token', refreshToken);
};

export const signup = async (req, res) => {
  const { name, email, password, phone, role } = req.body || {};
  if (!name || !name.trim()) throw Object.assign(new Error('Name is required'), { statusCode: 400 });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw Object.assign(new Error('Valid email is required'), { statusCode: 400 });
  if (!password || password.length < 8) throw Object.assign(new Error('Password must be at least 8 characters'), { statusCode: 400 });

  const emailLower = email.toLowerCase().trim();
  const existing = await User.findOne({ email: emailLower });
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

  const passwordHash = await bcrypt.hash(password, COST);
  const user = await User.create({
    name: name.trim(),
    email: emailLower,
    passwordHash,
    phone: phone ? phone.trim() : '',
    role: role === 'admin' ? 'admin' : 'contractor',
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId: user._id,
    token: hashToken(refreshToken),
    family: user._id.toString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  setTokenCookies(res, accessToken, refreshToken);
  res.status(201).json({
    message: 'Account created',
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body || {};
  const emailLower = (email || '').toLowerCase().trim();
  if (!emailLower) throw Object.assign(new Error('Email is required'), { statusCode: 400 });
  if (!password) throw Object.assign(new Error('Password is required'), { statusCode: 400 });

  const attempt = await getLoginAttempt(emailLower);
  if (isLocked(attempt)) {
    throw Object.assign(new Error('Too many failed attempts. Try again later.'), { statusCode: 423 });
  }

  const user = await User.findOne({ email: emailLower });
  if (!user) {
    await recordFailedAttempt(emailLower);
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    await recordFailedAttempt(emailLower);
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  await resetLoginAttempts(emailLower);

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId: user._id,
    token: hashToken(refreshToken),
    family: user._id.toString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  setTokenCookies(res, accessToken, refreshToken);
  res.json({
    message: 'Logged in',
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) throw Object.assign(new Error('Refresh token required'), { statusCode: 400 });

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  const hashed = hashToken(refreshToken);
  const tokenDoc = await RefreshToken.findOne({ token: hashed });
  if (!tokenDoc) {
    // reuse detection: token presented that was already revoked/never issued
    const familyDoc = await RefreshToken.findOne({ token: hashed, revoked: true });
    if (familyDoc) {
      await RefreshToken.deleteMany({ family: familyDoc.family, revoked: true });
      throw Object.assign(new Error('Token reuse detected. Session revoked.'), { statusCode: 401 });
    }
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  if (tokenDoc.revoked) {
    await RefreshToken.deleteMany({ family: tokenDoc.family, revoked: true });
    throw Object.assign(new Error('Token reuse detected. Session revoked.'), { statusCode: 401 });
  }
  if (tokenDoc.expiresAt <= new Date()) {
    await RefreshToken.deleteMany({ family: tokenDoc.family });
    throw Object.assign(new Error('Refresh token expired'), { statusCode: 401 });
  }

  const user = await User.findById(tokenDoc.userId);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  // rotate: revoke current, issue new same family
  tokenDoc.revoked = true;
  tokenDoc.replacedBy = new Date().getTime();
  await tokenDoc.save();

  const newRefreshToken = generateRefreshToken();
  const newFamily = tokenDoc.family;
  await RefreshToken.create({
    userId: user._id,
    token: hashToken(newRefreshToken),
    family: newFamily,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const accessToken = generateAccessToken(user);
  setTokenCookies(res, accessToken, newRefreshToken);
  res.json({ accessToken, refreshToken: newRefreshToken });
};

export const logout = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    const hashed = hashToken(refreshToken);
    await RefreshToken.findOneAndDelete({ token: hashed });
  }
  res.json({ message: 'Logged out' });
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.userId).select('-passwordHash');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
};
