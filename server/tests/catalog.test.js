import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { call, closePool, request, seedWorld } from './helpers.js';

let world;

before(async () => {
  world = await seedWorld();
});

after(async () => {
  await closePool();
});

test('public food list hides dishes from inactive restaurants and unavailable dishes', async () => {
  const response = await call('get', '/api/foods?limit=60');
  assert.equal(response.status, 200);
  const names = response.body.data.map((food) => food.name);
  assert.ok(names.includes('Chicken Biryani'));
  assert.ok(!names.includes('Hidden Dish'), 'inactive restaurant dishes must be hidden');
  assert.ok(!names.includes('Sold Out Dish'), 'unavailable dishes must be hidden');
});

test('public food list clamps absurd pagination and rejects page zero', async () => {
  const clamped = await call('get', '/api/foods?limit=500');
  assert.equal(clamped.status, 200);
  assert.equal(clamped.body.meta.limit, 100, 'limit is clamped to the hard cap');

  const zeroPage = await call('get', '/api/foods?page=0');
  assert.equal(zeroPage.status, 400);
});

test('search input with SQL metacharacters is handled safely', async () => {
  const injection = encodeURIComponent("%' OR 1=1 --");
  const response = await call('get', `/api/foods?search=${injection}`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.data));
  assert.ok(response.body.data.length < 10, 'injection attempt must not return the whole table');
});

test('category, price and diet filters combine correctly', async () => {
  const vegUnder250 = await call('get', '/api/foods?foodType=VEG&maxPrice=250&limit=60');
  assert.equal(vegUnder250.status, 200);
  assert.ok(vegUnder250.body.data.every((food) => food.effectivePrice <= 250));

  const pizza = await call('get', '/api/foods?category=pizza');
  assert.equal(pizza.status, 200);
  assert.ok(pizza.body.data.every((food) => food.categoryName === 'Pizza'));

  const impossible = await call('get', '/api/foods?minPrice=9000&maxPrice=10');
  assert.equal(impossible.status, 200);
  assert.deepEqual(impossible.body.data, []);
});

test('restaurants list filters by cuisine and open status', async () => {
  const open = await call('get', '/api/restaurants?openOnly=true');
  assert.equal(open.status, 200);
  const names = open.body.data.map((restaurant) => restaurant.name);
  assert.ok(!names.includes('Closed Kitchen'));
  assert.ok(!names.includes('Hidden Kitchen'));

  const byCuisine = await call('get', '/api/restaurants?cuisine=Pizza');
  assert.equal(byCuisine.status, 200);
  assert.ok(byCuisine.body.data.every((restaurant) => restaurant.cuisine === 'Pizza'));
});

test('missing and malformed ids return 404 rather than crashing', async () => {
  assert.equal((await call('get', '/api/foods/999999')).status, 404);
  assert.equal((await call('get', '/api/foods/not-a-number')).status, 404);
  assert.equal((await call('get', '/api/restaurants/does-not-exist')).status, 404);
});

test('customers cannot write catalog data', async () => {
  const response = await call('post', '/api/admin/foods', {
    token: world.tokens.customer,
    body: { name: 'Hacked Dish' },
  });
  assert.equal(response.status, 403);
});

test('managers can create and update catalog data', async () => {
  const created = await call('post', '/api/admin/categories', {
    token: world.tokens.manager,
    body: { name: 'Desserts', description: 'Sweet things' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.slug, 'desserts');

  const duplicateName = await call('post', '/api/admin/categories', {
    token: world.tokens.manager,
    body: { name: 'Desserts' },
  });
  assert.equal(duplicateName.status, 201);
  assert.equal(duplicateName.body.data.slug, 'desserts-2', 'slugs must stay unique');

  const patched = await call('patch', `/api/admin/categories/${created.body.data.id}`, {
    token: world.tokens.manager,
    body: { name: 'Desserts & Cakes' },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.slug, 'desserts-cakes');
});

test('deleting a category that still has dishes is blocked', async () => {
  const response = await call('delete', `/api/admin/categories/${world.categoryIds.biryani}`, {
    token: world.tokens.admin,
  });
  assert.equal(response.status, 409);
  assert.match(response.body.error.message, /dish/i);
});

test('dish price validation rejects a discount at or above the price', async () => {
  const body = {
    restaurantId: world.restaurantIds.main,
    categoryId: world.categoryIds.biryani,
    name: 'Bad Discount Dish',
    price: 200,
    discountPrice: 250,
  };

  const created = await call('post', '/api/admin/foods', { token: world.tokens.admin, body });
  assert.equal(created.status, 400);
  assert.ok(created.body.error.details.some((detail) => detail.field === 'discountPrice'));

  const valid = await call('post', '/api/admin/foods', {
    token: world.tokens.admin,
    body: { ...body, discountPrice: 150 },
  });
  assert.equal(valid.status, 201);
  assert.equal(valid.body.data.effectivePrice, 150);
  assert.equal(valid.body.data.discountPercent, 25);

  const patchBad = await call('patch', `/api/admin/foods/${valid.body.data.id}`, {
    token: world.tokens.admin,
    body: { discountPrice: 500 },
  });
  assert.equal(patchBad.status, 400);

  const negativePrice = await call('post', '/api/admin/foods', {
    token: world.tokens.admin,
    body: { ...body, price: -50, discountPrice: null },
  });
  assert.equal(negativePrice.status, 400);
});

test('dish creation requires existing restaurant and category', async () => {
  const response = await call('post', '/api/admin/foods', {
    token: world.tokens.admin,
    body: {
      restaurantId: 99999,
      categoryId: world.categoryIds.biryani,
      name: 'Ghost Dish',
      price: 100,
    },
  });
  assert.equal(response.status, 400);
});

test('restaurant detail exposes menu categories with counts', async () => {
  const response = await call('get', '/api/restaurants/test-biryani-house');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.restaurant.name, 'Test Biryani House');
  assert.ok(response.body.data.menuCategories.length >= 1);
  assert.ok(response.body.data.menuCategories[0].foodCount >= 1);
});

test('food reviews endpoint is public and paginates', async () => {
  const response = await call('get', `/api/foods/${world.foodIds.biryani}/reviews?limit=2`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.data.reviews));
  assert.equal(response.body.data.totalReviews, 0);
});

test('unknown routes and invalid JSON bodies fail cleanly', async () => {
  const notFound = await call('get', '/api/does-not-exist');
  assert.equal(notFound.status, 404);

  const badJson = await request()
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email":');
  assert.equal(badJson.status, 400);

  const health = await call('get', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.data.database, 'up');
});
