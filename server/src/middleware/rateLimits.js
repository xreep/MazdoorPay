import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

const limiter = (max) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a few minutes and try again.' },
  });

export const createGlobalLimiter = (max) => limiter(max);
export const createAuthLimiter = (max) => limiter(max);
