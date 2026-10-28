import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db.js';
import { requireAdmin, requireStaff } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../../utils/ApiError.js';
import { paginate, paginationMeta } from '../../utils/helpers.js';
import { mapUser } from '../mappers.js';

export const adminUserRouter = Router();
adminUserRouter.use(requireStaff);

const USER_COLUMNS = 'id, name, email, phone, role, avatar_url, is_active, created_at';

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(190),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
  phone: z.string().trim().max(20).optional().or(z.literal('').transform(() => undefined)),
  role: z.enum(['CUSTOMER', 'MANAGER', 'ADMIN']).default('CUSTOMER'),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).optional().or(z.literal('').transform(() => null)),
  role: z.enum(['CUSTOMER', 'MANAGER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(72).optional(),
});

const countActiveAdmins = async (excludeId = null) => {
  const row = await queryOne(
    excludeId
      ? "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND is_active = 1 AND id <> ?"
      : "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND is_active = 1",
    excludeId ? [excludeId] : [],
  );
  return Number(row.total);
};

adminUserRouter.get(
  '/',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(10),
      search: z.string().trim().max(80).optional(),
      role: z.enum(['CUSTOMER', 'MANAGER', 'ADMIN']).optional(),
      status: z.enum(['all', 'active', 'inactive']).default('all'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, limit, search, role, status } = req.data.query;
    const { offset } = paginate(page, limit);

    const where = ['1 = 1'];
    const params = [];
    if (search) {
      where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (role) {
      where.push('role = ?');
      params.push(role);
    }
    if (status !== 'all') {
      where.push('is_active = ?');
      params.push(status === 'active' ? 1 : 0);
    }
    const whereSql = where.join(' AND ');

    const [rows, totalRow, roleRows, orderRows] = await Promise.all([
      query(
        `SELECT ${USER_COLUMNS},
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = users.id) AS order_count,
           (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = users.id AND o.status = 'DELIVERED') AS total_spent
         FROM users WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      queryOne(`SELECT COUNT(*) AS total FROM users WHERE ${whereSql}`, params),
      query('SELECT role, COUNT(*) AS total FROM users GROUP BY role'),
      queryOne(
        `SELECT COUNT(*) AS total FROM users u
         WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)`,
      ),
    ]);

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...mapUser(row),
        orderCount: Number(row.order_count),
        totalSpent: Number(row.total_spent),
      })),
      meta: paginationMeta(totalRow.total, page, limit),
      summary: {
        roleCounts: Object.fromEntries(roleRows.map((row) => [row.role, Number(row.total)])),
        withoutOrders: Number(orderRows.total),
      },
    });
  }),
);

adminUserRouter.post(
  '/',
  requireAdmin,
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, role } = req.data.body;

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) throw conflict('An account with this email already exists', { field: 'email' });

    const hash = await bcrypt.hash(password, 10);
    const result = await execute(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || null, hash, role],
    );

    const row = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, data: mapUser(row), message: `${role} account created` });
  }),
);

adminUserRouter.patch(
  '/:id',
  requireAdmin,
  validate({ body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
    if (!target) throw notFound('User not found');

    const { name, phone, role, isActive, password } = req.data.body;
    const isSelf = id === req.user.id;

    if (isSelf && role && role !== target.role) {
      throw forbidden('You cannot change your own role. Ask another admin.');
    }
    if (isSelf && isActive === false) {
      throw forbidden('You cannot deactivate your own account.');
    }
    if (role && target.role === 'ADMIN' && role !== 'ADMIN') {
      const remaining = await countActiveAdmins(id);
      if (remaining === 0) throw conflict('At least one active admin must remain.');
    }
    if (isActive === false && target.role === 'ADMIN') {
      const remaining = await countActiveAdmins(id);
      if (remaining === 0) throw conflict('At least one active admin must remain.');
    }

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
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }
    if (password !== undefined) {
      updates.push('password_hash = ?');
      values.push(await bcrypt.hash(password, 10));
    }
    if (!updates.length) throw badRequest('Nothing to update');

    await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);
    const row = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
    res.json({ success: true, data: mapUser(row), message: 'User updated' });
  }),
);

adminUserRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw forbidden('You cannot delete your own account.');

    const target = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
    if (!target) throw notFound('User not found');

    if (target.role === 'ADMIN') {
      const remaining = await countActiveAdmins(id);
      if (remaining === 0) throw conflict('At least one active admin must remain.');
    }

    const orders = await queryOne('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [id]);
    if (Number(orders.total) > 0) {
      throw conflict(
        `This customer has ${orders.total} order(s). Deactivate the account instead of deleting it.`,
      );
    }

    await execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted' });
  }),
);
