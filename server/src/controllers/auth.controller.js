import * as auth from '../services/auth.service.js';
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from '../utils/cookies.js';

const sendSession = (res, status, { user, accessToken, refreshToken }) => {
  setRefreshCookie(res, refreshToken);
  res.status(status).json({ user, accessToken });
};

export async function register(req, res) {
  sendSession(res, 201, await auth.register(req.body, { ip: req.ip }));
}

export async function login(req, res) {
  sendSession(res, 200, await auth.login(req.body, { ip: req.ip }));
}

export async function refresh(req, res) {
  try {
    sendSession(res, 200, await auth.refresh(req.cookies?.[REFRESH_COOKIE]));
  } catch (err) {
    // A parallel request losing the rotation race must not wipe the winner's new cookie.
    if (!err.keepCookie) clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req, res) {
  await auth.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req, res) {
  res.json({ user: await auth.getMe(req.user.id) });
}

export async function updateMe(req, res) {
  res.json({ user: await auth.updateMe(req.user.id, req.body, { ip: req.ip }) });
}
