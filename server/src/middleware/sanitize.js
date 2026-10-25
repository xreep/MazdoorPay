// Strips keys that start with `$` or contain `.` from body, query and params so user input
// can never become a MongoDB operator. Express 5 makes req.query a getter, hence defineProperty.
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean);
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    out[key] = clean(inner);
  }
  return out;
};

const setOwn = (req, prop, value) =>
  Object.defineProperty(req, prop, { value, writable: true, configurable: true, enumerable: true });

export const sanitize = (req, _res, next) => {
  if (req.body) req.body = clean(req.body);
  setOwn(req, 'query', clean(req.query));
  setOwn(req, 'params', clean(req.params));
  next();
};
