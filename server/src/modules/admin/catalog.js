import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db.js';
import { requireStaff } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, badRequest, conflict, notFound } from '../../utils/ApiError.js';
import { paginate, paginationMeta, resolveSort, slugify, toMoney } from '../../utils/helpers.js';
import { mapCategory, mapFood, mapRestaurant } from '../mappers.js';

export const adminCatalogRouter = Router();
adminCatalogRouter.use(requireStaff);

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || value.startsWith('/') || /^https?:\/\//i.test(value), {
    message: 'Enter a valid image URL',
  })
  .optional()
  .or(z.literal('').transform(() => null));

const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
  search: z.string().trim().max(80).optional(),
});

const buildUpdate = (payload, columnMap) => {
  const data = {};
  for (const [key, column] of Object.entries(columnMap)) {
    if (payload[key] === undefined) continue;
    const value = payload[key];
    data[column] = typeof value === 'boolean' ? (value ? 1 : 0) : value === '' ? null : value;
  }
  return data;
};

const runUpdate = async (table, id, data, message) => {
  const columns = Object.keys(data);
  if (!columns.length) throw badRequest('Nothing to update');
  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  const values = columns.map((column) => data[column]);
  const result = await execute(`UPDATE ${table} SET ${assignments} WHERE id = ?`, [...values, id]);
  if (result.affectedRows === 0) throw notFound('Record not found');
  return message;
};

const uniqueSlug = async (table, base, id = null) => {
  const root = slugify(base) || 'item';
  let candidate = root;
  let counter = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const row = await queryOne(`SELECT id FROM ${table} WHERE slug = ? LIMIT 1`, [candidate]);
    if (!row || row.id === id) return candidate;
    candidate = `${root}-${counter}`;
    counter += 1;
    if (counter > 200) return `${root}-${Date.now().toString(36)}`;
  }
};

/* ------------------------------- restaurants ------------------------------- */

const restaurantBody = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  description: z.string().trim().max(500).optional().or(z.literal('').transform(() => null)),
  cuisine: z.string().trim().min(2).max(80).default('Multi cuisine'),
  address: z.string().trim().max(255).optional().or(z.literal('').transform(() => null)),
  city: z.string().trim().min(2).max(80).default('Chennai'),
  imageUrl,
  coverImageUrl: imageUrl,
  rating: z.coerce.number().min(0).max(5).optional(),
  deliveryTime: z.coerce.number().int().min(5).max(180).optional(),
  deliveryFee: z.coerce.number().min(0).max(2000).optional(),
  minOrder: z.coerce.number().min(0).max(100_000).optional(),
  priceForTwo: z.coerce.number().min(0).max(100_000).optional(),
  isOpen: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

const RESTAURANT_COLUMNS = {
  name: 'name',
  description: 'description',
  cuisine: 'cuisine',
  address: 'address',
  city: 'city',
  imageUrl: 'image_url',
  coverImageUrl: 'cover_image_url',
  rating: 'rating',
  deliveryTime: 'delivery_time',
  deliveryFee: 'delivery_fee',
  minOrder: 'min_order',
  priceForTwo: 'price_for_two',
  isOpen: 'is_open',
  isFeatured: 'is_featured',
  isActive: 'is_active',
  sortOrder: 'sort_order',
};

