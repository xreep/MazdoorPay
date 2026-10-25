import { setupServer } from 'msw/node';

export { http, HttpResponse, delay } from 'msw';

// Tests register their own handlers with server.use(...).
export const server = setupServer();

export const API = (path) => `*/api/v1${path}`;
