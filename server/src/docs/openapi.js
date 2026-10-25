import { z } from 'zod';
import * as s from '@mazdoorpay/shared';

// OpenAPI 3.1 description of /api/v1, built from the same Zod schemas the routes validate with,
// so the documentation cannot drift from what the API accepts.
const json = (schema) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'draft-2020-12' });

const queryParams = (schema) => {
  const shape = json(schema);
  return Object.entries(shape.properties ?? {}).map(([name, prop]) => ({
    name,
    in: 'query',
    required: (shape.required ?? []).includes(name) && prop.default === undefined,
    schema: prop,
  }));
};

const pathParams = (path) =>
  [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
  }));

const PUBLIC = [];
const BEARER = [{ bearerAuth: [] }];

// [method, path, tag, summary, { body, query, auth = true, csv }]
const ROUTES = [
  ['get', '/health', 'System', 'Liveness and database status', { auth: false }],
  [
    'post',
    '/auth/register',
    'Auth',
    'Create a contractor account (never an admin)',
    { body: s.registerSchema, auth: false },
  ],
  [
    'post',
    '/auth/login',
    'Auth',
    'Log in; sets the httpOnly refresh cookie',
    { body: s.loginSchema, auth: false },
  ],
  [
    'post',
    '/auth/refresh',
    'Auth',
    'Rotate the refresh cookie and get a new access token',
    { auth: false },
  ],
  ['post', '/auth/logout', 'Auth', 'End this login session', { auth: false }],
  ['get', '/auth/me', 'Auth', 'The signed-in user'],
  ['patch', '/auth/me', 'Auth', 'Update name, phone or language', { body: s.updateMeSchema }],

  [
    'get',
    '/dashboard',
    'Dashboard',
    "Today's attendance per site, money totals and a 30-day trend",
  ],

  ['get', '/sites', 'Sites', 'List sites with worker counts', { query: s.siteListQuerySchema }],
  ['post', '/sites', 'Sites', 'Create a site', { body: s.siteCreateSchema }],
  ['get', '/sites/{id}', 'Sites', 'One site with stats'],
  [
    'patch',
    '/sites/{id}',
    'Sites',
    'Rename, move or mark a site inactive',
    { body: s.siteUpdateSchema },
  ],
  ['delete', '/sites/{id}', 'Sites', 'Delete a site that has no workers or records'],

  [
    'get',
    '/workers',
    'Workers',
    'Search and page through workers',
    { query: s.workerListQuerySchema },
  ],
  ['post', '/workers', 'Workers', 'Add a worker', { body: s.workerCreateSchema }],
  ['get', '/workers/{id}', 'Workers', 'One worker with their site'],
  [
    'get',
    '/workers/{id}/summary',
    'Workers',
    'Profile: balance, last 60 days of attendance, recent payments',
  ],
  [
    'patch',
    '/workers/{id}',
    'Workers',
    'Edit profile fields and joining date',
    { body: s.workerUpdateSchema },
  ],
  [
    'post',
    '/workers/{id}/rate',
    'Workers',
    'Change the daily wage from a day; re-prices days already marked',
    { body: s.rateChangeSchema },
  ],
  ['post', '/workers/{id}/deactivate', 'Workers', 'Deactivate a worker (records are kept)'],
  ['post', '/workers/{id}/reactivate', 'Workers', 'Reactivate a worker'],

  [
    'put',
    '/attendance',
    'Attendance',
    "Save a day's marks for many workers",
    { body: s.markAttendanceSchema },
  ],
  [
    'get',
    '/attendance',
    'Attendance',
    'Attendance history',
    { query: s.attendanceListQuerySchema },
  ],
  [
    'get',
    '/attendance/sheet',
    'Attendance',
    "A site's register for one day",
    { query: s.sheetQuerySchema },
  ],
  [
    'get',
    '/attendance/calendar',
    'Attendance',
    'Per-day counts for a month',
    { query: s.calendarQuerySchema },
  ],

  [
    'get',
    '/wages/summary',
    'Wages',
    'Daily or weekly earnings, period payments and balances',
    { query: s.wageSummaryQuerySchema },
  ],

  [
    'post',
    '/payments',
    'Payments',
    'Record a wage payment or advance (idempotent per request key)',
    { body: s.paymentCreateSchema },
  ],
  ['get', '/payments', 'Payments', 'Payment history', { query: s.paymentListQuerySchema }],
  [
    'get',
    '/payments/dues',
    'Payments',
    'Who is owed wages and who holds an advance',
    { query: s.duesQuerySchema },
  ],
  ['get', '/payments/{id}', 'Payments', 'One payment with receipt details'],
  [
    'post',
    '/payments/{id}/void',
    'Payments',
    'Void a mistaken payment with a reason',
    { body: s.voidPaymentSchema },
  ],

  [
    'get',
    '/reports/attendance',
    'Reports',
    'Attendance report (JSON or CSV)',
    { query: s.reportRangeQuerySchema, csv: true },
  ],
  [
    'get',
    '/reports/muster-roll',
    'Reports',
    'Muster roll for a site and month (JSON or CSV)',
    { query: s.musterRollQuerySchema, csv: true },
  ],
  [
    'get',
    '/reports/wage-register',
    'Reports',
    'Wage register (JSON or CSV)',
    { query: s.reportRangeQuerySchema, csv: true },
  ],
  [
    'get',
    '/reports/payments',
    'Reports',
    'Payments report (JSON or CSV)',
    { query: s.paymentsReportQuerySchema, csv: true },
  ],

  ['get', '/admin/overview', 'Admin', 'Platform totals and engagement'],
  [
    'get',
    '/admin/growth',
    'Admin',
    'New contractors, workers and activity per week',
    { query: s.growthQuerySchema },
  ],
  [
    'get',
    '/admin/activity/daily',
    'Admin',
    'Actions and active contractors per day',
    { query: s.dailyActivityQuerySchema },
  ],
  ['get', '/admin/users', 'Admin', 'Search users', { query: s.adminUserListQuerySchema }],
  ['get', '/admin/users/{id}', 'Admin', "A user's read-only stats and sites"],
  [
    'get',
    '/admin/users/{id}/workers',
    'Admin',
    "A contractor's workers with masked contact details",
    { query: s.adminWorkerListQuerySchema },
  ],
  [
    'post',
    '/admin/users/{id}/suspend',
    'Admin',
    'Suspend a contractor (ends their sessions)',
    { body: s.suspendUserSchema },
  ],
  ['post', '/admin/users/{id}/reactivate', 'Admin', 'Reactivate a contractor'],
  ['get', '/admin/activity', 'Admin', 'Audit log', { query: s.activityQuerySchema }],
  ['get', '/admin/anomalies', 'Admin', 'Data accuracy checks'],
  [
    'get',
    '/admin/kpis',
    'Admin',
    'Project KPIs (JSON or CSV)',
    { query: s.kpiQuerySchema, csv: true },
  ],
];

const errorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string', description: 'Plain-language message' },
    details: {
      type: 'array',
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
};

function operation([, path, tag, summary, opts = {}]) {
  const { body, query, auth = true, csv = false } = opts;
  const op = {
    tags: [tag],
    summary,
    security: auth ? BEARER : PUBLIC,
    parameters: [...pathParams(path), ...(query ? queryParams(query) : [])],
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': { schema: { type: 'object' } },
          ...(csv ? { 'text/csv': { schema: { type: 'string' } } } : {}),
        },
      },
      400: {
        description: 'Validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ...(auth
        ? {
            401: { description: 'Not signed in or session expired' },
            404: { description: 'Not found (or not yours)' },
          }
        : {}),
    },
  };
  if (body)
    op.requestBody = { required: true, content: { 'application/json': { schema: json(body) } } };
  if (!op.parameters.length) delete op.parameters;
  return op;
}

export function buildOpenApi() {
  const paths = {};
  for (const route of ROUTES) {
    const [method, path] = route;
    paths[path] = { ...paths[path], [method]: operation(route) };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'MazdoorPay API',
      version: '1.0.0',
      description:
        'Attendance, wages and payments for construction contractors. Money is integer paise; days are YYYY-MM-DD in India time. ' +
        "Contractor routes only ever see the caller's own data (another contractor's ids return 404). Admin routes need an admin account.",
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: { Error: errorSchema },
    },
    paths,
  };
}
