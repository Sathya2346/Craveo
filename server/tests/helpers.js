import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { closePool, execute, query, queryOne } from '../src/config/db.js';
import { migrate } from '../src/db/migrate.js';
import { DEFAULT_SETTINGS } from '../src/services/settings.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { signToken } from '../src/utils/jwt.js';
import { slugify } from '../src/utils/helpers.js';

export const app = createApp();
export const request = () => supertest(app);

export const call = (method, path, { token, body } = {}) => {
  const req = request()[method](path);
  if (token) req.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) req.send(body);
  return req;
};

export const passwords = {
  admin: 'Admin@123',
  manager: 'Manager@123',
  customer: 'Customer@123',
};

const hash = (password) => bcrypt.hash(password, 4);

const mkUser = async ({ name, email, role = 'CUSTOMER', isActive = 1, password = passwords.customer }) => {
  const result = await execute(
    'INSERT INTO users (name, email, phone, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, '+91 98400 00000', await hash(password), role, isActive],
  );
  return result.insertId;
};

const mkRestaurant = async ({ name, cuisine = 'Biryani', minOrder = 199, fee = 30, isOpen = 1, isActive = 1, postalCode = '600001' }) => {
  const result = await execute(
    `INSERT INTO restaurants (name, slug, cuisine, city, address, min_order, delivery_fee, delivery_time, rating,
       price_for_two, is_open, is_active, is_featured)
     VALUES (?, ?, ?, 'Chennai', 'Test street', ?, ?, 30, 4.5, 400, ?, ?, 0)`,
    [name, slugify(name), cuisine, minOrder, fee, isOpen, isActive, postalCode],
  );
  return result.insertId;
};

const mkCategory = async (name) => {
  const result = await execute('INSERT INTO categories (name, slug, is_active) VALUES (?, ?, 1)', [
    name,
    slugify(name),
  ]);
  return result.insertId;
};

const mkFood = async ({
  restaurantId,
  categoryId,
  name,
  price,
  discount = null,
  stock = 50,
  isAvailable = 1,
  isFeatured = 0,
}) => {
  const result = await execute(
    `INSERT INTO foods (restaurant_id, category_id, name, description, price, discount_price, stock, is_available,
       is_featured, food_type, prep_time)
     VALUES (?, ?, ?, 'Test dish', ?, ?, ?, ?, ?, 'VEG', 20)`,
    [restaurantId, categoryId, name, price, discount, stock, isAvailable, isFeatured],
  );
  return result.insertId;
};

