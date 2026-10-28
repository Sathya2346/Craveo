import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, notFound } from '../utils/ApiError.js';
import { mapFood } from './mappers.js';

export const favouriteRouter = Router();
favouriteRouter.use(requireAuth);

favouriteRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT f.*, r.name AS restaurant_name, r.slug AS restaurant_slug,
              r.is_open AS restaurant_is_open, c.name AS category_name
       FROM favourites fav
       JOIN foods f ON f.id = fav.food_id
       JOIN restaurants r ON r.id = f.restaurant_id
       JOIN categories c ON c.id = f.category_id
       WHERE fav.user_id = ?
       ORDER BY fav.created_at DESC`,
      [req.user.id],
    );
    res.json({ success: true, data: rows.map(mapFood) });
  }),
);

favouriteRouter.get(
  '/ids',
  asyncHandler(async (req, res) => {
    const rows = await query('SELECT food_id FROM favourites WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: rows.map((row) => row.food_id) });
  }),
);

favouriteRouter.post(
  '/',
  validate({ body: z.object({ foodId: z.coerce.number().int().positive() }) }),
  asyncHandler(async (req, res) => {
    const { foodId } = req.data.body;
    const food = await queryOne('SELECT id FROM foods WHERE id = ?', [foodId]);
    if (!food) throw notFound('Dish not found');

    await execute('INSERT IGNORE INTO favourites (user_id, food_id) VALUES (?, ?)', [
      req.user.id,
      foodId,
    ]);
    res.status(201).json({ success: true, data: { foodId, isFavourite: true }, message: 'Saved to favourites' });
  }),
);

favouriteRouter.delete(
  '/:foodId',
  asyncHandler(async (req, res) => {
    const foodId = Number(req.params.foodId);
    if (!Number.isInteger(foodId) || foodId <= 0) throw notFound('Dish not found');

    await execute('DELETE FROM favourites WHERE user_id = ? AND food_id = ?', [req.user.id, foodId]);
    res.json({ success: true, data: { foodId, isFavourite: false }, message: 'Removed from favourites' });
  }),
);
