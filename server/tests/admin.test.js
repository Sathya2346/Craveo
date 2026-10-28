import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { advanceStatus, call, closePool, placeOrder, request, seedWorld } from './helpers.js';

let world;

before(async () => {
  world = await seedWorld();
});

after(async () => {
  await closePool();
});

test('admin routes are closed to customers and open to staff', async () => {
  const asCustomer = await call('get', '/api/admin/stats', { token: world.tokens.customer });
  assert.equal(asCustomer.status, 403);

  const asAnonymous = await call('get', '/api/admin/stats');
  assert.equal(asAnonymous.status, 401);

  const asManager = await call('get', '/api/admin/stats', { token: world.tokens.manager });
  assert.equal(asManager.status, 200);
});

test('dashboard stats expose the expected shape for any range', async () => {
  const response = await call('get', '/api/admin/stats?days=14', { token: world.tokens.admin });
  assert.equal(response.status, 200);
  const { cards, inventory, revenueSeries, statusBreakdown, recentOrders } = response.body.data;

  assert.equal(revenueSeries.length, 14);
  assert.ok(revenueSeries.every((entry) => 'date' in entry && 'revenue' in entry && 'orders' in entry));
  assert.ok('revenue' in cards && 'ordersDelta' in cards && 'avgOrderValue' in cards);
  assert.ok(Number.isFinite(inventory.foods));
  assert.ok(Array.isArray(statusBreakdown));
  assert.ok(Array.isArray(recentOrders));

  const invalidRange = await call('get', '/api/admin/stats?days=0', { token: world.tokens.admin });
  assert.equal(invalidRange.status, 400);
});