const mkCoupon = async ({
  code,
  type = 'PERCENT',
  value,
  min = 0,
  max = null,
  usageLimit = null,
  perUser = 1,
  usedCount = 0,
  isActive = 1,
  expiresAt = null,
}) => {
  const result = await execute(
    `INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, usage_limit,
       per_user_limit, used_count, is_active, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, type, value, min, max, usageLimit, perUser, usedCount, isActive, expiresAt],
  );
  return result.insertId;
};

/** Rebuilds an isolated database with deterministic fixtures. */
export const seedWorld = async () => {
  await migrate({ fresh: true, quiet: true });

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await execute('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
  }

  const userIds = {
    admin: await mkUser({ name: 'Admin User', email: 'admin@test.dev', role: 'ADMIN', password: passwords.admin }),
    manager: await mkUser({ name: 'Manager User', email: 'manager@test.dev', role: 'MANAGER', password: passwords.manager }),
    customer: await mkUser({ name: 'Customer One', email: 'customer@test.dev' }),
    other: await mkUser({ name: 'Customer Two', email: 'other@test.dev' }),
    inactive: await mkUser({ name: 'Inactive User', email: 'inactive@test.dev', isActive: 0 }),
  };

  const categoryIds = {
    biryani: await mkCategory('Biryani'),
    pizza: await mkCategory('Pizza'),
  };

  const restaurantIds = {
    main: await mkRestaurant({ name: 'Test Biryani House' }),
    second: await mkRestaurant({ name: 'Test Pizza Place', cuisine: 'Pizza', minOrder: 99 }),
    closed: await mkRestaurant({ name: 'Closed Kitchen', isOpen: 0 }),
    inactive: await mkRestaurant({ name: 'Hidden Kitchen', isActive: 0 }),
  };

  const foodIds = {
    biryani: await mkFood({
      restaurantId: restaurantIds.main,
      categoryId: categoryIds.biryani,
      name: 'Chicken Biryani',
      price: 300,
      discount: 250,
      stock: 5,
      isFeatured: 1,
    }),
    paneer: await mkFood({
      restaurantId: restaurantIds.main,
      categoryId: categoryIds.biryani,
      name: 'Paneer Tikka',
      price: 200,
      stock: 50,
    }),
    lowStock: await mkFood({
      restaurantId: restaurantIds.main,
      categoryId: categoryIds.biryani,
      name: 'Limited Kebab',
      price: 100,
      stock: 2,
    }),
    unavailable: await mkFood({
      restaurantId: restaurantIds.main,
      categoryId: categoryIds.biryani,
      name: 'Sold Out Dish',
      price: 150,
      stock: 10,
      isAvailable: 0,
    }),
    pizza: await mkFood({
      restaurantId: restaurantIds.second,
      categoryId: categoryIds.pizza,
      name: 'Margherita',
      price: 500,
      stock: 20,
    }),
    closedFood: await mkFood({
      restaurantId: restaurantIds.closed,
      categoryId: categoryIds.biryani,
      name: 'Closed Kitchen Dish',
      price: 100,
      stock: 20,
    }),
    hiddenFood: await mkFood({
      restaurantId: restaurantIds.inactive,
      categoryId: categoryIds.biryani,
      name: 'Hidden Dish',
      price: 100,
      stock: 20,
    }),
  };

  const couponIds = {
    save10: await mkCoupon({ code: 'SAVE10', value: 10 }),
    flat50: await mkCoupon({ code: 'FLAT50', type: 'FLAT', value: 50, min: 300 }),
    cap100: await mkCoupon({ code: 'CAP100', value: 50, max: 100 }),
    expired: await mkCoupon({ code: 'EXPIRED', value: 10, expiresAt: new Date(Date.now() - 86_400_000) }),
    once: await mkCoupon({ code: 'ONCE', value: 10, perUser: 1 }),
    exhausted: await mkCoupon({ code: 'LIMITED', value: 10, usageLimit: 1, usedCount: 1 }),
    inactive: await mkCoupon({ code: 'INACTIVE', value: 10, isActive: 0 }),
  };

  const addressInsert = await execute(
    `INSERT INTO addresses (user_id, label, contact_name, phone, line1, city, pincode, is_default)
     VALUES (?, 'Home', 'Customer One', '+91 98400 00000', '1 Test Street', 'Chennai', '600001', 1)`,
    [userIds.customer],
  );

  const tokens = {
    admin: signToken({ id: userIds.admin, role: 'ADMIN' }),
    manager: signToken({ id: userIds.manager, role: 'MANAGER' }),
    customer: signToken({ id: userIds.customer, role: 'CUSTOMER' }),
    other: signToken({ id: userIds.other, role: 'CUSTOMER' }),
    inactive: signToken({ id: userIds.inactive, role: 'CUSTOMER' }),
  };

  resetRateLimits();

  return {
    userIds,
    categoryIds,
    restaurantIds,
    foodIds,
    couponIds,
    addressId: addressInsert.insertId,
    tokens,
  };
};

/** Places an order straight through the API. */
export const placeOrder = (world, overrides = {}) =>
  call('post', '/api/orders', {
    token: overrides.token || world.tokens.customer,
    body: {
      items: [{ foodId: world.foodIds.biryani, quantity: 1 }],
      addressId: world.addressId,
      paymentMethod: 'COD',
      ...overrides.body,
    },
  });

export const advanceStatus = (world, orderId, statuses) => {
  let chain = Promise.resolve();
  for (const status of statuses) {
    chain = chain.then(() =>
      call('patch', `/api/admin/orders/${orderId}/status`, {
        token: world.tokens.admin,
        body: { status },
      }),
    );
  }
  return chain;
};

export const getOrderRow = (orderId) => queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);

export const getFoodRow = (foodId) => queryOne('SELECT * FROM foods WHERE id = ?', [foodId]);

export { closePool, execute, query, queryOne };
