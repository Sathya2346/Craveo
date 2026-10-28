import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db.js';
import { requireStaff } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, notFound } from '../../utils/ApiError.js';
import { paginate, paginationMeta } from '../../utils/helpers.js';
import { recalculateFoodRating } from '../../services/orderService.js';
import { mapReview } from '../mappers.js';

export const adminReviewRouter = Router();
adminReviewRouter.use(requireStaff);

const REVIEW_SELECT = `SELECT rv.*, f.name AS food_name, f.image_url AS food_image_url,
    r.name AS restaurant_name, u.name AS user_name, u.avatar_url AS user_avatar_url
  FROM reviews rv
  JOIN foods f ON f.id = rv.food_id
  JOIN restaurants r ON r.id = rv.restaurant_id
  JOIN users u ON u.id = rv.user_id`;

adminReviewRouter.get(
  '/',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(10),
      status: z.enum(['all', 'approved', 'pending']).default('all'),
      rating: z.coerce.number().int().min(1).max(5).optional(),
      search: z.string().trim().max(80).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, limit, status, rating, search } = req.data.query;
    const { offset } = paginate(page, limit);

    const where = ['1 = 1'];
    const params = [];
    if (status !== 'all') {
      where.push('rv.is_approved = ?');
      params.push(status === 'approved' ? 1 : 0);
    }
    if (rating) {
      where.push('rv.rating = ?');
      params.push(rating);
    }
    if (search) {
      where.push('(f.name LIKE ? OR u.name LIKE ? OR rv.comment LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const whereSql = where.join(' AND ');

    const [rows, totalRow, summary] = await Promise.all([
      query(`${REVIEW_SELECT} WHERE ${whereSql} ORDER BY rv.created_at DESC LIMIT ? OFFSET ?`, [
        ...params,
        limit,
        offset,
      ]),
      queryOne(`SELECT COUNT(*) AS total FROM reviews rv WHERE ${whereSql}`, params),
      queryOne(
        `SELECT ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS total,
                SUM(CASE WHEN is_approved = 0 THEN 1 ELSE 0 END) AS pending
         FROM reviews`,
      ),
    ]);

    res.json({
      success: true,
      data: rows.map(mapReview),
      meta: paginationMeta(totalRow.total, page, limit),
      summary: {
        averageRating: summary.avg_rating ? Number(summary.avg_rating) : 0,
        total: Number(summary.total),
        pending: Number(summary.pending || 0),
      },
    });
  }),
);

adminReviewRouter.patch(
  '/:id',
  validate({ body: z.object({ isApproved: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const review = await queryOne('SELECT * FROM reviews WHERE id = ?', [id]);
    if (!review) throw notFound('Review not found');

    await execute('UPDATE reviews SET is_approved = ? WHERE id = ?', [
      req.data.body.isApproved ? 1 : 0,
      id,
    ]);
    await recalculateFoodRating(review.food_id);

    const row = await queryOne(`${REVIEW_SELECT} WHERE rv.id = ?`, [id]);
    res.json({
      success: true,
      data: mapReview(row),
      message: req.data.body.isApproved ? 'Review published' : 'Review hidden',
    });
  }),
);

adminReviewRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const review = await queryOne('SELECT * FROM reviews WHERE id = ?', [id]);
    if (!review) throw notFound('Review not found');

    await execute('DELETE FROM reviews WHERE id = ?', [id]);
    await recalculateFoodRating(review.food_id);
    res.json({ success: true, message: 'Review deleted' });
  }),
);
