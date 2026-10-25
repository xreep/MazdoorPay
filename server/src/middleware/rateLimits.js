import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;
// Clients that share a proxy address (everyone arriving through the same Vercel edge) share
// the per-proxy allowance, so it is this many times the per-client one.
const PROXY_MULTIPLIER = 5;

const limiter = (max, keyGenerator) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    message: { error: 'Too many requests. Please wait a few minutes and try again.' },
  });

// The address the nearest proxy saw connect to it. With more than one trusted hop, req.ip is
// read from X-Forwarded-For, which a caller can forge by skipping the outer proxy; the entry
// the nearest proxy appended cannot be forged.
const nearestHop = (req) => req.ips.at(-1) ?? req.ip;

// Each limit is counted per client and, more loosely, per nearest hop.
const limiters = (max) => [limiter(max), limiter(max * PROXY_MULTIPLIER, nearestHop)];

export const createGlobalLimiter = (max) => limiters(max);
export const createAuthLimiter = (max) => limiters(max);
