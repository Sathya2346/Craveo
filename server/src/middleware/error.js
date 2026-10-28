import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist`,
    },
  });
};

const MYSQL_MAP = {
  ER_DUP_ENTRY: { status: 409, code: 'DUPLICATE', message: 'That value already exists' },
  ER_ROW_IS_REFERENCED_2: {
    status: 409,
    code: 'IN_USE',
    message: 'This record is used by other data. Remove those first.',
  },
  ER_NO_REFERENCED_ROW_2: {
    status: 400,
    code: 'INVALID_REFERENCE',
    message: 'A linked record does not exist',
  },
  ER_DATA_TOO_LONG: { status: 400, code: 'TOO_LONG', message: 'One of the values is too long' },
  ECONNREFUSED: {
    status: 503,
    code: 'DB_UNAVAILABLE',
    message: 'The database is unreachable. Is MySQL running?',
  },
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side';
  let details = null;

  if (error instanceof ApiError) {
    status = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error?.code && MYSQL_MAP[error.code]) {
    const mapped = MYSQL_MAP[error.code];
    status = mapped.status;
    code = mapped.code;
    message = mapped.message;
    if (env.nodeEnv !== 'production') details = { sqlMessage: error.sqlMessage };
  } else if (error?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  } else if (error?.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    code = 'FILE_TOO_LARGE';
    message = 'That file is too large';
  } else if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400;
    code = 'UNEXPECTED_FILE';
    message = 'Unexpected file field';
  }

  if (status >= 500 && env.nodeEnv !== 'production') {
    console.error('[error]', req.method, req.originalUrl, error);
    message = error?.message || message;
    details = error?.stack?.split('\n').slice(0, 5) || null;
  }

  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
};
