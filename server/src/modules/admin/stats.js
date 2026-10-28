import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../config/db.js';
import { requireStaff } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/ApiError.js';
import { round2, toMoney } from '../../utils/helpers.js';
import { mapOrder } from '../mappers.js';

export const adminStatsRouter = Router();
adminStatsRouter.use(requireStaff);

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const delta = (current, previous) => {
  if (!previous) return current > 0 ? 100 : 0;
  return round2(((current - previous) / previous) * 100);
};

adminStatsRouter.get(
  '/',
  validate({
    query: z.object({ days: z.coerce.number().int().min(1).max(365).default(7) }),
  }),
  asyncHandler(async (req, res) => {
    const { days } = req.data.query;
    const now = new Date();
    const rangeStart = startOfUtcDay(new Date(now.getTime() - (days - 1) * 86_400_000));
    const previousStart = new Date(rangeStart.getTime() - days * 86_400_000);

    const [
      currentRow,
      previousRow,
      statusRows,
      seriesRows,
      topFoods,
      topRestaurants,
      recentOrders,
      counts,
      lowStock,
      pendingRow,
    ] = await Promise.all([
      queryOne(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue,
                COALESCE(AVG(total), 0) AS avg_value
         FROM orders WHERE placed_at >= ? AND status = 'DELIVERED'`,
        [rangeStart],
      ),
      queryOne(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue,
                COALESCE(AVG(total), 0) AS avg_value
         FROM orders WHERE placed_at >= ? AND placed_at < ? AND status = 'DELIVERED'`,
        [previousStart, rangeStart],
      ),
      query('SELECT status, COUNT(*) AS total FROM orders GROUP BY status'),
      query(
        `SELECT DATE(placed_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM orders WHERE placed_at >= ? AND status = 'DELIVERED'
         GROUP BY DATE(placed_at) ORDER BY day ASC`,
        [rangeStart],
      ),
      query(
        `SELECT f.id, f.name, f.image_url, SUM(oi.quantity) AS sold, SUM(oi.line_total) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.status = 'DELIVERED'
         JOIN foods f ON f.id = oi.food_id
         WHERE o.placed_at >= ?
         GROUP BY f.id, f.name, f.image_url
         ORDER BY sold DESC LIMIT 5`,
        [rangeStart],
      ),
      query(
        `SELECT r.id, r.name, COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS revenue
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
         WHERE o.status = 'DELIVERED' AND o.placed_at >= ?
         GROUP BY r.id, r.name ORDER BY revenue DESC LIMIT 5`,
        [rangeStart],
      ),
      query(
        `SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url,
                u.name AS customer_name, u.email AS customer_email
         FROM orders o
         JOIN restaurants r ON r.id = o.restaurant_id
         JOIN users u ON u.id = o.user_id
         ORDER BY o.placed_at DESC, o.id DESC LIMIT 6`,
      ),
      query(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE role = 'CUSTOMER') AS customers,
           (SELECT COUNT(*) FROM restaurants WHERE is_active = 1) AS restaurants,
           (SELECT COUNT(*) FROM foods) AS foods,
           (SELECT COUNT(*) FROM orders) AS all_orders`,
        [],
      ),
      query('SELECT COUNT(*) AS total FROM foods WHERE stock <= 10'),
      queryOne("SELECT COUNT(*) AS total FROM orders WHERE status IN ('PENDING','CONFIRMED')"),
    ]);

    const customers = counts[0];
    const newCustomers = await queryOne(
      'SELECT COUNT(*) AS total FROM users WHERE role = ? AND created_at >= ?',
      ['CUSTOMER', rangeStart],
    );
    const prevCustomers = await queryOne(
      'SELECT COUNT(*) AS total FROM users WHERE role = ? AND created_at >= ? AND created_at < ?',
      ['CUSTOMER', previousStart, rangeStart],
    );

    // Build a zero-filled ordered series so the chart never has gaps.
    const seriesMap = new Map(
      seriesRows.map((row) => [
        new Date(row.day).toISOString().slice(0, 10),
        { revenue: toMoney(row.revenue), orders: Number(row.orders) },
      ]),
    );
    const revenueSeries = [];
    for (let index = 0; index < days; index += 1) {
      const date = new Date(rangeStart.getTime() + index * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      const entry = seriesMap.get(key) || { revenue: 0, orders: 0 };
      revenueSeries.push({ date: key, ...entry });
    }

    const statusCounts = Object.fromEntries(statusRows.map((row) => [row.status, Number(row.total)]));
    const revenue = toMoney(currentRow.revenue);
    const previousRevenue = toMoney(previousRow.revenue);

    res.json({
      success: true,
      data: {
        range: { days, from: rangeStart, to: now },
        cards: {
          revenue,
          revenueDelta: delta(revenue, previousRevenue),
          orders: Number(currentRow.orders),
          ordersDelta: delta(Number(currentRow.orders), Number(previousRow.orders)),
          avgOrderValue: toMoney(currentRow.avg_value),
          avgOrderValueDelta: delta(toMoney(currentRow.avg_value), toMoney(previousRow.avg_value)),
          customers: Number(customers.customers),
          newCustomers: Number(newCustomers.total),
          newCustomersDelta: delta(Number(newCustomers.total), Number(prevCustomers.total)),
        },
        inventory: {
          restaurants: Number(customers.restaurants),
          foods: Number(customers.foods),
          totalOrders: Number(customers.all_orders),
          lowStock: Number(lowStock.total),
          awaitingAction: Number(pendingRow.total),
        },
        revenueSeries,
        statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        topFoods: topFoods.map((row) => ({
          id: row.id,
          name: row.name,
          imageUrl: row.image_url,
          sold: Number(row.sold),
          revenue: toMoney(row.revenue),
        })),
        topRestaurants: topRestaurants.map((row) => ({
          id: row.id,
          name: row.name,
          orders: Number(row.orders),
          revenue: toMoney(row.revenue),
        })),
        recentOrders: recentOrders.map((row) => mapOrder(row)),
      },
    });
  }),
);
