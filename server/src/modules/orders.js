import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne, withTransaction } from '../config/db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/ApiError.js';
import { orderNumber, paginate, paginationMeta, round2, toMoney } from '../utils/helpers.js';
import { getSettings, buildPricing } from '../services/settings.js';
import { evaluateCoupon } from '../services/coupon.js';
import {
  applyCancellation,
  CUSTOMER_CANCELLABLE,
  findOrderForUser,
  hydrateOrders,
  ORDER_STATUSES,
  pushHistory,
} from '../services/orderService.js';
import { mapRestaurant } from './mappers.js';

export const orderRouter = Router();

const phoneRegex = /^[0-9+\-\s()]{6,20}$/;

const cartItemSchema = z.object({
  foodId: z.coerce.number().int().positive('Invalid dish'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(20, 'Max 20 per dish'),
});

const quoteSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Add at least one dish').max(20),
  couponCode: z.string().trim().max(30).optional().or(z.literal('')),
});

const createOrderSchema = z
  .object({
    items: z.array(cartItemSchema).min(1, 'Add at least one dish').max(20),
    addressId: z.coerce.number().int().positive().optional(),
    contactName: z.string().trim().min(2).max(100).optional(),
    contactPhone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number').optional(),
    line1: z.string().trim().min(5).max(255).optional(),
    line2: z.string().trim().max(255).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    pincode: z.string().trim().regex(/^[0-9]{5,6}$/, 'Enter a valid pincode').optional(),
    couponCode: z.string().trim().max(30).optional().or(z.literal('')),
    paymentMethod: z.enum(['COD', 'UPI', 'CARD']).default('COD'),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.addressId) return;
    const required = {
      contactName: 'Delivery name is required',
      contactPhone: 'Phone number is required',
      line1: 'Address is required',
      city: 'City is required',
      pincode: 'Pincode is required',
    };
    for (const [field, message] of Object.entries(required)) {
      if (!value[field]) ctx.addIssue({ code: 'custom', path: [field], message });
    }
  });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(ORDER_STATUSES).optional(),
});

/** Loads cart lines with restaurant data and validates availability. */
const loadCart = async (items, db) => {
  const merged = new Map();
  for (const item of items) {
    merged.set(item.foodId, (merged.get(item.foodId) || 0) + item.quantity);
  }

  const ids = [...merged.keys()];
  if (ids.length > 20) throw badRequest('Too many different dishes in one order');
  const totalQuantity = [...merged.values()].reduce((sum, quantity) => sum + quantity, 0);
  if (totalQuantity > 50) throw badRequest('Maximum 50 items per order');

  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.query(
    `SELECT f.*, r.name AS restaurant_name, r.slug AS restaurant_slug, r.is_open AS restaurant_open,
            r.is_active AS restaurant_active, r.delivery_fee AS delivery_fee,
            r.min_order AS min_order, r.rating AS restaurant_rating
     FROM foods f JOIN restaurants r ON r.id = f.restaurant_id
     WHERE f.id IN (${placeholders})`,
    ids,
  );

  const byId = new Map(rows.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw badRequest('Some dishes are no longer on the menu', missing.map((id) => ({ field: 'items', id })));
  }

  const restaurant = rows[0];
  const differentRestaurant = rows.find((row) => row.restaurant_id !== restaurant.restaurant_id);
  if (differentRestaurant) {
    throw badRequest('Each order can only contain dishes from one restaurant');
  }
  if (!restaurant.restaurant_active) throw conflict('This restaurant is no longer available');
  if (!restaurant.restaurant_open) throw conflict('This restaurant is currently closed');

  const unavailable = [];
  const lines = [];
  for (const [foodId, quantity] of merged) {
    const row = byId.get(foodId);
    if (!row.is_available) {
      unavailable.push({ foodId, name: row.name, reason: 'unavailable' });
      continue;
    }
    if (row.stock < quantity) {
      unavailable.push({ foodId, name: row.name, reason: 'stock', available: row.stock });
      continue;
    }
    const unitPrice = row.discount_price !== null ? toMoney(row.discount_price) : toMoney(row.price);
    lines.push({
      foodId,
      name: row.name,
      imageUrl: row.image_url,
      quantity,
      unitPrice,
      lineTotal: round2(unitPrice * quantity),
    });
  }

  if (unavailable.length) {
    throw conflict(
      unavailable[0].reason === 'stock'
        ? `Only ${unavailable[0].available} left of ${unavailable[0].name}`
        : 'Some dishes just became unavailable',
      unavailable,
    );
  }

  return {
    lines,
    restaurant,
    restaurantSummary: mapRestaurant({
      ...restaurant,
      id: restaurant.restaurant_id,
      name: restaurant.restaurant_name,
      slug: restaurant.restaurant_slug,
      rating: restaurant.restaurant_rating,
      is_open: restaurant.restaurant_open,
      is_active: restaurant.restaurant_active,
    }),
  };
};

