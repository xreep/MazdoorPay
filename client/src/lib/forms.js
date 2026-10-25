// Puts the API's per-field errors onto react-hook-form fields. Returns true when any field matched.
// A 409 (e.g. duplicate name) carries its useful sentence in the top-level message.
export function applyServerErrors(error, setError, fields) {
  let matched = false;
  for (const detail of error?.details ?? []) {
    if (fields.includes(detail.path)) {
      setError(detail.path, { message: error.status === 409 ? error.message : detail.message });
      matched = true;
    }
  }
  return matched;
}
