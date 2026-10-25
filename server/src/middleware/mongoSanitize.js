// Express 5-compatible MongoDB operator sanitization.
// Strips $ and . keys from req.body, req.query, req.params to prevent operator injection.
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const sanitize = (obj) => {
  if (!isObject(obj)) return obj;
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    cleaned[key] = Array.isArray(value) ? value.map(sanitize) : sanitize(value);
  }
  return cleaned;
};

const setOwn = (req, prop, value) => {
  try {
    Object.defineProperty(req, prop, { value, writable: true, configurable: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`mongoSanitize: could not set ${prop}`, err.message);
  }
};

export const mongoSanitize = (req, res, next) => {
  if (req.body) req.body = sanitize(req.body);
  setOwn(req, 'query', sanitize(req.query));
  setOwn(req, 'params', sanitize(req.params));
  next();
};
