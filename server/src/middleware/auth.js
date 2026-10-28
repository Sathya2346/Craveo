import { queryOne } from '../config/db.js';
import { verifyToken } from '../utils/jwt.js';
import { forbidden, unauthorized } from '../utils/ApiError.js';

const PUBLIC_USER_COLUMNS =
  'id, name, email, phone, role, avatar_url, is_active, created_at';

const readBearerToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
};

export const toPublicUser = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatarUrl: row.avatar_url,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };

/** Resolves req.user from the bearer token. Never throws. */
export const optionalAuth = async (req, _res, next) => {
  try {
    const token = readBearerToken(req);
    if (!token) return next();

    const payload = verifyToken(token);
    const user = await queryOne(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [Number(payload.sub)],
    );
    if (user && user.is_active) req.user = toPublicUser(user);
    return next();
  } catch {
    // Invalid or expired token: treat the request as anonymous.
    return next();
  }
};

/** Requires a valid token for an active account. */
export const requireAuth = async (req, res, next) => {
  try {
    const token = readBearerToken(req);
    if (!token) throw unauthorized();

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw unauthorized('Your session has expired, please sign in again');
    }

    const user = await queryOne(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [Number(payload.sub)],
    );
    if (!user) throw unauthorized('This account no longer exists');
    if (!user.is_active) throw forbidden('This account has been deactivated');

    req.user = toPublicUser(user);
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Role gate. Use after requireAuth. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  return next();
};

export const requireAdmin = [requireAuth, requireRole('ADMIN')];
export const requireStaff = [requireAuth, requireRole('ADMIN', 'MANAGER')];
