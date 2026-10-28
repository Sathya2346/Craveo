import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import {
  advanceStatus,
  call,
  closePool,
  getFoodRow,
  getOrderRow,
  placeOrder,
  queryOne,
  seedWorld,
} from './helpers.js';

let world;

beforeEach(async () => {
  world = await seedWorld();
});

after(async () => {
  await closePool();
});

const biryani = () => world.foodIds.biryani;
const paneer = () => world.foodIds.paneer;

test('order totals are computed server-side and client prices are ignored', async () => {
  const response = await placeOrder(world, {
    body: {
      items: [{ foodId: biryani(), quantity: 1, price: 1, unitPrice: 1 }],
      subtotal: 1,
      total: 1,
      discount: 999,
    },
  });

  assert.equal(response.status, 201);
  const order = response.body.data;
  assert.equal(order.subtotal, 250, 'discounted dish price is authoritative');
  assert.equal(order.deliveryFee, 30);
  assert.equal(order.tax, 12.5);
  assert.equal(order.total, 292.5);
  assert.match(order.orderNumber, /^CRV-[A-Z0-9]+$/);
});

test('orders below the restaurant minimum are rejected', async () => {
  const response = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: world.foodIds.lowStock, quantity: 1 }], addressId: world.addressId },
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /minimum/i);
});

test('an order cannot mix dishes from two restaurants', async () => {
  const response = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: {
      items: [
        { foodId: biryani(), quantity: 1 },
        { foodId: world.foodIds.pizza, quantity: 1 },
      ],
      addressId: world.addressId,
    },
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /one restaurant/i);
});

test('closed, inactive and unavailable items are refused', async () => {
  const closed = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: world.foodIds.closedFood, quantity: 1 }], addressId: world.addressId },
  });
  assert.equal(closed.status, 409);

  const inactive = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: world.foodIds.hiddenFood, quantity: 1 }], addressId: world.addressId },
  });
  assert.equal(inactive.status, 409);

  const unavailable = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: world.foodIds.unavailable, quantity: 1 }], addressId: world.addressId },
  });
  assert.equal(unavailable.status, 409);
});

test('stock is enforced and reported per dish', async () => {
  const response = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: biryani(), quantity: 6 }], addressId: world.addressId },
  });
  assert.equal(response.status, 409);
  assert.ok(response.body.error.details.some((detail) => detail.foodId === biryani()));

  const stock = await getFoodRow(biryani());
  assert.equal(stock.stock, 5, 'a failed order must not consume stock');
});

test('quantity bounds and cart size limits are validated', async () => {
  const zero = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: biryani(), quantity: 0 }], addressId: world.addressId },
  });
  assert.equal(zero.status, 400);

  const tooMany = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: biryani(), quantity: 21 }], addressId: world.addressId },
  });
  assert.equal(tooMany.status, 400);

  const bulk = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: {
      items: [
        { foodId: biryani(), quantity: 20 },
        { foodId: paneer(), quantity: 20 },
        { foodId: world.foodIds.lowStock, quantity: 20 },
      ],
      addressId: world.addressId,
    },
  });
  assert.equal(bulk.status, 400);
  assert.match(bulk.body.error.message, /50 items/i);

  const empty = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [], addressId: world.addressId },
  });
  assert.equal(empty.status, 400);
});

test('delivery details are required when no saved address is used', async () => {
  const response = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: biryani(), quantity: 1 }] },
  });
  assert.equal(response.status, 400);
  assert.ok(response.body.error.details.some((detail) => detail.field === 'line1'));

  const someoneElsesAddress = await call('post', '/api/orders', {
    token: world.tokens.other,
    body: { items: [{ foodId: biryani(), quantity: 1 }], addressId: world.addressId },
  });
  assert.equal(someoneElsesAddress.status, 404);
});

