import request from 'supertest';
import { useTestDb } from '../helpers/db.js';
import { app } from '../helpers/factory.js';

useTestDb();

describe('API documentation', () => {
  it('serves an OpenAPI 3.1 document covering every module', async () => {
    const res = await request(app()).get('/api/v1/docs/openapi.json');
    expect(res.status).toBe(200);
    const doc = res.body;
    expect(doc.openapi).toMatch(/^3\.1/);
    expect(doc.info.title).toBe('MazdoorPay API');
    const paths = Object.keys(doc.paths);
    for (const p of [
      '/auth/login',
      '/sites',
      '/workers/{id}/rate',
      '/attendance',
      '/payments/{id}/void',
      '/wages/summary',
      '/reports/muster-roll',
      '/admin/kpis',
      '/dashboard',
    ]) {
      expect(paths).toContain(p);
    }
    expect(paths.length).toBeGreaterThanOrEqual(35);
  });

  it('documents request bodies from the shared validation schemas', async () => {
    const doc = (await request(app()).get('/api/v1/docs/openapi.json')).body;
    const body = doc.paths['/payments'].post.requestBody.content['application/json'].schema;
    expect(body.required).toEqual(
      expect.arrayContaining(['workerId', 'amount', 'type', 'method', 'idempotencyKey'])
    );
    expect(body.properties.method.enum).toEqual(['cash', 'upi', 'bank']);
    expect(doc.paths['/payments'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.paths['/auth/login'].post.security).toEqual([]);
  });

  it('serves the interactive docs page', async () => {
    const res = await request(app()).get('/api/v1/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger-ui/i);
  });
});
