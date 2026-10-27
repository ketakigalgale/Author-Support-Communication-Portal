import { ApiError } from '../utils/ApiError.js';

// Validates req[part] against a zod schema and replaces it with the parsed
// (and coerced/defaulted) value, so controllers can trust the shape downstream.
export function validate(schema, part = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req[part] = result.data;
    next();
  };
}
