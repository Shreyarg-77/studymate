import httpError from "../utils/httpError.js";

function hasUnsafeKey(value, depth = 0) {
  if (value === null || typeof value !== "object") return false;
  if (depth > 6) return true;
  for (const key of Object.keys(value)) {
    if (/[$.]/.test(key) || key === "__proto__") return true;
    if (hasUnsafeKey(value[key], depth + 1)) return true;
  }
  return false;
}

export default function sanitizeInput(req, res, next) {
  if (
    hasUnsafeKey(req.body) ||
    hasUnsafeKey(req.query) ||
    hasUnsafeKey(req.params)
  ) {
    return next(
      httpError(400, "Request contains characters that are not allowed"),
    );
  }
  next();
}