/** Server-authoritative pricing. The client's numbers are never trusted. */
const buildQuote = async ({ userId, items, couponCode, db = { query, one: queryOne }, lockCoupon = false, settings }) => {
  const { lines, restaurant, restaurantSummary } = await loadCart(items, db);
  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const resolvedSettings = settings || (await getSettings());

  const minOrder = toMoney(restaurant.min_order);
  if (subtotal < minOrder) {
    throw badRequest(`Minimum order for ${restaurant.restaurant_name} is ₹${minOrder}`, [
      { field: 'items', message: `Add ₹${round2(minOrder - subtotal)} more to checkout` },
    ]);
  }

  let discount = 0;
  let coupon = null;
  let couponError = null;

  if (couponCode) {
    try {
      const evaluated = await evaluateCoupon({
        code: couponCode,
        subtotal,
        userId,
        one: db.one,
        lock: lockCoupon,
      });
      discount = evaluated.discount;
      coupon = evaluated.coupon;
    } catch (error) {
      if (lockCoupon) throw error;
      couponError = error.message;
    }
  }

  const pricing = buildPricing({ subtotal, restaurant, settings: resolvedSettings, discount });

  return {
    lines,
    restaurant,
    restaurantSummary,
    pricing: { ...pricing, minOrder, freeDeliveryAbove: toMoney(resolvedSettings.free_delivery_above) },
    coupon: coupon ? { id: coupon.id, code: coupon.code, description: coupon.description, discount } : null,
    couponError,
  };
};

const ORDER_ROW_SELECT = `SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url
  FROM orders o JOIN restaurants r ON r.id = o.restaurant_id`;

orderRouter.post(
  '/quote',
  optionalAuth,
  validate({ body: quoteSchema }),
  asyncHandler(async (req, res) => {
    const { items, couponCode } = req.data.body;
    const quote = await buildQuote({
      userId: req.user?.id ?? null,
      items,
      couponCode,
    });

    res.json({
      success: true,
      data: {
        items: quote.lines,
        restaurant: quote.restaurantSummary,
        pricing: quote.pricing,
        coupon: quote.coupon,
        couponError: quote.couponError,
        itemCount: quote.lines.reduce((sum, line) => sum + line.quantity, 0),
      },
    });
  }),
);

