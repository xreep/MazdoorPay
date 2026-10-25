export const pick = (obj, keys) => {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
};

export const whitelist = (allowed) => (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = pick(req.body, allowed);
  }
  next();
};