adminCatalogRouter.get(
  '/restaurants',
  validate({ query: pagination.extend({ status: z.enum(['all', 'active', 'inactive']).default('all') }) }),
  asyncHandler(async (req, res) => {
    const { page, limit, search, status } = req.data.query;
    const { offset } = paginate(page, limit);

    const where = ['1 = 1'];
    const params = [];
    if (search) {
      where.push('(r.name LIKE ? OR r.cuisine LIKE ? OR r.city LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (status === 'active') where.push('r.is_active = 1');
    if (status === 'inactive') where.push('r.is_active = 0');
    const whereSql = where.join(' AND ');

    const [rows, totalRow] = await Promise.all([
      query(
        `SELECT r.*, (SELECT COUNT(*) FROM foods f WHERE f.restaurant_id = r.id) AS food_count
         FROM restaurants r WHERE ${whereSql}
         ORDER BY r.sort_order ASC, r.id DESC LIMIT ? OFFSET ?`,
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

adminCatalogRouter.post(
  '/restaurants',
  validate({ body: restaurantBody }),
  asyncHandler(async (req, res) => {
    const data = buildUpdate(req.data.body, RESTAURANT_COLUMNS);
    const slug = await uniqueSlug('restaurants', data.name);
    const columns = [...Object.keys(data), 'slug'];
    const values = [...Object.values(data), slug];

    const result = await execute(
      `INSERT INTO restaurants (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values,
    );
    const row = await queryOne('SELECT * FROM restaurants WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: mapRestaurant(row), message: 'Restaurant added' });
  }),
);

adminCatalogRouter.patch(
  '/restaurants/:id',
  validate({ body: restaurantBody.partial() }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await queryOne('SELECT * FROM restaurants WHERE id = ?', [id]);
    if (!existing) throw notFound('Restaurant not found');

    const data = buildUpdate(req.data.body, RESTAURANT_COLUMNS);
    if (req.data.body.name && req.data.body.name !== existing.name) {
      data.slug = await uniqueSlug('restaurants', req.data.body.name, id);
    }
    await runUpdate('restaurants', id, data, 'Restaurant updated');

    const row = await queryOne('SELECT * FROM restaurants WHERE id = ?', [id]);
    res.json({ success: true, data: mapRestaurant(row), message: 'Restaurant updated' });
  }),
);

adminCatalogRouter.delete(
  '/restaurants/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await queryOne('SELECT id FROM restaurants WHERE id = ?', [id]);
    if (!existing) throw notFound('Restaurant not found');

    const orders = await queryOne('SELECT COUNT(*) AS total FROM orders WHERE restaurant_id = ?', [id]);
    if (Number(orders.total) > 0) {
      throw conflict(
        `This restaurant has ${orders.total} order(s). Deactivate it instead of deleting so order history stays intact.`,
      );
    }

    await execute('DELETE FROM restaurants WHERE id = ?', [id]);
    res.json({ success: true, message: 'Restaurant deleted' });
  }),
);

/* -------------------------------- categories ------------------------------- */

const categoryBody = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  description: z.string().trim().max(255).optional().or(z.literal('').transform(() => null)),
  imageUrl,
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

const CATEGORY_COLUMNS = {
  name: 'name',
  description: 'description',
  imageUrl: 'image_url',
  sortOrder: 'sort_order',
  isActive: 'is_active',
};

adminCatalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT c.*, (SELECT COUNT(*) FROM foods f WHERE f.category_id = c.id) AS food_count
       FROM categories c ORDER BY c.sort_order ASC, c.name ASC`,
    );
    res.json({ success: true, data: rows.map(mapCategory) });
  }),
);

adminCatalogRouter.post(
  '/categories',
  validate({ body: categoryBody }),
  asyncHandler(async (req, res) => {
    const data = buildUpdate(req.data.body, CATEGORY_COLUMNS);
    const slug = await uniqueSlug('categories', data.name);
    const columns = [...Object.keys(data), 'slug'];
    const values = [...Object.values(data), slug];

    const result = await execute(
      `INSERT INTO categories (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values,
    );
    const row = await queryOne('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: mapCategory(row), message: 'Category added' });
  }),
);

adminCatalogRouter.patch(
  '/categories/:id',
  validate({ body: categoryBody.partial() }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) throw notFound('Category not found');

    const data = buildUpdate(req.data.body, CATEGORY_COLUMNS);
    if (req.data.body.name && req.data.body.name !== existing.name) {
      data.slug = await uniqueSlug('categories', req.data.body.name, id);
    }
    await runUpdate('categories', id, data, 'Category updated');

    const row = await queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, data: mapCategory(row), message: 'Category updated' });
  }),
);

adminCatalogRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await queryOne('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existing) throw notFound('Category not found');

    const foods = await queryOne('SELECT COUNT(*) AS total FROM foods WHERE category_id = ?', [id]);
    if (Number(foods.total) > 0) {
      throw conflict(
        `${foods.total} dish(es) still use this category. Move them to another category first.`,
      );
    }

    await execute('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted' });
  }),
);

/* ----------------------------------- foods --------------------------------- */

const foodBase = z.object({
    restaurantId: z.coerce.number().int().positive(),
    categoryId: z.coerce.number().int().positive(),
    name: z.string().trim().min(2, 'Name is required').max(120),
    description: z.string().trim().max(500).optional().or(z.literal('').transform(() => null)),
    imageUrl,
    price: z.coerce.number().positive('Price must be greater than 0').max(100_000),
    discountPrice: z.coerce.number().min(0).max(100_000).nullable().optional(),
    foodType: z.enum(['VEG', 'NON_VEG', 'EGG']).default('VEG'),
    calories: z.coerce.number().int().min(0).max(10_000).nullable().optional(),
    prepTime: z.coerce.number().int().min(1).max(240).optional(),
    stock: z.coerce.number().int().min(0).max(100_000).optional(),
    isAvailable: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    tag: z.string().trim().max(40).optional().or(z.literal('').transform(() => null)),
  });

const foodBody = foodBase.superRefine((value, ctx) => {
    if (value.discountPrice !== undefined && value.discountPrice !== null) {
      if (value.discountPrice >= value.price) {
        ctx.addIssue({
          code: 'custom',
          path: ['discountPrice'],
          message: 'Discount price must be lower than the price',
        });
      }
    }
  });

const FOOD_COLUMNS = {
  restaurantId: 'restaurant_id',
  categoryId: 'category_id',
  name: 'name',
  description: 'description',
  imageUrl: 'image_url',
  price: 'price',
  discountPrice: 'discount_price',
  foodType: 'food_type',
  calories: 'calories',
  prepTime: 'prep_time',
  stock: 'stock',
  isAvailable: 'is_available',
  isFeatured: 'is_featured',
  tag: 'tag',
};

const assertReferences = async (data) => {
  if (data.restaurant_id !== undefined) {
    const restaurant = await queryOne('SELECT id FROM restaurants WHERE id = ?', [data.restaurant_id]);
    if (!restaurant) throw badRequest('Selected restaurant does not exist');
  }
  if (data.category_id !== undefined) {
    const category = await queryOne('SELECT id FROM categories WHERE id = ?', [data.category_id]);
    if (!category) throw badRequest('Selected category does not exist');
  }
};

adminCatalogRouter.get(
  '/foods',
  validate({
    query: pagination.extend({
      restaurantId: z.coerce.number().int().positive().optional(),
      categoryId: z.coerce.number().int().positive().optional(),
      availability: z.enum(['all', 'available', 'unavailable']).default('all'),
      lowStock: z.coerce.boolean().optional(),
      sort: z.enum(['newest', 'name', 'price', 'stock']).default('newest'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.data.query;
    const { offset } = paginate(q.page, q.limit);

    const where = ['1 = 1'];
    const params = [];
    if (q.search) {
      where.push('(f.name LIKE ? OR f.description LIKE ?)');
      const like = `%${q.search}%`;
      params.push(like, like);
    }
    if (q.restaurantId) {
      where.push('f.restaurant_id = ?');
      params.push(q.restaurantId);
    }
    if (q.categoryId) {
      where.push('f.category_id = ?');
      params.push(q.categoryId);
    }
    if (q.availability !== 'all') {
      where.push('f.is_available = ?');
      params.push(q.availability === 'available' ? 1 : 0);
    }
    if (q.lowStock) where.push('f.stock <= 10');
    const whereSql = where.join(' AND ');

    const orderBy = resolveSort(
      q.sort,
      {
        newest: 'f.created_at DESC',
        name: 'f.name ASC',
        price: 'f.price DESC',
        stock: 'f.stock ASC',
      },
      'f.created_at DESC',
    );

    const [rows, totalRow, lowStock] = await Promise.all([
      query(
        `SELECT f.*, r.name AS restaurant_name, c.name AS category_name
         FROM foods f
         JOIN restaurants r ON r.id = f.restaurant_id
         JOIN categories c ON c.id = f.category_id
         WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        [...params, q.limit, offset],
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM foods f
         JOIN restaurants r ON r.id = f.restaurant_id
         JOIN categories c ON c.id = f.category_id
         WHERE ${whereSql}`,
        params,
      ),
      queryOne('SELECT COUNT(*) AS total FROM foods WHERE stock <= 10'),
    ]);

    res.json({
      success: true,
      data: rows.map(mapFood),
      meta: paginationMeta(totalRow.total, q.page, q.limit),
      summary: { lowStock: Number(lowStock.total) },
    });
  }),
);

adminCatalogRouter.post(
  '/foods',
  validate({ body: foodBody }),
  asyncHandler(async (req, res) => {
    const data = buildUpdate(req.data.body, FOOD_COLUMNS);
    await assertReferences(data);
    if (data.price !== undefined) data.price = toMoney(data.price);
    if (data.discount_price) data.discount_price = toMoney(data.discount_price);

    const columns = Object.keys(data);
    const result = await execute(
      `INSERT INTO foods (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      Object.values(data),
    );
    const row = await queryOne(
      `SELECT f.*, r.name AS restaurant_name, c.name AS category_name
       FROM foods f JOIN restaurants r ON r.id = f.restaurant_id
       JOIN categories c ON c.id = f.category_id WHERE f.id = ?`,
      [result.insertId],
    );
    res.status(201).json({ success: true, data: mapFood(row), message: 'Dish added to the menu' });
  }),
);

adminCatalogRouter.patch(
  '/foods/:id',
  validate({ body: foodBase.partial() }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await queryOne('SELECT * FROM foods WHERE id = ?', [id]);
    if (!existing) throw notFound('Dish not found');

    const data = buildUpdate(req.data.body, FOOD_COLUMNS);
    await assertReferences(data);
    if (data.price !== undefined) data.price = toMoney(data.price);
    if (data.discount_price !== undefined && data.discount_price !== null) {
      data.discount_price = toMoney(data.discount_price);
    }

    const nextPrice = data.price ?? Number(existing.price);
    const nextDiscount =
      data.discount_price !== undefined ? data.discount_price : existing.discount_price;
    if (nextDiscount !== null && Number(nextDiscount) >= Number(nextPrice)) {
      throw badRequest('Discount price must be lower than the price', [
        { field: 'discountPrice', message: 'Must be lower than the price' },
      ]);
    }

    await runUpdate('foods', id, data, 'Dish updated');
    const row = await queryOne(
      `SELECT f.*, r.name AS restaurant_name, c.name AS category_name
       FROM foods f JOIN restaurants r ON r.id = f.restaurant_id
       JOIN categories c ON c.id = f.category_id WHERE f.id = ?`,
      [id],
    );
    res.json({ success: true, data: mapFood(row), message: 'Dish updated' });
  }),
);

adminCatalogRouter.delete(
  '/foods/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await queryOne('SELECT id FROM foods WHERE id = ?', [id]);
    if (!existing) throw notFound('Dish not found');

    const items = await queryOne('SELECT COUNT(*) AS total FROM order_items WHERE food_id = ?', [id]);
    if (Number(items.total) > 0) {
      throw conflict(
        `This dish appears in ${items.total} past order(s). Mark it unavailable instead of deleting it.`,
      );
    }

    await execute('DELETE FROM foods WHERE id = ?', [id]);
    res.json({ success: true, message: 'Dish deleted' });
  }),
);
