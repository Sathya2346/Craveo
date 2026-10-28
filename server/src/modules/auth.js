import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { execute, queryOne } from '../config/db.js';
import { requireAuth, toPublicUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { signToken } from '../utils/jwt.js';
import { asyncHandler, badRequest, conflict, unauthorized } from '../utils/ApiError.js';
import { mapUser } from './mappers.js';

export const authRouter = Router();

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Email is too short')
  .max(190, 'Email is too long')
  .email('Enter a valid email address');

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be 72 characters or less');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{6,20}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal('').transform(() => undefined));

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(72),
});

/** Accepts http(s) URLs or local /uploads paths. Blocks javascript:/data: schemes. */
const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || value.startsWith('/') || /^https?:\/\//i.test(value), {
    message: 'Enter a valid image URL',
  })
  .optional()
  .or(z.literal('').transform(() => null));

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: phoneSchema,
  avatarUrl: imageUrlSchema,
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

const PUBLIC_COLUMNS = 'id, name, email, phone, role, avatar_url, is_active, created_at';

authRouter.post(
  '/register',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyPrefix: 'register' }),
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.data.body;

    const existing = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing) {
      throw conflict('An account with this email already exists', { field: 'email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Role is always CUSTOMER here - staff accounts are promoted by an admin.
    const result = await execute(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'CUSTOMER')`,
      [name, email, phone || null, passwordHash],
    );

    const user = await queryOne(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`, [result.insertId]);
    res.status(201).json({
      success: true,
      data: { user: mapUser(user), token: signToken(user) },
      message: `Welcome to Craveo, ${user.name.split(' ')[0]}!`,
    });
  }),
);

authRouter.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'login' }),
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.data.body;
    const user = await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);

    // Same message for unknown email and wrong password: no account enumeration.
    const invalid = () => unauthorized('Email or password is incorrect');
    if (!user) throw invalid();

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) throw invalid();
    if (!user.is_active) {
      throw unauthorized('This account has been deactivated. Contact support.');
    }

    res.json({
      success: true,
      data: { user: toPublicUser(user), token: signToken(user) },
      message: `Welcome back, ${user.name.split(' ')[0]}!`,
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [orderStats, addressCount, favouriteCount] = await Promise.all([
      queryOne(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered
         FROM orders WHERE user_id = ?`,
        [req.user.id],
      ),
      queryOne('SELECT COUNT(*) AS total FROM addresses WHERE user_id = ?', [req.user.id]),
      queryOne('SELECT COUNT(*) AS total FROM favourites WHERE user_id = ?', [req.user.id]),
    ]);

    res.json({
      success: true,
      data: {
        user: req.user,
        stats: {
          orders: Number(orderStats.total || 0),
          delivered: Number(orderStats.delivered || 0),
          addresses: Number(addressCount.total || 0),
          favourites: Number(favouriteCount.total || 0),
        },
      },
    });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  validate({ body: profileSchema }),
  asyncHandler(async (req, res) => {
    const { name, phone, avatarUrl } = req.data.body;
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone || null);
    }
    if (avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(avatarUrl || null);
    }
    if (!updates.length) throw badRequest('Nothing to update');

    values.push(req.user.id);
    await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const user = await queryOne(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`, [req.user.id]);
    res.json({ success: true, data: { user: mapUser(user) }, message: 'Profile updated' });
  }),
);

authRouter.patch(
  '/password',
  requireAuth,
  validate({ body: passwordChangeSchema }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.data.body;
    if (currentPassword === newPassword) {
      throw badRequest('New password must be different from the current one');
    }

    const user = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) throw badRequest('Current password is incorrect', [{ field: 'currentPassword' }]);

    const hash = await bcrypt.hash(newPassword, 10);
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true, message: 'Password updated successfully' });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    // JWTs are stateless: the client drops the token. Kept for a clean API shape.
    res.json({ success: true, message: 'Signed out' });
  }),
);

authRouter.get(
  '/check-email',
  validate({ query: z.object({ email: emailSchema }) }),
  asyncHandler(async (req, res) => {
    const row = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [req.data.query.email]);
    res.json({ success: true, data: { available: !row } });
  }),
);
