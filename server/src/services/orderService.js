import { query, queryOne } from '../config/db.js';
import { mapOrder, mapOrderItem } from '../modules/mappers.js';
import { badRequest, conflict, notFound } from '../utils/ApiError.js';
import { round2, toMoney } from '../utils/helpers.js';

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

/** Allowed staff transitions. Terminal states are final. */
export const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const CUSTOMER_CANCELLABLE = ['PENDING', 'CONFIRMED'];

export const assertTransition = (from, to) => {
  if (from === to) throw badRequest(`This order is already ${to.toLowerCase()}`);
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw conflict(`Cannot move an order from ${from} to ${to}`, { from, to, allowed });
  }
};

/** Loads items + optional history for a batch of order rows (no N+1). */
export const hydrateOrders = async (rows, { history = false, reviews = null } = {}) => {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(',');

  const itemRows = await query(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    ids,
  );

  const byOrder = new Map();
  for (const item of itemRows) {
    if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, []);
    byOrder.get(item.order_id).push(mapOrderItem(item));
  }

  let historyByOrder = new Map();
  if (history) {
    const historyRows = await query(
      `SELECT order_id, status, note, created_at FROM order_status_history
       WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
      ids,
    );
    for (const entry of historyRows) {
      if (!historyByOrder.has(entry.order_id)) historyByOrder.set(entry.order_id, []);
      historyByOrder.get(entry.order_id).push({
        status: entry.status,
        note: entry.note,
        at: entry.created_at,
      });
    }
  }

  const reviewedByOrder = new Map();
  if (reviews) {
    const reviewRows = await query(
      `SELECT order_id, food_id FROM reviews WHERE user_id = ? AND order_id IN (${placeholders})`,
      [reviews, ...ids],
    );
    for (const row of reviewRows) {
      if (!reviewedByOrder.has(row.order_id)) reviewedByOrder.set(row.order_id, new Set());
      reviewedByOrder.get(row.order_id).add(row.food_id);
    }
  }

  return rows.map((row, index) => {
    const order = mapOrder(row, {
      items: byOrder.get(row.id) || [],
      statusHistory: history ? historyByOrder.get(row.id) || [] : undefined,
      hasReview: reviews
        ? (byOrder.get(row.id) || []).every((item) => reviewedByOrder.get(row.id)?.has(item.foodId))
        : undefined,
    });
    order.index = index;
    delete order.index;
    return order;
  });
};

export const findOrderForUser = async (orderId, userId) => {
  const row = await queryOne(
    `SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url
     FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
     WHERE o.id = ? AND o.user_id = ? LIMIT 1`,
    [orderId, userId],
  );
  if (!row) throw notFound('Order not found');
  return row;
};

export const findOrderById = async (orderId) => {
  const row = await queryOne(
    `SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url,
            u.name AS customer_name, u.email AS customer_email
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     JOIN users u ON u.id = o.user_id
     WHERE o.id = ? LIMIT 1`,
    [orderId],
  );
  if (!row) throw notFound('Order not found');
  return row;
};

/** Restores stock for every line item of a cancelled order. */
export const restoreStock = async (tx, orderId) => {
  const items = await tx.query('SELECT food_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
  for (const item of items) {
    if (!item.food_id) continue;
    await tx.execute('UPDATE foods SET stock = stock + ? WHERE id = ?', [item.quantity, item.food_id]);
  }
};

export const pushHistory = async (tx, orderId, status, note = null) => {
  await tx.execute('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [
    orderId,
    status,
    note,
  ]);
};

/** Shared by customer cancel + admin status change. Must run inside a transaction. */
export const applyCancellation = async (tx, order, reason) => {
  await restoreStock(tx, order.id);
  if (order.coupon_id) {
    await tx.execute('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?', [
      order.coupon_id,
    ]);
  }
  const paymentStatus = order.payment_status === 'PAID' ? 'REFUNDED' : order.payment_status;
  await tx.execute(
    `UPDATE orders SET status = 'CANCELLED', payment_status = ?, cancelled_at = UTC_TIMESTAMP(),
     cancel_reason = ? WHERE id = ?`,
    [paymentStatus, reason || null, order.id],
  );
  await pushHistory(tx, order.id, 'CANCELLED', reason || 'Order cancelled');
};

export const recalculateFoodRating = async (foodId) => {
  const stats = await queryOne(
    `SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total
     FROM reviews WHERE food_id = ? AND is_approved = 1`,
    [foodId],
  );
  await query('UPDATE foods SET rating = ?, review_count = ? WHERE id = ?', [
    stats?.avg_rating ?? 0,
    stats?.total ?? 0,
    foodId,
  ]);
};

export const summarise = (pricing) => ({
  ...pricing,
  total: round2(toMoney(pricing.total)),
});

export { round2, toMoney };
