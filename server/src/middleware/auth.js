import { User } from '../models/User.js';
import { httpError } from '../utils/httpError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { SESSION_EXPIRED, SUSPENDED } from '../services/auth.service.js';

export async function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(httpError(401, SESSION_EXPIRED));

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    return next(httpError(401, SESSION_EXPIRED));
  }

  const user = await User.findById(claims.sub).select('role status email').lean();
  if (!user) return next(httpError(401, SESSION_EXPIRED));
  if (user.status === 'suspended') return next(httpError(401, SUSPENDED));

  req.user = { id: String(user._id), role: user.role, email: user.email };
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(httpError(403, 'You do not have access to this'));
