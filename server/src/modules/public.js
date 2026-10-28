import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, notFound } from '../utils/ApiError.js';
import { paginate, paginationMeta, resolveSort } from '../utils/helpers.js';
import { getSettings } from '../services/settings.js';
import {
  mapBanner,
  mapCategory,
  mapCoupon,
  mapFood,
  mapRestaurant,
  mapReview,
} from './mappers.js';

export const publicRouter = Router();

// Limits are clamped (not rejected) so a sloppy ?limit=500 still returns data.
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(12),
});

const restaurantQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
  cuisine: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  featured: z.coerce.boolean().optional(),
  openOnly: z.coerce.boolean().optional(),
  sort: z.enum(['popular', 'rating', 'delivery', 'fee', 'newest']).optional().default('popular'),
});

publicRouter.get(
  '/restaurants',
  validate({ query: restaurantQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, search, cuisine, city, featured, openOnly, sort } = req.data.query;
    const { offset } = paginate(page, limit);

    const where = ['r.is_active = 1'];
    const params = [];
    if (openOnly) where.push('r.is_open = 1');
    if (featured) where.push('r.is_featured = 1');
    if (cuisine) {
      where.push('r.cuisine = ?');
      params.push(cuisine);
    }
    if (city) {
      where.push('r.city = ?');
      params.push(city);
    }
    if (search) {
      where.push('(r.name LIKE ? OR r.cuisine LIKE ? OR r.description LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const orderBy = resolveSort(
      sort,
      {
        popular: 'r.sort_order ASC, r.rating DESC',
        rating: 'r.rating DESC, r.review_count DESC',
        delivery: 'r.delivery_time ASC',
        fee: 'r.delivery_fee ASC',
        newest: 'r.created_at DESC',
      },
      'r.sort_order ASC',
    );

    const whereSql = where.join(' AND ');
    const [rows, totalRow] = await Promise.all([
      query(
        `SELECT r.*, (SELECT COUNT(*) FROM foods f WHERE f.restaurant_id = r.id AND f.is_available = 1) AS food_count
         FROM restaurants r WHERE ${whereSql}
         ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      queryOne(`SELECT COUNT(*) AS total FROM restaurants r WHERE ${whereSql}`, params),
    ]);

    res.json({
      success: true,
      data: rows.map(mapRestaurant),
      meta: paginationMeta(totalRow.total, page, limit),
    });
  }),
);

publicRouter.get(
  '/restaurants/:idOrSlug',
  asyncHandler(async (req, res) => {
    const { idOrSlug } = req.params;
    const numeric = /^\d+$/.test(idOrSlug);
    const row = await queryOne(
      numeric
        ? 'SELECT * FROM restaurants WHERE id = ? AND is_active = 1 LIMIT 1'
        : 'SELECT * FROM restaurants WHERE slug = ? AND is_active = 1 LIMIT 1',
      [numeric ? Number(idOrSlug) : idOrSlug],
    );
    if (!row) throw notFound('Restaurant not found');

    const categories = await query(
      `SELECT c.id, c.name, c.slug, COUNT(f.id) AS food_count
       FROM categories c
       JOIN foods f ON f.category_id = c.id AND f.is_available = 1
       WHERE f.restaurant_id = ? AND c.is_active = 1
       GROUP BY c.id, c.name, c.slug, c.sort_order
       ORDER BY c.sort_order ASC, c.name ASC`,
      [row.id],
    );

    res.json({
      success: true,
      data: {
        restaurant: mapRestaurant(row),
        menuCategories: categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          foodCount: Number(category.food_count),
        })),
      },
    });
  }),
);

publicRouter.get(
  '/restaurants/:idOrSlug/foods',
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { idOrSlug } = req.params;
    const { page, limit } = req.data.query;
    const numeric = /^\d+$/.test(idOrSlug);
    const restaurant = await queryOne(
      numeric
        ? 'SELECT id FROM restaurants WHERE id = ? AND is_active = 1'
        : 'SELECT id FROM restaurants WHERE slug = ? AND is_active = 1',
      [numeric ? Number(idOrSlug) : idOrSlug],
    );
    if (!restaurant) throw notFound('Restaurant not found');

    const { offset } = paginate(page, limit);
    const rows = await query(
      `SELECT f.*, c.name AS category_name
       FROM foods f JOIN categories c ON c.id = f.category_id
       WHERE f.restaurant_id = ?
       ORDER BY f.is_available DESC, f.is_featured DESC, f.name ASC
       LIMIT ? OFFSET ?`,
      [restaurant.id, limit, offset],
    );
    const total = await queryOne('SELECT COUNT(*) AS total FROM foods WHERE restaurant_id = ?', [
      restaurant.id,
    ]);

    res.json({
      success: true,
      data: rows.map(mapFood),
      meta: paginationMeta(total.total, page, limit),
    });
  }),
);

const foodQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
  restaurantId: z.coerce.number().int().positive().optional(),
  category: z.string().trim().max(80).optional(),
  foodType: z.enum(['VEG', 'NON_VEG', 'EGG']).optional(),
  featured: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().min(0).max(100_000).optional(),
  maxPrice: z.coerce.number().min(0).max(100_000).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'rating', 'newest']).optional().default('popular'),
});

publicRouter.get(
  '/foods',
  validate({ query: foodQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.data.query;
    const { offset } = paginate(q.page, q.limit);

    const where = ['f.is_available = 1', 'f.stock > 0', 'r.is_active = 1'];
    const params = [];
    if (q.restaurantId) {
      where.push('f.restaurant_id = ?');
      params.push(q.restaurantId);
    }
    if (q.category) {
      where.push('c.slug = ?');
      params.push(q.category);
    }
    if (q.foodType) {
      where.push('f.food_type = ?');
      params.push(q.foodType);
    }
    if (q.featured) where.push('f.is_featured = 1');
    if (q.minPrice !== undefined) {
      where.push('COALESCE(f.discount_price, f.price) >= ?');
      params.push(q.minPrice);
    }
    if (q.maxPrice !== undefined) {
      where.push('COALESCE(f.discount_price, f.price) <= ?');
      params.push(q.maxPrice);
    }
    if (q.search) {
      where.push('(f.name LIKE ? OR f.description LIKE ? OR r.name LIKE ?)');
      const like = `%${q.search}%`;
      params.push(like, like, like);
    }

    const orderBy = resolveSort(
      q.sort,
      {
        popular: 'f.is_featured DESC, f.rating DESC',
        price_asc: 'COALESCE(f.discount_price, f.price) ASC',
        price_desc: 'COALESCE(f.discount_price, f.price) DESC',
        rating: 'f.rating DESC, f.review_count DESC',
        newest: 'f.created_at DESC',
      },
      'f.is_featured DESC',
    );

    const whereSql = where.join(' AND ');
    const baseFrom = `FROM foods f
      JOIN restaurants r ON r.id = f.restaurant_id
      JOIN categories c ON c.id = f.category_id
      WHERE ${whereSql}`;

    const [rows, totalRow] = await Promise.all([
      query(
        `SELECT f.*, r.name AS restaurant_name, r.slug AS restaurant_slug, r.is_open AS restaurant_is_open,
                c.name AS category_name
         ${baseFrom} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        [...params, q.limit, offset],
      ),
      queryOne(`SELECT COUNT(*) AS total ${baseFrom}`, params),
    ]);

    res.json({
      success: true,
      data: rows.map(mapFood),
      meta: paginationMeta(totalRow.total, q.page, q.limit),
    });
  }),
);

