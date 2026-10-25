import { translate } from './i18n.jsx';
import { en } from './en.js';

// The single gateway to the backend. The access token lives only in this module's memory;
// the refresh token is an httpOnly cookie the browser sends to /api/v1/auth/*.
const BASE = '/api/v1';
const NO_REFRESH = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);

let accessToken = null;
let refreshing = null;
let slowMs = 4000;
let pending = 0;
let slowTimer = null;
let slow = false;
const expiredListeners = new Set();
const slowListeners = new Set();

export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const configureApi = (options) => {
  if (options.slowMs != null) slowMs = options.slowMs;
};

const subscribe = (set) => (cb) => {
  set.add(cb);
  return () => set.delete(cb);
};
export const onSessionExpired = subscribe(expiredListeners);
export const onSlowRequest = subscribe(slowListeners);

const setSlow = (value) => {
  if (slow === value) return;
  slow = value;
  slowListeners.forEach((cb) => cb(value));
};

// Render's free tier sleeps; a request pending for a few seconds means it is waking up.
const track = {
  start() {
    pending += 1;
    if (pending === 1) slowTimer = setTimeout(() => setSlow(true), slowMs);
  },
  end() {
    pending -= 1;
    if (pending === 0) {
      clearTimeout(slowTimer);
      setSlow(false);
    }
  },
};

const toQuery = (query) => {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

async function send(method, path, { body, query } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  track.start();
  try {
    return await fetch(`${BASE}${path}${toQuery(query)}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, translate(en, 'errors.network'));
  } finally {
    track.end();
  }
}

async function parse(res, as) {
  if (res.ok) {
    if (res.status === 204) return null;
    return as === 'blob' ? res.blob() : res.json();
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON error bodies (proxies, gateways) fall back to the generic message.
  }
  throw new ApiError(res.status, data.error || translate(en, 'errors.generic'), data.details ?? []);
}

// Single-flight: every caller during a refresh shares the same request.
export function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await send('POST', '/auth/refresh');
        if (!res.ok) {
          accessToken = null;
          return null;
        }
        const data = await res.json();
        accessToken = data.accessToken;
        return data;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function request(method, path, options = {}) {
  let res = await send(method, path, options);
  if (res.status === 401 && !NO_REFRESH.has(path)) {
    const session = await refreshSession();
    if (!session) {
      expiredListeners.forEach((cb) => cb());
      return parse(res, options.as);
    }
    res = await send(method, path, options);
  }
  return parse(res, options.as);
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  del: (path, options) => request('DELETE', path, options),
  blob: (path, options) => request('GET', path, { ...options, as: 'blob' }),
};
