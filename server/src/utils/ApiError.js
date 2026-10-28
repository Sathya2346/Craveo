export class ApiError extends Error {
  constructor(statusCode, message, { code = 'ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }
}

export const badRequest = (message, details) =>
  new ApiError(400, message, { code: 'VALIDATION_ERROR', details });

export const unauthorized = (message = 'Please sign in to continue') =>
  new ApiError(401, message, { code: 'UNAUTHORIZED' });

export const forbidden = (message = 'You do not have permission to do that') =>
  new ApiError(403, message, { code: 'FORBIDDEN' });

export const notFound = (message = 'Resource not found') =>
  new ApiError(404, message, { code: 'NOT_FOUND' });

export const conflict = (message, details) =>
  new ApiError(409, message, { code: 'CONFLICT', details });

export const tooManyRequests = (message = 'Too many requests, please slow down') =>
  new ApiError(429, message, { code: 'RATE_LIMITED' });

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