publicRouter.get(
  '/foods/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound('Food not found');

    const row = await queryOne(
      `SELECT f.*, r.name AS restaurant_name, r.slug AS restaurant_slug, r.is_open AS restaurant_is_open,
              c.name AS category_name
       FROM foods f
       JOIN restaurants r ON r.id = f.restaurant_id
       JOIN categories c ON c.id = f.category_id
       WHERE f.id = ? LIMIT 1`,
      [id],
    );
    if (!row) throw notFound('Food not found');

    const related = await query(
      `SELECT f.*, r.name AS restaurant_name, c.name AS category_name
       FROM foods f
       JOIN restaurants r ON r.id = f.restaurant_id
       JOIN categories c ON c.id = f.category_id
       WHERE f.category_id = ? AND f.id <> ? AND f.is_available = 1
       ORDER BY f.rating DESC LIMIT 4`,
      [row.category_id, row.id],
    );

    res.json({ success: true, data: { food: mapFood(row), related: related.map(mapFood) } });
  }),
);

publicRouter.get(
  '/foods/:id/reviews',
  validate({
    query: paginationSchema.extend({ limit: z.coerce.number().int().min(1).max(500).default(6) }),
  }),
  asyncHandler(async (req, res) => {
    const foodId = Number(req.params.id);
    if (!Number.isInteger(foodId) || foodId <= 0) throw notFound('Food not found');
    const { page, limit } = req.data.query;
    const { offset } = paginate(page, limit);

    const [rows, totalRow, summary] = await Promise.all([
      query(
        `SELECT rv.*, u.name AS user_name, u.avatar_url AS user_avatar_url
         FROM reviews rv JOIN users u ON u.id = rv.user_id
         WHERE rv.food_id = ? AND rv.is_approved = 1
         ORDER BY rv.created_at DESC LIMIT ? OFFSET ?`,
        [foodId, limit, offset],
      ),
      queryOne(
        'SELECT COUNT(*) AS total FROM reviews WHERE food_id = ? AND is_approved = 1',
        [foodId],
      ),
      queryOne(
        `SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total
         FROM reviews WHERE food_id = ? AND is_approved = 1`,
        [foodId],
      ),
    ]);

    res.json({
      success: true,
      data: {
        reviews: rows.map(mapReview),
        averageRating: summary.avg_rating ? Number(summary.avg_rating) : 0,
        totalReviews: Number(summary.total),
      },
      meta: paginationMeta(totalRow.total, page, limit),
    });
  }),
);

publicRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT c.*, (SELECT COUNT(*) FROM foods f WHERE f.category_id = c.id AND f.is_available = 1) AS food_count
       FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order ASC, c.name ASC`,
    );
    res.json({ success: true, data: rows.map(mapCategory) });
  }),
);

publicRouter.get(
  '/banners',
  asyncHandler(async (_req, res) => {
    const rows = await query(
      'SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 8',
    );
    res.json({ success: true, data: rows.map(mapBanner) });
  }),
);

publicRouter.get(
  '/coupons',
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT * FROM coupons
       WHERE is_active = 1
         AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
         AND (expires_at IS NULL OR expires_at >= UTC_TIMESTAMP())
         AND (usage_limit IS NULL OR used_count < usage_limit)
       ORDER BY min_order_value ASC, id ASC`,
    );
    res.json({ success: true, data: rows.map(mapCoupon) });
  }),
);

publicRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await getSettings() });
  }),
);

publicRouter.get('/stats', asyncHandler(async (_req, res) => {
  const [restaurants, foods, orders, customers] = await Promise.all([
    queryOne('SELECT COUNT(*) AS total FROM restaurants WHERE is_active = 1'),
    queryOne('SELECT COUNT(*) AS total FROM foods WHERE is_available = 1'),
    queryOne("SELECT COUNT(*) AS total FROM orders WHERE status = 'DELIVERED'"),
    queryOne("SELECT COUNT(*) AS total FROM users WHERE role = 'CUSTOMER'"),
  ]);
  res.json({
    success: true,
    data: {
      restaurants: Number(restaurants.total),
      dishes: Number(foods.total),
      ordersDelivered: Number(orders.total),
      happyCustomers: Number(customers.total),
    },
  });
}));
