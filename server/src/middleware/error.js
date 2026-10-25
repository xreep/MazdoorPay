// Central error handler: never leak stack traces to the client.
export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose duplicate key (code 11000) -> conflict
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate value for ${field}`;
  }

  // Mongoose validation error -> 400
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // CastError (bad ObjectId) -> 400
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier';
  }

  console.error('[ERROR]', err);
  res.status(statusCode).json({ error: message });
};
