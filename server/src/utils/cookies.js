import { config } from '../config/env.js';

export const REFRESH_COOKIE = 'mp_rt';

const baseOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  path: '/api/v1/auth',
});

export const setRefreshCookie = (res, raw) =>
  res.cookie(REFRESH_COOKIE, raw, {
    ...baseOptions(),
    maxAge: config.refreshTtlDays * 24 * 60 * 60 * 1000,
  });

export const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, baseOptions());
