import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest, conflict, notFound } from '../utils/ApiError.js';
import { recalculateFoodRating } from '../services/orderService.js';
import { mapReview } from './mappers.js';

export const reviewRouter = Router();
reviewRouter.use(requireAuth);

const reviewSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  foodId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1, 'Pick a rating').max(5, 'Rating must be 1-5'),
  comment: z.string().trim().max(600, 'Keep it under 600 characters').optional().or(z.literal('')),
});

reviewRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT rv.*, f.name AS food_name, f.image_url AS food_image_url,
              r.name AS restaurant_name
       FROM reviews rv
       JOIN foods f ON f.id = rv.food_id
       JOIN restaurants r ON r.id = rv.restaurant_id
       WHERE rv.user_id = ? ORDER BY rv.created_at DESC`,
      [req.user.id],
    );
    res.json({ success: true, data: rows.map(mapReview) });
  }),
);

reviewRouter.post(
  '/',
  validate({ body: reviewSchema }),
  asyncHandler(async (req, res) => {
    const { orderId, foodId, rating, comment } = req.data.body;

    const order = await queryOne(
      'SELECT id, status, restaurant_id FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.user.id],
    );
    if (!order) throw notFound('Order not found');
    if (order.status !== 'DELIVERED') {
      throw badRequest('You can review dishes only after the order is delivered');
    }

    const item = await queryOne('SELECT id FROM order_items WHERE order_id = ? AND food_id = ?', [
      orderId,
      foodId,
    ]);
    if (!item) throw badRequest('That dish is not part of this order');

    const existing = await queryOne(
      'SELECT id FROM reviews WHERE order_id = ? AND food_id = ?',
      [orderId, foodId],
    );
    if (existing) throw conflict('You already reviewed this dish for this order');

    const result = await execute(
      `INSERT INTO reviews (user_id, food_id, restaurant_id, order_id, rating, comment, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [req.user.id, foodId, order.restaurant_id, orderId, rating, comment || null],
    );

    await recalculateFoodRating(foodId);

    const row = await queryOne(
      `SELECT rv.*, f.name AS food_name, r.name AS restaurant_name,
              u.name AS user_name, u.avatar_url AS user_avatar_url
       FROM reviews rv
       JOIN foods f ON f.id = rv.food_id
       JOIN restaurants r ON r.id = rv.restaurant_id
       JOIN users u ON u.id = rv.user_id
       WHERE rv.id = ?`,
      [result.insertId],
    );

    res.status(201).json({ success: true, data: mapReview(row), message: 'Thanks for the review!' });
  }),
);

reviewRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound('Review not found');

    const review = await queryOne('SELECT * FROM reviews WHERE id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);
    if (!review) throw notFound('Review not found');

    await execute('DELETE FROM reviews WHERE id = ?', [id]);
    await recalculateFoodRating(review.food_id);

    res.json({ success: true, message: 'Review removed' });
  }),
);
