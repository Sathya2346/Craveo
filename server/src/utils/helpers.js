import { badRequest } from './ApiError.js';

export const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

/** Money is rounded to 2 decimals after every operation to avoid float drift. */
export const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const toMoney = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? round2(number) : 0;
};

export const orderNumber = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CRV-${stamp}${random}`;
};

/** Safely build a LIMIT/OFFSET clause from already-validated integers. */
export const paginate = (page = 1, limit = 12) => {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 12)));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
};

export const paginationMeta = (total, page, rawLimit) => {
  // Mirror the clamp applied by paginate() so meta always reflects what was used.
  const limit = Math.min(100, Math.max(1, Math.floor(Number(rawLimit) || 12)));
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
};

export const parseId = (value, label = 'id') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`Invalid ${label}`, [{ field: label, message: 'must be a positive integer' }]);
  }
  return id;
};

export const boolToInt = (value) => (value ? 1 : 0);

/** Only allow sorting on an explicit whitelist - never interpolate user input. */
export const resolveSort = (sort, map, fallback) => map[sort] || fallback;

export const pickDefined = (source, keys) => {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
};

export const buildUpdateSet = (data) => {
  const columns = Object.keys(data);
  if (!columns.length) return null;
  return {
    clause: columns.map((column) => `${column} = ?`).join(', '),
    values: columns.map((column) => data[column]),
  };
};
