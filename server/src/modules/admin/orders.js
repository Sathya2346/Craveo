import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne, withTransaction } from '../../config/db.js';
import { requireAdmin, requireStaff } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, badRequest, conflict, notFound } from '../../utils/ApiError.js';
import { paginate, paginationMeta } from '../../utils/helpers.js';
import {
  applyCancellation,
  assertTransition,
  findOrderById,
  hydrateOrders,
  ORDER_STATUSES,
  pushHistory,
  TRANSITIONS,
} from '../../services/orderService.js';

export const adminOrderRouter = Router();
adminOrderRouter.use(requireStaff);

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(ORDER_STATUSES).optional(),
  search: z.string().trim().max(80).optional(),
  from: z.string().trim().max(30).optional(),
  to: z.string().trim().max(30).optional(),
});

const ORDER_SELECT = `SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url,
    u.name AS customer_name, u.email AS customer_email
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  JOIN users u ON u.id = o.user_id`;

adminOrderRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { page, limit, status, search, from, to } = req.data.query;
    const { offset } = paginate(page, limit);

    const where = ['1 = 1'];
    const params = [];
    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR r.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (from) {
      const date = new Date(from);
      if (Number.isNaN(date.getTime())) throw badRequest('Invalid "from" date');
      where.push('o.placed_at >= ?');
      params.push(date);
    }
    if (to) {
      const date = new Date(to);
      if (Number.isNaN(date.getTime())) throw badRequest('Invalid "to" date');
      where.push('o.placed_at <= ?');
      params.push(date);
    }
    const whereSql = where.join(' AND ');

    const [rows, totalRow, statusRows, revenueRow] = await Promise.all([
      query(
        `${ORDER_SELECT} WHERE ${whereSql} ORDER BY o.placed_at DESC, o.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id = o.user_id
         JOIN restaurants r ON r.id = o.restaurant_id WHERE ${whereSql}`,
        params,
      ),
      query('SELECT status, COUNT(*) AS total FROM orders GROUP BY status'),
      queryOne(
        `SELECT COALESCE(SUM(total), 0) AS revenue FROM orders o WHERE o.status = 'DELIVERED'`,
      ),
    ]);

    const orders = await hydrateOrders(rows);
    const statusCounts = Object.fromEntries(ORDER_STATUSES.map((key) => [key, 0]));
    for (const row of statusRows) statusCounts[row.status] = Number(row.total);

    res.json({
      success: true,
      data: orders,
      meta: paginationMeta(totalRow.total, page, limit),
      summary: {
        statusCounts,
        totalOrders: Object.values(statusCounts).reduce((sum, value) => sum + value, 0),
        revenue: Number(revenueRow.revenue),
      },
    });
  }),
);

adminOrderRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound('Order not found');

    const row = await findOrderById(id);
    const [order] = await hydrateOrders([row], { history: true });
    res.json({
      success: true,
      data: { ...order, allowedNextStatuses: TRANSITIONS[order.status] || [] },
    });
  }),
);

adminOrderRouter.patch(
  '/:id/status',
  validate({
    body: z.object({
      status: z.enum(ORDER_STATUSES),
      note: z.string().trim().max(255).optional(),
      reason: z.string().trim().max(255).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound('Order not found');

    const { status, note, reason } = req.data.body;

    await withTransaction(async (tx) => {
      const order = await tx.one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!order) throw notFound('Order not found');
      assertTransition(order.status, status);

      if (status === 'CANCELLED') {
        await applyCancellation(tx, order, reason || note || 'Cancelled by restaurant');
        return;
      }

      if (status === 'DELIVERED') {
        const paymentStatus = order.payment_status === 'REFUNDED' ? 'REFUNDED' : 'PAID';
        await tx.execute(
          `UPDATE orders SET status = 'DELIVERED', delivered_at = UTC_TIMESTAMP(), payment_status = ?
           WHERE id = ?`,
          [paymentStatus, id],
        );
      } else {
        await tx.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
      }

      await pushHistory(tx, id, status, note || null);
    });

    const row = await findOrderById(id);
    const [order] = await hydrateOrders([row], { history: true });
    res.json({
      success: true,
      data: { ...order, allowedNextStatuses: TRANSITIONS[order.status] || [] },
      message: `Order marked ${status.replaceAll('_', ' ').toLowerCase()}`,
    });
  }),
);

adminOrderRouter.patch(
  '/:id/payment',
  validate({ body: z.object({ paymentStatus: z.enum(['PENDING', 'PAID', 'REFUNDED', 'FAILED']) }) }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) throw notFound('Order not found');
    if (order.status === 'CANCELLED' && req.data.body.paymentStatus === 'PAID') {
      throw conflict('A cancelled order cannot be marked as paid');
    }

    await execute('UPDATE orders SET payment_status = ? WHERE id = ?', [req.data.body.paymentStatus, id]);
    const row = await findOrderById(id);
    const [updated] = await hydrateOrders([row], { history: true });
    res.json({ success: true, data: updated, message: 'Payment status updated' });
  }),
);

adminOrderRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const order = await queryOne('SELECT status FROM orders WHERE id = ?', [id]);
    if (!order) throw notFound('Order not found');
    if (order.status !== 'CANCELLED') {
      throw conflict('Only cancelled orders can be deleted. Cancel the order first.');
    }

    await execute('DELETE FROM orders WHERE id = ?', [id]);
    res.json({ success: true, message: 'Cancelled order deleted' });
  }),
);