orderRouter.post(
  '/',
  requireAuth,
  validate({ body: createOrderSchema }),
  asyncHandler(async (req, res) => {
    const body = req.data.body;
    const userId = req.user.id;

    let snapshot;
    if (body.addressId) {
      const address = await queryOne('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [
        body.addressId,
        userId,
      ]);
      if (!address) throw notFound('Selected delivery address was not found');
      snapshot = {
        contactName: address.contact_name,
        contactPhone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        pincode: address.pincode,
      };
    } else {
      snapshot = {
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        line1: body.line1,
        line2: body.line2 || null,
        city: body.city,
        pincode: body.pincode,
      };
    }

    const paymentStatus = body.paymentMethod === 'COD' ? 'PENDING' : 'PAID';

    const created = await withTransaction(async (tx) => {
      const db = { query: tx.query, one: tx.one };
      const settings = await getSettings();
      const quote = await buildQuote({
        userId,
        items: body.items,
        couponCode: body.couponCode,
        db,
        lockCoupon: true,
        settings,
      });

      for (const line of quote.lines) {
        const result = await tx.execute(
          'UPDATE foods SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [line.quantity, line.foodId, line.quantity],
        );
        if (result.affectedRows === 0) {
          throw conflict(`${line.name} just went out of stock`, [{ foodId: line.foodId }]);
        }
      }

      const number = orderNumber();
      const orderInsert = await tx.execute(
        `INSERT INTO orders (order_number, user_id, restaurant_id, status, payment_method, payment_status,
           contact_name, contact_phone, delivery_line1, delivery_line2, delivery_city, delivery_pincode, notes,
           subtotal, discount, delivery_fee, tax, total, coupon_id, coupon_code)
         VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          number,
          userId,
          quote.restaurant.restaurant_id,
          body.paymentMethod,
          paymentStatus,
          snapshot.contactName,
          snapshot.contactPhone,
          snapshot.line1,
          snapshot.line2,
          snapshot.city,
          snapshot.pincode,
          body.notes || null,
          quote.pricing.subtotal,
          quote.pricing.discount,
          quote.pricing.deliveryFee,
          quote.pricing.tax,
          quote.pricing.total,
          quote.coupon?.id ?? null,
          quote.coupon?.code ?? null,
        ],
      );

      const orderId = orderInsert.insertId;
      for (const line of quote.lines) {
        await tx.execute(
          `INSERT INTO order_items (order_id, food_id, name, image_url, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, line.foodId, line.name, line.imageUrl, line.unitPrice, line.quantity, line.lineTotal],
        );
      }

      if (quote.coupon) {
        await tx.execute('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [quote.coupon.id]);
        await tx.execute(
          'INSERT INTO coupon_redemptions (coupon_id, user_id, order_id) VALUES (?, ?, ?)',
          [quote.coupon.id, userId, orderId],
        );
      }

      await pushHistory(
        tx,
        orderId,
        'PENDING',
        body.paymentMethod === 'COD' ? 'Order placed · Cash on delivery' : `Order placed · Paid via ${body.paymentMethod}`,
      );

      return orderId;
    });

    const row = await queryOne(`${ORDER_ROW_SELECT} WHERE o.id = ?`, [created]);
    const [order] = await hydrateOrders([row], { history: true });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order placed. The kitchen has been notified!',
    });
  }),
);

orderRouter.get(
  '/',
  requireAuth,
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, status } = req.data.query;
    const { offset } = paginate(page, limit);

    const where = ['o.user_id = ?'];
    const params = [req.user.id];
    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }
    const whereSql = where.join(' AND ');

    const [rows, totalRow, summary] = await Promise.all([
      query(`${ORDER_ROW_SELECT} WHERE ${whereSql} ORDER BY o.placed_at DESC, o.id DESC LIMIT ? OFFSET ?`, [
        ...params,
        limit,
        offset,
      ]),
      queryOne(`SELECT COUNT(*) AS total FROM orders o WHERE ${whereSql}`, params),
      queryOne(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'DELIVERED' THEN total ELSE 0 END) AS spent
         FROM orders WHERE user_id = ?`,
        [req.user.id],
      ),
    ]);

    const orders = await hydrateOrders(rows, { reviews: req.user.id });
    res.json({
      success: true,
      data: orders,
      meta: paginationMeta(totalRow.total, page, limit),
      summary: { totalOrders: Number(summary.total || 0), totalSpent: toMoney(summary.spent || 0) },
    });
  }),
);

orderRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound('Order not found');

    const row = await findOrderForUser(id, req.user.id);
    const [order] = await hydrateOrders([row], { history: true, reviews: req.user.id });

    res.json({
      success: true,
      data: {
        ...order,
        canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
        canReview: order.status === 'DELIVERED' && !order.hasReview,
      },
    });
  }),
);

orderRouter.patch(
  '/:id/cancel',
  requireAuth,
  validate({ body: z.object({ reason: z.string().trim().max(255).optional() }) }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound('Order not found');

    const order = await findOrderForUser(id, req.user.id);
    if (order.status === 'CANCELLED') throw conflict('This order is already cancelled');
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw conflict(`Your order is already ${order.status.replaceAll('_', ' ').toLowerCase()} and cannot be cancelled here. Contact support.`);
    }

    await withTransaction(async (tx) => {
      const fresh = await tx.one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!CUSTOMER_CANCELLABLE.includes(fresh.status)) {
        throw conflict('This order moved forward and can no longer be cancelled');
      }
      await applyCancellation(tx, fresh, req.data.body.reason || 'Cancelled by customer');
    });

    const row = await findOrderForUser(id, req.user.id);
    const [updated] = await hydrateOrders([row], { history: true, reviews: req.user.id });

    res.json({ success: true, data: updated, message: 'Order cancelled' });
  }),
);
