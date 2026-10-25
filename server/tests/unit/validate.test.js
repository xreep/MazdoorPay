import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  daySchema,
  idParamSchema,
  paginationSchema,
  dateRangeSchema,
  phoneSchema,
  upiIdSchema,
  paiseSchema,
} from '@mazdoorpay/shared';
import { validate } from '../../src/middleware/validate.js';
import { errorHandler } from '../../src/middleware/error.js';
import { httpError } from '../../src/utils/httpError.js';
import { pageResult } from '../../src/utils/pagination.js';

const appWith = (mount) => {
  const app = express();
  app.use(express.json());
  mount(app);
  app.use(errorHandler);
  return app;
};

describe('validate middleware', () => {
  it('strips unknown keys and coerces pagination', async () => {
    const app = appWith((a) =>
      a.get('/t', validate({ query: paginationSchema }), (req, res) => res.json(req.query))
    );
    const res = await request(app).get('/t?page=2&limit=100000&evil=1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 2, limit: 100 });
  });

  it('applies pagination defaults', async () => {
    const app = appWith((a) =>
      a.get('/t', validate({ query: paginationSchema }), (req, res) => res.json(req.query))
    );
    expect((await request(app).get('/t')).body).toEqual({ page: 1, limit: 20 });
    expect((await request(app).get('/t?page=0')).status).toBe(400);
  });

  it('rejects invalid id param with 400', async () => {
    const app = appWith((a) =>
      a.get('/t/:id', validate({ params: idParamSchema }), (req, res) => res.json(req.params))
    );
    const res = await request(app).get('/t/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please check the highlighted fields');
    expect(res.body.details[0]).toEqual({ path: 'id', message: 'Invalid id' });
    expect((await request(app).get('/t/64b7f0c2a1b2c3d4e5f60718')).status).toBe(200);
  });

  it('rejects impossible day', async () => {
    const app = appWith((a) =>
      a.post('/t', validate({ body: z.object({ day: daySchema }) }), (req, res) =>
        res.json(req.body)
      )
    );
    expect((await request(app).post('/t').send({ day: '2026-02-30' })).status).toBe(400);
    const ok = await request(app).post('/t').send({ day: '2026-02-28', extra: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ day: '2026-02-28' });
  });
});

describe('shared schemas', () => {
  it('dateRangeSchema rejects from > to and spans > 366 days', () => {
    expect(dateRangeSchema.safeParse({ from: '2026-10-01', to: '2026-10-25' }).success).toBe(true);
    expect(dateRangeSchema.safeParse({ from: '2026-10-26', to: '2026-10-25' }).success).toBe(false);
    expect(dateRangeSchema.safeParse({ from: '2025-01-01', to: '2026-10-25' }).success).toBe(false);
    expect(dateRangeSchema.safeParse({ from: '2025-10-25', to: '2026-10-25' }).success).toBe(true);
  });

  it('phone and UPI are optional and empty strings become undefined', () => {
    expect(phoneSchema.parse('')).toBeUndefined();
    expect(phoneSchema.parse('9876543210')).toBe('9876543210');
    expect(phoneSchema.safeParse('12345').success).toBe(false);
    expect(upiIdSchema.parse('')).toBeUndefined();
    expect(upiIdSchema.safeParse('ramesh').success).toBe(false);
  });

  it('paiseSchema requires integers in range', () => {
    const s = paiseSchema(5000, 1000000);
    expect(s.safeParse(5000).success).toBe(true);
    expect(s.safeParse(4999).success).toBe(false);
    expect(s.safeParse(450.5).success).toBe(false);
    expect(s.safeParse('45000').success).toBe(false);
  });
});

describe('error handler', () => {
  const quiet = () => jest.spyOn(console, 'error').mockImplementation(() => {});

  it('hides internal errors', async () => {
    const spy = quiet();
    const app = appWith((a) =>
      a.get('/t', () => {
        throw new Error('db password leaked');
      })
    );
    const res = await request(app).get('/t');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong' });
    spy.mockRestore();
  });

  it('passes through httpError status and details', async () => {
    const app = appWith((a) =>
      a.get('/t', () => {
        throw httpError(409, 'Taken', [{ path: 'name', message: 'Taken' }]);
      })
    );
    const res = await request(app).get('/t');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Taken', details: [{ path: 'name', message: 'Taken' }] });
  });

  it('maps CastError, ValidationError and duplicate keys', async () => {
    const cast = new mongoose.Error.CastError('ObjectId', 'x', '_id');
    const invalid = new mongoose.Error.ValidationError();
    invalid.addError(
      'name',
      new mongoose.Error.ValidatorError({ path: 'name', message: 'Name is required' })
    );
    const dup = Object.assign(new Error('E11000'), { code: 11000, keyValue: { name: 'A' } });
    const app = appWith((a) => {
      a.get('/cast', () => {
        throw cast;
      });
      a.get('/invalid', () => {
        throw invalid;
      });
      a.get('/dup', () => {
        throw dup;
      });
    });
    expect((await request(app).get('/cast')).body).toEqual({ error: 'Invalid id' });
    const inv = await request(app).get('/invalid');
    expect(inv.status).toBe(400);
    expect(inv.body.details).toEqual([{ path: 'name', message: 'Name is required' }]);
    const d = await request(app).get('/dup');
    expect(d.status).toBe(409);
    expect(d.body).toEqual({
      error: 'This already exists',
      details: [{ path: 'name', message: 'This already exists' }],
    });
  });

  it('maps malformed JSON to 400', async () => {
    const app = appWith((a) => a.post('/t', (req, res) => res.json({})));
    const res = await request(app).post('/t').set('content-type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('pageResult', () => {
  it('computes pages', () => {
    expect(pageResult([1, 2], 41, { page: 2, limit: 20 })).toEqual({
      data: [1, 2],
      page: 2,
      limit: 20,
      total: 41,
      pages: 3,
    });
    expect(pageResult([], 0, { page: 1, limit: 20 }).pages).toBe(0);
  });
});
