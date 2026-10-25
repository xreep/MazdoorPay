import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('API documentation coverage', () => {
  // The route list in docs/openapi.js is kept by hand; this keeps it honest against the routers.
  const ROUTES_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/routes/v1'
  );
  const routed = async () => {
    const files = (await fs.readdir(ROUTES_DIR)).filter((f) => f !== 'index.js');
    const found = ['get /health'];
    for (const file of files) {
      const source = await fs.readFile(path.join(ROUTES_DIR, file), 'utf8');
      for (const [, method, sub] of source.matchAll(
        /router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g
      )) {
        const full = `/${file.replace('.js', '')}${sub === '/' ? '' : sub}`.replace(
          /:(\w+)/g,
          '{$1}'
        );
        found.push(`${method} ${full}`);
      }
    }
    return found.sort();
  };
  const documented = (doc) =>
    Object.entries(doc.paths)
      .flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m} ${p}`))
      .sort();

  it('documents exactly the routes the API serves', async () => {
    const doc = (await request(app()).get('/api/v1/docs/openapi.json')).body;
    expect(documented(doc)).toEqual(await routed());
  });

  it('lists the status codes routes really return', async () => {
    const { paths } = (await request(app()).get('/api/v1/docs/openapi.json')).body;
    expect(Object.keys(paths['/sites'].post.responses)).toEqual(
      expect.arrayContaining(['201', '409', '429'])
    );
    expect(paths['/sites'].post.responses['200']).toBeUndefined();
    expect(Object.keys(paths['/payments'].post.responses)).toEqual(
      expect.arrayContaining(['200', '201', '409'])
    );
    expect(Object.keys(paths['/auth/login'].post.responses)).toEqual(
      expect.arrayContaining(['200', '401', '403', '423', '429'])
    );
    expect(paths['/auth/register'].post.responses['201']).toBeDefined();
    expect(paths['/admin/users'].get.responses['403'].description).toMatch(/admin/i);
    expect(paths['/workers'].get.responses['403'].description).toMatch(/contractor/i);
    expect(paths['/health'].get.responses['503']).toBeDefined();
  });
});
