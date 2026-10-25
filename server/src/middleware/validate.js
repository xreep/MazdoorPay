import { httpError } from '../utils/httpError.js';

export const VALIDATION_MESSAGE = 'Please check the highlighted fields';

export const issuesToDetails = (issues) =>
  issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

// Parses body/query/params with Zod and replaces them with the parsed (stripped, coerced) output.
export const validate = (schemas) => (req, _res, next) => {
  const details = [];
  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      details.push(...issuesToDetails(result.error.issues));
      continue;
    }
    Object.defineProperty(req, part, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  if (details.length) return next(httpError(400, VALIDATION_MESSAGE, details));
  next();
};
