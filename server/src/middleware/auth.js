import { verifyAccessToken } from '../utils/auth.js';

export const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }
  try {
    const decoded = verifyAccessToken(token);
    req.user = { userId: decoded.userId, role: decoded.role, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
};

export const contractorOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'contractor' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
};
