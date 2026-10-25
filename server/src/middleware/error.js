import { ZodError } from 'zod';
import { VALIDATION_MESSAGE, issuesToDetails } from './validate.js';

const BODY_PARSER_MESSAGES = {
  'entity.parse.failed': 'Request body is not valid JSON',
  'entity.too.large': 'Request is too large',
};

const toResponse = (err) => {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: VALIDATION_MESSAGE, details: issuesToDetails(err.issues) },
    };
  }
  if (err.name === 'CastError') return { status: 400, body: { error: 'Invalid id' } };
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return { status: 400, body: { error: VALIDATION_MESSAGE, details } };
  }
  if (err.code === 11000) {
    const details = Object.keys(err.keyValue || err.keyPattern || {}).map((path) => ({
      path,
      message: 'This already exists',
    }));
    return { status: 409, body: { error: 'This already exists', details } };
  }
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    const message =
      BODY_PARSER_MESSAGES[err.type] || (err.expose !== false ? err.message : 'Bad request');
    return {
      status,
      body: err.details ? { error: message, details: err.details } : { error: message },
    };
  }
  return { status: status >= 500 ? status : 500, body: { error: 'Something went wrong' } };
};

// Central error handler: never leaks stack traces or internal messages.
export const errorHandler = (err, req, res, _next) => {
  const { status, body } = toResponse(err);
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(status).json(body);
};
