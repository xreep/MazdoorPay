import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const signAccessToken = (user) =>
  jwt.sign({ role: user.role }, config.jwtAccessSecret, {
    subject: String(user._id),
    expiresIn: config.jwtAccessTtl,
    algorithm: 'HS256',
  });

export const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
  return { sub: payload.sub, role: payload.role };
};

export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');

export const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
