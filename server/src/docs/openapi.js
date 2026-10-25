import { z } from 'zod';
import * as s from '@mazdoorpay/shared';

// OpenAPI 3.1 description of /api/v1. Request bodies and query parameters are generated from the
// Zod schemas the routes validate with; the route list below is kept by hand, and a test checks it
// against the routers. Response bodies are described in words only.
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

// [method, path, tag, summary, { body, query, auth = true, csv, created, errors }]
// `created`: success is 201; `errors`: extra status codes the route returns, with their meaning.
const ROUTES = [
  [
    'get',
    '/health',
    'System',
    'Liveness and database status',
    { auth: false, errors: { 503: 'Database not connected' } },
  ],
  [
    'post',
    '/auth/register',
    'Auth',
    'Create a contractor account (never an admin)',
    {
      body: s.registerSchema,
      auth: false,
      created: true,
      errors: { 409: 'An account with this email already exists' },
    },
  ],
  [
    'post',
    '/auth/login',
    'Auth',
    'Log in; sets the httpOnly refresh cookie',
    {
      body: s.loginSchema,
      auth: false,
      errors: {
        401: 'Wrong email or password',
        403: 'Account suspended',
        423: 'Locked for a while after repeated failed attempts',
      },
    },
  ],
  [
    'post',
    '/auth/refresh',
    'Auth',
    'Rotate the refresh cookie and get a new access token',
    { auth: false, errors: { 401: 'No valid session' } },
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
  [
    'post',
    '/sites',
    'Sites',
    'Create a site',
    { body: s.siteCreateSchema, created: true, errors: { 409: 'A site with this name exists' } },
  ],
  ['get', '/sites/{id}', 'Sites', 'One site with stats'],
  [
    'patch',
    '/sites/{id}',
    'Sites',
    'Rename, move or mark a site inactive',
    { body: s.siteUpdateSchema, errors: { 409: 'A site with this name exists' } },
  ],
  [
    'delete',
    '/sites/{id}',
    'Sites',
    'Delete a site that has no workers or records',
    { errors: { 409: 'The site has workers or records' } },
  ],

  [
    'get',
    '/workers',
    'Workers',
    'Search and page through workers',
    { query: s.workerListQuerySchema },
  ],
  ['post', '/workers', 'Workers', 'Add a worker', { body: s.workerCreateSchema, created: true }],
  ['get', '/workers/{id}', 'Workers', 'One worker with their site'],
  [
    'get',
    '/workers/{id}/summary',
    'Workers',
    'Profile: balance, last 60 days of attendance, recent payments',
  ],
  [
    'get',
    '/workers/{id}/slip',
    'Workers',
    'Wage slip for a period: days, payments, opening and closing balance',
    { query: s.wageSlipQuerySchema },
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
    {
      body: s.paymentCreateSchema,
      created: true,
      errors: {
        200: 'This request key was seen before: the original payment, not a new one',
        409: 'The request key was already used for a different payment',
      },
    },
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
    { body: s.voidPaymentSchema, errors: { 409: 'Already void' } },
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

const errorContent = { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } };

// Which role a signed-in route needs, from where it is mounted.
const roleError = (path) => {
  if (path.startsWith('/admin/')) return 'Signed in, but not an admin';
  if (path.startsWith('/auth/')) return null;
  return 'Signed in, but not a contractor';
};

function operation([, path, tag, summary, opts = {}]) {
  const { body, query, auth = true, csv = false, created = false, errors = {} } = opts;
  const success = {
    description: created ? 'Created' : 'OK',
    content: {
      'application/json': { schema: { type: 'object' } },
      ...(csv ? { 'text/csv': { schema: { type: 'string' } } } : {}),
    },
  };
  const failure = (description) => ({ description, content: errorContent });
  const responses = {
    [created ? 201 : 200]: success,
    400: { description: 'Validation failed', content: errorContent },
  };
  if (auth) {
    responses[401] = failure('Not signed in or session expired');
    const forbidden = roleError(path);
    if (forbidden) responses[403] = failure(forbidden);
    // Ids arrive in the path, the query or the body; another contractor's ids look missing.
    if (path.includes('{') || query || body) responses[404] = failure('Not found (or not yours)');
  }
  responses[429] = failure('Too many requests; wait a few minutes');
  for (const [code, description] of Object.entries(errors))
    responses[code] = Number(code) < 300 ? { ...success, description } : failure(description);
  const op = {
    tags: [tag],
    summary,
    security: auth ? BEARER : PUBLIC,
    parameters: [...pathParams(path), ...(query ? queryParams(query) : [])],
    responses,
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
