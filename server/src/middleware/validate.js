import { badRequest } from '../utils/ApiError.js';

const formatIssues = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join('.') : 'value',
    message: issue.message,
  }));

/**
 * Validates any combination of body/query/params and exposes the parsed,
 * coerced values on req.data. Express 5 makes req.query read-only, so parsed
 * values are never written back onto the request itself.
 *
 * validate({ body: schema })  ->  req.data.body
 */
export const validate = (schemas) => (req, _res, next) => {
  const parsed = { body: req.body, query: req.query, params: req.params };

  for (const source of ['body', 'query', 'params']) {
    const schema = schemas[source];
    if (!schema) continue;

    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      return next(badRequest(schemas.message || 'Please check the highlighted fields', formatIssues(result.error)));
    }
    parsed[source] = result.data;
  }

  req.data = parsed;
  return next();
};
