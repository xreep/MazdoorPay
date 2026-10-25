import { afterEach, describe, expect, it, vi } from 'vitest';
import { API, HttpResponse, delay, http, server } from '../test/server.js';
import {
  ApiError,
  api,
  configureApi,
  getAccessToken,
  onSessionExpired,
  onSlowRequest,
  refreshSession,
  setAccessToken,
} from './api.js';

afterEach(() => {
  setAccessToken(null);
  configureApi({ slowMs: 4000 });
});

const okRefresh = (counter) =>
  http.post(API('/auth/refresh'), async () => {
    counter.n += 1;
    await delay(20);
    return HttpResponse.json({ user: { _id: 'u1', role: 'contractor' }, accessToken: 'fresh' });
  });

describe('api', () => {
  it('sends the bearer token and parses JSON', async () => {
    setAccessToken('abc');
    server.use(
      http.get(API('/sites'), ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('authorization') })
      )
    );
    expect(await api.get('/sites')).toEqual({ auth: 'Bearer abc' });
  });

  it('serialises query params and skips empty ones', async () => {
    server.use(
      http.get(API('/workers'), ({ request }) =>
        HttpResponse.json({ search: new URL(request.url).search })
      )
    );
    expect(
      await api.get('/workers', { query: { q: 'ram', siteId: '', page: 2, role: undefined } })
    ).toEqual({ search: '?q=ram&page=2' });
  });

  it('on 401 refreshes once and retries the request', async () => {
    const counter = { n: 0 };
    setAccessToken('stale');
    server.use(
      okRefresh(counter),
      http.get(API('/sites'), ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ sites: [] })
          : HttpResponse.json({ error: 'Please log in again' }, { status: 401 })
      )
    );
    expect(await api.get('/sites')).toEqual({ sites: [] });
    expect(counter.n).toBe(1);
    expect(getAccessToken()).toBe('fresh');
  });

  it('three parallel 401s trigger exactly one refresh (Review Focus 1)', async () => {
    const counter = { n: 0 };
    setAccessToken('stale');
    server.use(
      okRefresh(counter),
      http.get(API('/x/:n'), ({ request, params }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ n: params.n })
          : HttpResponse.json({ error: 'Please log in again' }, { status: 401 })
      )
    );
    const results = await Promise.all([api.get('/x/1'), api.get('/x/2'), api.get('/x/3')]);
    expect(results.map((r) => r.n)).toEqual(['1', '2', '3']);
    expect(counter.n).toBe(1);
  });

  it('refresh failure fires onSessionExpired and throws 401', async () => {
    const expired = vi.fn();
    const off = onSessionExpired(expired);
    server.use(
      http.post(API('/auth/refresh'), () =>
        HttpResponse.json({ error: 'Please log in again' }, { status: 401 })
      ),
      http.get(API('/sites'), () =>
        HttpResponse.json({ error: 'Please log in again' }, { status: 401 })
      )
    );
    await expect(api.get('/sites')).rejects.toMatchObject({
      status: 401,
      message: 'Please log in again',
    });
    expect(expired).toHaveBeenCalledTimes(1);
    off();
  });

  it('maps error bodies to ApiError with details', async () => {
    server.use(
      http.post(API('/workers'), () =>
        HttpResponse.json(
          {
            error: 'Please check the highlighted fields',
            details: [{ path: 'phone', message: 'Bad phone' }],
          },
          { status: 400 }
        )
      )
    );
    const err = await api.post('/workers', { name: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.details[0]).toEqual({ path: 'phone', message: 'Bad phone' });
  });

  it('does not try to refresh for /auth/login 401', async () => {
    const counter = { n: 0 };
    server.use(
      okRefresh(counter),
      http.post(API('/auth/login'), () =>
        HttpResponse.json({ error: 'Email or password is incorrect' }, { status: 401 })
      )
    );
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      message: 'Email or password is incorrect',
    });
    expect(counter.n).toBe(0);
  });

  it('turns network failures into a friendly error', async () => {
    server.use(http.get(API('/sites'), () => HttpResponse.error()));
    await expect(api.get('/sites')).rejects.toMatchObject({
      status: 0,
      message: expect.stringMatching(/internet connection/),
    });
  });

  it('returns null for 204', async () => {
    server.use(http.delete(API('/sites/1'), () => new HttpResponse(null, { status: 204 })));
    expect(await api.del('/sites/1')).toBeNull();
  });

  it('reports slow requests and recovery', async () => {
    configureApi({ slowMs: 30 });
    const seen = [];
    const off = onSlowRequest((slow) => seen.push(slow));
    server.use(
      http.get(API('/slow'), async () => {
        await delay(90);
        return HttpResponse.json({});
      })
    );
    await api.get('/slow');
    expect(seen).toEqual([true, false]);
    off();
  });

  it('refreshSession returns null when there is no session', async () => {
    server.use(
      http.post(API('/auth/refresh'), () =>
        HttpResponse.json({ error: 'Please log in again' }, { status: 401 })
      )
    );
    expect(await refreshSession()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});