test('invalid, expired, exhausted and inactive coupons are rejected', async () => {
  const codes = [
    { code: 'NOPE', body: { addressId: world.addressId } },
    { code: 'EXPIRED', body: { addressId: world.addressId } },
    { code: 'LIMITED', body: { addressId: world.addressId } },
    { code: 'INACTIVE', body: { addressId: world.addressId } },
  ];

  for (const entry of codes) {
    const response = await call('post', '/api/orders', {
      token: world.tokens.customer,
      body: {
        items: [{ foodId: biryani(), quantity: 1 }],
        couponCode: entry.code,
        addressId: world.addressId,
      },
    });
    assert.equal(response.status, 400, `${entry.code} should be rejected`);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('coupon minimum order, percentage cap and usage accounting work', async () => {
  const belowMinimum = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: {
      items: [{ foodId: biryani(), quantity: 1 }],
      couponCode: 'FLAT50',
      addressId: world.addressId,
    },
  });
  assert.equal(belowMinimum.status, 400);
  assert.match(belowMinimum.body.error.message, /minimum/i);

  const capped = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: {
      items: [{ foodId: biryani(), quantity: 2 }],
      couponCode: 'CAP100',
      addressId: world.addressId,
    },
  });
  assert.equal(capped.status, 201);
  assert.equal(capped.body.data.subtotal, 500);
  assert.equal(capped.body.data.discount, 100, '50% of 500 capped at 100');
  assert.equal(capped.body.data.deliveryFee, 0, 'free delivery above 499');
  assert.equal(capped.body.data.tax, 20);
  assert.equal(capped.body.data.total, 420);

  const couponRow = await queryOne('SELECT used_count FROM coupons WHERE id = ?', [world.couponIds.cap100]);
  assert.equal(couponRow.used_count, 1);
});

test('per-customer coupon usage limits apply across orders', async () => {
  const first = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: {
      items: [{ foodId: biryani(), quantity: 1 }],
      couponCode: 'ONCE',
      addressId: world.addressId,
    },
  });
  assert.equal(first.status, 201);

  const second = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: {
      items: [{ foodId: biryani(), quantity: 1 }],
      couponCode: 'ONCE',
      addressId: world.addressId,
    },
  });
  assert.equal(second.status, 400);
  assert.match(second.body.error.message, /already used/i);

  const otherCustomer = await call('post', '/api/orders', {
    token: world.tokens.other,
    body: {
      items: [{ foodId: biryani(), quantity: 1 }],
      couponCode: 'ONCE',
      addressId: world.addressId,
    },
  });
  assert.equal(otherCustomer.status, 404, 'address ownership is enforced');
});

test('payment method decides the initial payment status', async () => {
  const cod = await placeOrder(world);
  assert.equal(cod.body.data.paymentStatus, 'PENDING');

  const upi = await call('post', '/api/orders', {
    token: world.tokens.other,
    body: {
      items: [{ foodId: biryani(), quantity: 1 }],
      contactName: 'Customer Two',
      contactPhone: '+91 98400 00000',
      line1: '9 Other Street',
      city: 'Chennai',
      pincode: '600002',
      paymentMethod: 'UPI',
    },
  });
  assert.equal(upi.status, 201);
  assert.equal(upi.body.data.paymentStatus, 'PAID');
});

test('stock and coupon counters move when an order is placed', async () => {
  const response = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: {
      items: [{ foodId: biryani(), quantity: 2 }],
      couponCode: 'SAVE10',
      addressId: world.addressId,
    },
  });

  assert.equal(response.status, 201);
  const stock = await getFoodRow(biryani());
  assert.equal(stock.stock, 3);

  const redemption = await queryOne(
    'SELECT COUNT(*) AS total FROM coupon_redemptions WHERE order_id = ?',
    [response.body.data.id],
  );
  assert.equal(Number(redemption.total), 1);
});

test('quotes are public and surface coupon problems without failing', async () => {
  const ok = await call('post', '/api/orders/quote', {
    body: { items: [{ foodId: biryani(), quantity: 1 }] },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.pricing.total, 292.5);

  const badCoupon = await call('post', '/api/orders/quote', {
    body: { items: [{ foodId: biryani(), quantity: 1 }], couponCode: 'NOTREAL' },
  });
  assert.equal(badCoupon.status, 200);
  assert.equal(badCoupon.body.data.coupon, null);
  assert.match(badCoupon.body.data.couponError, /not valid/i);
});

test('customers only see their own orders', async () => {
  const placed = await placeOrder(world);
  const orderId = placed.body.data.id;

  const own = await call('get', `/api/orders/${orderId}`, { token: world.tokens.customer });
  assert.equal(own.status, 200);

  const other = await call('get', `/api/orders/${orderId}`, { token: world.tokens.other });
  assert.equal(other.status, 404);

  const list = await call('get', '/api/orders', { token: world.tokens.other });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data, []);
});