test('revenue only counts delivered orders', async () => {
  const before = await call('get', '/api/admin/stats?days=30', { token: world.tokens.admin });
  const startingRevenue = before.body.data.cards.revenue;

  const placed = await placeOrder(world);
  const stillPending = await call('get', '/api/admin/stats?days=30', { token: world.tokens.admin });
  assert.equal(stillPending.body.data.cards.revenue, startingRevenue);

  await advanceStatus(world, placed.body.data.id, ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']);
  const afterDelivery = await call('get', '/api/admin/stats?days=30', { token: world.tokens.admin });
  assert.equal(afterDelivery.body.data.cards.revenue, startingRevenue + 292.5);
});

test('admins cannot change their own role or deactivate themselves', async () => {
  const demoteSelf = await call('patch', `/api/admin/users/${world.userIds.admin}`, {
    token: world.tokens.admin,
    body: { role: 'MANAGER' },
  });
  assert.equal(demoteSelf.status, 403);

  const deactivateSelf = await call('patch', `/api/admin/users/${world.userIds.admin}`, {
    token: world.tokens.admin,
    body: { isActive: false },
  });
  assert.equal(deactivateSelf.status, 403);

  const deleteSelf = await call('delete', `/api/admin/users/${world.userIds.admin}`, {
    token: world.tokens.admin,
  });
  assert.equal(deleteSelf.status, 403);
});

test('managers cannot manage users, settings or delete orders', async () => {
  const patchUser = await call('patch', `/api/admin/users/${world.userIds.customer}`, {
    token: world.tokens.manager,
    body: { role: 'ADMIN' },
  });
  assert.equal(patchUser.status, 403);

  const createUser = await call('post', '/api/admin/users', {
    token: world.tokens.manager,
    body: { name: 'Nope', email: 'nope@test.dev', password: 'secret123', role: 'ADMIN' },
  });
  assert.equal(createUser.status, 403);

  const settings = await call('put', '/api/admin/settings', {
    token: world.tokens.manager,
    body: { values: { site_name: 'Hacked' } },
  });
  assert.equal(settings.status, 403);
});

test('admin can create staff accounts that can sign in', async () => {
  const created = await call('post', '/api/admin/users', {
    token: world.tokens.admin,
    body: { name: 'New Manager', email: 'new.manager@test.dev', password: 'Manager@456', role: 'MANAGER' },
  });
  assert.equal(created.status, 201);

  const login = await call('post', '/api/auth/login', {
    body: { email: 'new.manager@test.dev', password: 'Manager@456' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'MANAGER');

  const duplicate = await call('post', '/api/admin/users', {
    token: world.tokens.admin,
    body: { name: 'Copy', email: 'new.manager@test.dev', password: 'Manager@456', role: 'MANAGER' },
  });
  assert.equal(duplicate.status, 409);
});

test('users with order history cannot be deleted, but can be deactivated', async () => {
  await placeOrder(world);

  const blocked = await call('delete', `/api/admin/users/${world.userIds.customer}`, {
    token: world.tokens.admin,
  });
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error.message, /deactivate/i);

  const deactivated = await call('patch', `/api/admin/users/${world.userIds.customer}`, {
    token: world.tokens.admin,
    body: { isActive: false },
  });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.data.isActive, false);

  const login = await call('post', '/api/auth/login', {
    body: { email: 'customer@test.dev', password: 'Customer@123' },
  });
  assert.equal(login.status, 401);

  // restore for later tests
  await call('patch', `/api/admin/users/${world.userIds.customer}`, {
    token: world.tokens.admin,
    body: { isActive: true },
  });
});

test('settings reject unknown keys and expose updates publicly', async () => {
  const unknown = await call('put', '/api/admin/settings', {
    token: world.tokens.admin,
    body: { values: { not_a_real_key: 'x' } },
  });
  assert.equal(unknown.status, 400);

  const updated = await call('put', '/api/admin/settings', {
    token: world.tokens.admin,
    body: { values: { site_name: 'Craveo Test', tax_percent: '8', free_delivery_above: '1000' } },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.site_name, 'Craveo Test');

  const publicSettings = await call('get', '/api/settings');
  assert.equal(publicSettings.status, 200);
  assert.equal(publicSettings.body.data.site_name, 'Craveo Test');

  const reset = await call('post', '/api/admin/settings/reset', { token: world.tokens.admin });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.data.site_name, 'Craveo');
});

test('order listing filters and payment guards', async () => {
  const placed = await placeOrder(world);
  const orderId = placed.body.data.id;

  const pending = await call('get', '/api/admin/orders?status=PENDING&limit=50', { token: world.tokens.manager });
  assert.equal(pending.status, 200);
  assert.ok(pending.body.data.some((order) => order.id === orderId));
  assert.ok(pending.body.summary.statusCounts.PENDING >= 1);

  const paid = await call('patch', `/api/admin/orders/${orderId}/payment`, {
    token: world.tokens.admin,
    body: { paymentStatus: 'PAID' },
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.data.paymentStatus, 'PAID');

  const notCancelled = await call('delete', `/api/admin/orders/${orderId}`, { token: world.tokens.admin });
  assert.equal(notCancelled.status, 409);

  await call('patch', `/api/admin/orders/${orderId}/status`, {
    token: world.tokens.admin,
    body: { status: 'CANCELLED', reason: 'test cleanup' },
  });

  const paidCancelled = await call('patch', `/api/admin/orders/${orderId}/payment`, {
    token: world.tokens.admin,
    body: { paymentStatus: 'PAID' },
  });
  assert.equal(paidCancelled.status, 409);

  const managerDelete = await call('delete', `/api/admin/orders/${orderId}`, { token: world.tokens.manager });
  assert.equal(managerDelete.status, 403);

  const adminDelete = await call('delete', `/api/admin/orders/${orderId}`, { token: world.tokens.admin });
  assert.equal(adminDelete.status, 200);
});

test('image uploads require auth and only accept images', async () => {
  const anonymous = await request()
    .post('/api/uploads/image')
    .attach('image', Buffer.from('fake'), { filename: 'a.png', contentType: 'image/png' });
  assert.equal(anonymous.status, 401);

  const textFile = await request()
    .post('/api/uploads/image')
    .set('Authorization', `Bearer ${world.tokens.admin}`)
    .attach('image', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
  assert.equal(textFile.status, 400);
  assert.equal(textFile.body.error.code, 'INVALID_FILE_TYPE');

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const valid = await request()
    .post('/api/uploads/image')
    .set('Authorization', `Bearer ${world.tokens.customer}`)
    .attach('image', png, { filename: 'avatar.png', contentType: 'image/png' });
  assert.equal(valid.status, 201);
  assert.match(valid.body.data.url, /^\/uploads\/.+\.png$/);

  const missing = await request()
    .post('/api/uploads/image')
    .set('Authorization', `Bearer ${world.tokens.admin}`);
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'NO_FILE');
});
