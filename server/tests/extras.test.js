import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { advanceStatus, call, closePool, getFoodRow, placeOrder, queryOne, seedWorld } from './helpers.js';

let world;

before(async () => {
  world = await seedWorld();
});

after(async () => {
  await closePool();
});

const addressPayload = (index = 1) => ({
  label: 'Work',
  contactName: 'Customer One',
  phone: '+91 98400 11111',
  line1: `${index} Office Road`,
  city: 'Chennai',
  pincode: '600002',
});

test('new addresses can be made default and the previous default is cleared', async () => {
  const created = await call('post', '/api/addresses', {
    token: world.tokens.customer,
    body: { ...addressPayload(), isDefault: true },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.isDefault, true);

  const list = await call('get', '/api/addresses', { token: world.tokens.customer });
  const defaults = list.body.data.filter((address) => address.isDefault);
  assert.equal(defaults.length, 1, 'exactly one default address at a time');
  assert.equal(defaults[0].id, created.body.data.id);
});

test('addresses are scoped to their owner', async () => {
  const foreignPatch = await call('patch', `/api/addresses/${world.addressId}`, {
    token: world.tokens.other,
    body: { line1: 'Hijacked street' },
  });
  assert.equal(foreignPatch.status, 404);

  const foreignDelete = await call('delete', `/api/addresses/${world.addressId}`, {
    token: world.tokens.other,
  });
  assert.equal(foreignDelete.status, 404);
});

test('address validation rejects bad pincodes and phone numbers', async () => {
  const badPincode = await call('post', '/api/addresses', {
    token: world.tokens.customer,
    body: { ...addressPayload(2), pincode: 'abc' },
  });
  assert.equal(badPincode.status, 400);

  const badPhone = await call('post', '/api/addresses', {
    token: world.tokens.customer,
    body: { ...addressPayload(3), phone: 'x' },
  });
  assert.equal(badPhone.status, 400);
});

test('an account is capped at ten addresses', async () => {
  const existing = await call('get', '/api/addresses', { token: world.tokens.other });
  let count = existing.body.data.length;

  while (count < 10) {
    const response = await call('post', '/api/addresses', {
      token: world.tokens.other,
      body: addressPayload(count + 1),
    });
    assert.equal(response.status, 201);
    count += 1;
  }

  const eleventh = await call('post', '/api/addresses', {
    token: world.tokens.other,
    body: addressPayload(11),
  });
  assert.equal(eleventh.status, 400);
  assert.match(eleventh.body.error.message, /10 addresses/i);
});

test('deleting the default address promotes another one', async () => {
  const list = await call('get', '/api/addresses', { token: world.tokens.customer });
  const currentDefault = list.body.data.find((address) => address.isDefault);

  const removed = await call('delete', `/api/addresses/${currentDefault.id}`, {
    token: world.tokens.customer,
  });
  assert.equal(removed.status, 200);

  const after = await call('get', '/api/addresses', { token: world.tokens.customer });
  assert.equal(after.body.data.filter((address) => address.isDefault).length, 1);
});

test('favourites are idempotent and validated', async () => {
  const first = await call('post', '/api/favourites', {
    token: world.tokens.customer,
    body: { foodId: world.foodIds.biryani },
  });
  assert.equal(first.status, 201);

  const second = await call('post', '/api/favourites', {
    token: world.tokens.customer,
    body: { foodId: world.foodIds.biryani },
  });
  assert.equal(second.status, 201);

  const ids = await call('get', '/api/favourites/ids', { token: world.tokens.customer });
  assert.deepEqual(ids.body.data, [world.foodIds.biryani]);

  const missingFood = await call('post', '/api/favourites', {
    token: world.tokens.customer,
    body: { foodId: 999999 },
  });
  assert.equal(missingFood.status, 404);

  const removed = await call('delete', `/api/favourites/${world.foodIds.biryani}`, {
    token: world.tokens.customer,
  });
  assert.equal(removed.status, 200);

  const empty = await call('get', '/api/favourites/ids', { token: world.tokens.customer });
  assert.deepEqual(empty.body.data, []);
});

test('reviews require a delivered order that actually contains the dish', async () => {
  const placed = await placeOrder(world);
  const orderId = placed.body.data.id;

  const tooEarly = await call('post', '/api/reviews', {
    token: world.tokens.customer,
    body: { orderId, foodId: world.foodIds.biryani, rating: 5 },
  });
  assert.equal(tooEarly.status, 400);
  assert.match(tooEarly.body.error.message, /delivered/i);

  await advanceStatus(world, orderId, ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']);

  const wrongDish = await call('post', '/api/reviews', {
    token: world.tokens.customer,
    body: { orderId, foodId: world.foodIds.pizza, rating: 5 },
  });
  assert.equal(wrongDish.status, 400);

  const notMyOrder = await call('post', '/api/reviews', {
    token: world.tokens.other,
    body: { orderId, foodId: world.foodIds.biryani, rating: 5 },
  });
  assert.equal(notMyOrder.status, 404);

  const ok = await call('post', '/api/reviews', {
    token: world.tokens.customer,
    body: { orderId, foodId: world.foodIds.biryani, rating: 5, comment: 'Excellent biryani' },
  });
  assert.equal(ok.status, 201);

  const food = await getFoodRow(world.foodIds.biryani);
  assert.equal(Number(food.rating), 5);
  assert.equal(food.review_count, 1);

  const duplicate = await call('post', '/api/reviews', {
    token: world.tokens.customer,
    body: { orderId, foodId: world.foodIds.biryani, rating: 4 },
  });
  assert.equal(duplicate.status, 409);
});

test('invalid ratings are rejected', async () => {
  for (const rating of [0, 6, 'five']) {
    const response = await call('post', '/api/reviews', {
      token: world.tokens.customer,
      body: { orderId: 1, foodId: world.foodIds.biryani, rating },
    });
    assert.equal(response.status, 400, `rating ${rating} must be rejected`);
  }
});

test('hidden reviews stop counting towards the dish rating', async () => {
  const review = await queryOne(
    "SELECT r.id, r.food_id FROM reviews r ORDER BY r.id DESC LIMIT 1",
  );
  assert.ok(review, 'expected the review created above');

  const hidden = await call('patch', `/api/admin/reviews/${review.id}`, {
    token: world.tokens.admin,
    body: { isApproved: false },
  });
  assert.equal(hidden.status, 200);

  const food = await getFoodRow(review.food_id);
  assert.equal(Number(food.rating), 0);
  assert.equal(food.review_count, 0);

  const publicReviews = await call('get', `/api/foods/${review.food_id}/reviews`);
  assert.equal(publicReviews.body.data.totalReviews, 0);

  const myReviews = await call('get', '/api/reviews/mine', { token: world.tokens.customer });
  assert.ok(myReviews.body.data.some((entry) => entry.id === review.id));
  assert.equal(myReviews.body.data.find((entry) => entry.id === review.id).isApproved, false);
});

test('customers can delete only their own reviews', async () => {
  const review = await queryOne("SELECT id, food_id FROM reviews WHERE comment = 'Excellent biryani'");

  const foreign = await call('delete', `/api/reviews/${review.id}`, { token: world.tokens.other });
  assert.equal(foreign.status, 404);

  const own = await call('delete', `/api/reviews/${review.id}`, { token: world.tokens.customer });
  assert.equal(own.status, 200);

  const food = await getFoodRow(review.food_id);
  assert.equal(food.review_count, 0);
});

test('review listing is paginated for the admin panel', async () => {
  const response = await call('get', '/api/admin/reviews?page=1&limit=5', { token: world.tokens.manager });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.data));
  assert.ok(response.body.meta.totalPages >= 1);
});

test('order review flags flip once every dish is reviewed', async () => {
  const placed = await placeOrder(world);
  const orderId = placed.body.data.id;
  await advanceStatus(world, orderId, ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']);

  const beforeReview = await call('get', `/api/orders/${orderId}`, { token: world.tokens.customer });
  assert.equal(beforeReview.body.data.canReview, true);
  assert.equal(beforeReview.body.data.hasReview, false);

  await call('post', '/api/reviews', {
    token: world.tokens.customer,
    body: { orderId, foodId: world.foodIds.biryani, rating: 4, comment: 'Good' },
  });

  const afterReview = await call('get', `/api/orders/${orderId}`, { token: world.tokens.customer });
  assert.equal(afterReview.body.data.canReview, false);
  assert.equal(afterReview.body.data.hasReview, true);
});