test('cancelling a pending order restores stock, coupon usage and payment', async () => {
  const placed = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: {
      items: [{ foodId: biryani(), quantity: 2 }],
      couponCode: 'SAVE10',
      addressId: world.addressId,
      paymentMethod: 'UPI',
    },
  });
  const orderId = placed.body.data.id;
  assert.equal((await getFoodRow(biryani())).stock, 3);

  const cancelled = await call('patch', `/api/orders/${orderId}/cancel`, {
    token: world.tokens.customer,
    body: { reason: 'Ordered by mistake' },
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'CANCELLED');
  assert.equal(cancelled.body.data.paymentStatus, 'REFUNDED');

  assert.equal((await getFoodRow(biryani())).stock, 5);
  const couponRow = await queryOne('SELECT used_count FROM coupons WHERE id = ?', [world.couponIds.save10]);
  assert.equal(couponRow.used_count, 0);

  const again = await call('patch', `/api/orders/${orderId}/cancel`, {
    token: world.tokens.customer,
    body: {},
  });
  assert.equal(again.status, 409);
});

test('orders already cooking cannot be cancelled by the customer', async () => {
  const placed = await placeOrder(world);
  const orderId = placed.body.data.id;

  await advanceStatus(world, orderId, ['CONFIRMED', 'PREPARING']);

  const cancelled = await call('patch', `/api/orders/${orderId}/cancel`, {
    token: world.tokens.customer,
    body: {},
  });
  assert.equal(cancelled.status, 409);
  assert.match(cancelled.body.error.message, /preparing/i);
});

test('admin status updates follow the allowed transition graph', async () => {
  const placed = await placeOrder(world);
  const orderId = placed.body.data.id;

  const skipped = await call('patch', `/api/admin/orders/${orderId}/status`, {
    token: world.tokens.admin,
    body: { status: 'DELIVERED' },
  });
  assert.equal(skipped.status, 409);

  await advanceStatus(world, orderId, ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']);
  const row = await getOrderRow(orderId);
  assert.equal(row.status, 'DELIVERED');
  assert.ok(row.delivered_at, 'delivered_at must be stamped');
  assert.equal(row.payment_status, 'PAID', 'COD becomes paid on delivery');

  const backwards = await call('patch', `/api/admin/orders/${orderId}/status`, {
    token: world.tokens.admin,
    body: { status: 'PREPARING' },
  });
  assert.equal(backwards.status, 409);
});

test('admin cancellation of an in-flight order restores stock', async () => {
  const placed = await call('post', '/api/orders', {
    token: world.tokens.customer,
    body: { items: [{ foodId: biryani(), quantity: 3 }], addressId: world.addressId },
  });
  const orderId = placed.body.data.id;
  await advanceStatus(world, orderId, ['CONFIRMED']);
  assert.equal((await getFoodRow(biryani())).stock, 2);

  const cancelled = await call('patch', `/api/admin/orders/${orderId}/status`, {
    token: world.tokens.admin,
    body: { status: 'CANCELLED', reason: 'Kitchen ran out of rice' },
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'CANCELLED');
  assert.equal((await getFoodRow(biryani())).stock, 5);
});

test('order listing filters by status and paginates', async () => {
  await placeOrder(world);
  await placeOrder(world);

  const pending = await call('get', '/api/orders?status=PENDING&limit=1', { token: world.tokens.customer });
  assert.equal(pending.status, 200);
  assert.equal(pending.body.data.length, 1);
  assert.equal(pending.body.meta.total, 2);
  assert.equal(pending.body.meta.totalPages, 2);

  const invalidStatus = await call('get', '/api/orders?status=TELEPORTED', { token: world.tokens.customer });
  assert.equal(invalidStatus.status, 400);
});
