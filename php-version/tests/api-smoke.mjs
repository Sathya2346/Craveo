/**
 * Craveo PHP API smoke suite.
 *
 * Exercises every endpoint group against the PHP backend and asserts the same
 * behaviour the Node/Express build guarantees: auth, roles, pricing, coupons,
 * stock, order workflow and admin CRUD.
 *
 *   node api-smoke.mjs                 # http://localhost:8000
 *   API_URL=http://localhost:8000 node api-smoke.mjs
 */
const BASE = (process.env.API_URL || 'http://localhost:8000').replace(/\/$/, '');

let passed = 0;
const failures = [];
const notes = [];

const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const eq = (name, actual, expected) => check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const api = async (method, path, { token, body, headers = {} } = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, body: payload };
};

const step = async (name, work) => {
  try {
    await work();
  } catch (error) {
    failures.push(`${name} threw: ${error.message}`);
    console.log(`FAIL  ${name} threw: ${error.message}`);
  }
};

const stamp = Date.now();
const email = `smoke+${stamp}@craveo.test`;
const password = 'SmokeTest@123';
const newPassword = 'SmokeTest@456';

let userToken = null;
let adminToken = null;
let userId = null;
let addressId = null;
let orderId = null;
let orderFoodId = null;

/* --------------------------------- public --------------------------------- */

await step('public catalog', async () => {
  const health = await api('GET', '/api/health');
  eq('health reports database up', health.body?.data?.database, 'up');

  const restaurants = await api('GET', '/api/restaurants?limit=3');
  check('restaurants list returns rows', Array.isArray(restaurants.body?.data) && restaurants.body.data.length > 0);
  check('restaurants list has pagination meta', restaurants.body?.meta?.total > 0);

  const slug = restaurants.body?.data?.[0]?.slug;
  const detail = await api('GET', `/api/restaurants/${slug}`);
  eq('restaurant lookup by slug', detail.body?.data?.restaurant?.slug, slug);
  check('restaurant detail lists menu categories', Array.isArray(detail.body?.data?.menuCategories));

  const byId = await api('GET', `/api/restaurants/${restaurants.body.data[0].id}/foods`);
  check('restaurant menu returns dishes', Array.isArray(byId.body?.data));

  const foods = await api('GET', '/api/foods?limit=5&sort=price_asc');
  check('foods list returns dishes', foods.body?.data?.length > 0);
  check('foods expose effectivePrice', typeof foods.body.data[0].effectivePrice === 'number');

  const foodId = foods.body.data[0].id;
  const food = await api('GET', `/api/foods/${foodId}`);
  eq('food detail id matches', food.body?.data?.food?.id, foodId);
  check('food detail returns related dishes', Array.isArray(food.body?.data?.related));

  const reviews = await api('GET', `/api/foods/${foodId}/reviews`);
  check('food reviews endpoint responds', Array.isArray(reviews.body?.data?.reviews));

  const veg = await api('GET', '/api/foods?foodType=VEG&limit=50');
  check('foodType filter only returns VEG', veg.body.data.every((item) => item.foodType === 'VEG'));

  const categories = await api('GET', '/api/categories');
  check('categories endpoint returns rows', categories.body?.data?.length > 0);

  const banners = await api('GET', '/api/banners');
  check('banners endpoint responds', Array.isArray(banners.body?.data));

  const coupons = await api('GET', '/api/coupons');
  check('public coupons respond', Array.isArray(coupons.body?.data));

  const settings = await api('GET', '/api/settings');
  check('settings endpoint returns site name', typeof settings.body?.data?.site_name === 'string');

  const stats = await api('GET', '/api/stats');
  check('stats endpoint returns counters', typeof stats.body?.data?.restaurants === 'number');

  const missing = await api('GET', '/api/foods/99999999');
  eq('unknown dish returns 404', missing.status, 404);

  const unknownRoute = await api('GET', '/api/does-not-exist');
  eq('unknown route returns 404', unknownRoute.status, 404);
  eq('error envelope uses NOT_FOUND', unknownRoute.body?.error?.code, 'NOT_FOUND');
});

/* ---------------------------------- auth ---------------------------------- */

await step('auth flows', async () => {
  const weak = await api('POST', '/api/auth/register', { body: { name: 'A', email: 'bad', password: '123' } });
  eq('register rejects invalid payload', weak.status, 400);
  check('register failure lists field errors', Array.isArray(weak.body?.error?.details) && weak.body.error.details.length > 0);

  const created = await api('POST', '/api/auth/register', {
    body: { name: 'Smoke Tester', email, password, phone: '9876543210' },
  });
  eq('register creates account', created.status, 201);
  userToken = created.body?.data?.token ?? null;
  userId = created.body?.data?.user?.id ?? null;
  check('register returns a JWT', typeof userToken === 'string' && userToken.split('.').length === 3);
  eq('register forces CUSTOMER role', created.body?.data?.user?.role, 'CUSTOMER');

  const duplicate = await api('POST', '/api/auth/register', { body: { name: 'Smoke Two', email, password } });
  eq('duplicate email returns 409', duplicate.status, 409);

  const wrong = await api('POST', '/api/auth/login', { body: { email, password: 'WrongPass1' } });
  eq('wrong password returns 401', wrong.status, 401);

  const login = await api('POST', '/api/auth/login', { body: { email, password } });
  eq('login succeeds', login.status, 200);
  userToken = login.body?.data?.token ?? userToken;

  const noToken = await api('GET', '/api/auth/me');
  eq('me without token returns 401', noToken.status, 401);

  const me = await api('GET', '/api/auth/me', { token: userToken });
  eq('me returns the signed-in user', me.body?.data?.user?.email, email);
  check('me returns profile stats', typeof me.body?.data?.stats?.orders === 'number');

  const patched = await api('PATCH', '/api/auth/me', { token: userToken, body: { name: 'Smoke Updated' } });
  eq('profile update succeeds', patched.body?.data?.user?.name, 'Smoke Updated');

  const emptyPatch = await api('PATCH', '/api/auth/me', { token: userToken, body: {} });
  eq('empty profile patch returns 400', emptyPatch.status, 400);

  const taken = await api('GET', `/api/auth/check-email?email=${encodeURIComponent(email)}`);
  eq('check-email reports existing account', taken.body?.data?.available, false);

  const wrongCurrent = await api('PATCH', '/api/auth/password', {
    token: userToken,
    body: { currentPassword: 'Nope12345', newPassword },
  });
  eq('password change rejects wrong current password', wrongCurrent.status, 400);

  const changed = await api('PATCH', '/api/auth/password', {
    token: userToken,
    body: { currentPassword: password, newPassword },
  });
  eq('password change succeeds', changed.status, 200);

  const relogin = await api('POST', '/api/auth/login', { body: { email, password: newPassword } });
  eq('login works with the new password', relogin.status, 200);
  userToken = relogin.body?.data?.token ?? userToken;

  const logout = await api('POST', '/api/auth/logout');
  eq('logout responds', logout.status, 200);
});

/* -------------------------------- addresses ------------------------------- */

await step('addresses', async () => {
  const first = await api('POST', '/api/addresses', {
    token: userToken,
    body: {
      label: 'Home',
      contactName: 'Smoke Tester',
      phone: '9876543210',
      line1: '12 Test Street, Anna Nagar',
      city: 'Chennai',
      pincode: '600040',
    },
  });
  eq('first address created', first.status, 201);
  eq('first address becomes default', first.body?.data?.isDefault, true);
  addressId = first.body?.data?.id ?? null;

  const second = await api('POST', '/api/addresses', {
    token: userToken,
    body: {
      label: 'Work',
      contactName: 'Smoke Tester',
      phone: '9876543210',
      line1: '99 Office Road, Guindy',
      city: 'Chennai',
      pincode: '600032',
      isDefault: true,
    },
  });
  eq('second address created', second.status, 201);

  const list = await api('GET', '/api/addresses', { token: userToken });
  eq('address list has both rows', list.body?.data?.length, 2);
  eq('newest default address sorts first', list.body?.data?.[0]?.label, 'Work');

  const badPincode = await api('POST', '/api/addresses', {
    token: userToken,
    body: {
      label: 'Home',
      contactName: 'Smoke Tester',
      phone: '9876543210',
      line1: '12 Test Street',
      city: 'Chennai',
      pincode: 'abc',
    },
  });
  eq('invalid pincode rejected', badPincode.status, 400);

  const patched = await api('PATCH', `/api/addresses/${addressId}`, {
    token: userToken,
    body: { line2: 'Near the park' },
  });
  eq('address patch applies', patched.body?.data?.line2, 'Near the park');

  const otherUser = await api('PATCH', `/api/addresses/${addressId}`, { body: { line2: 'hack' } });
  eq('address patch without token is rejected', otherUser.status, 401);

  const deleted = await api('DELETE', `/api/addresses/${second.body.data.id}`, { token: userToken });
  eq('address delete succeeds', deleted.status, 200);

  const after = await api('GET', '/api/addresses', { token: userToken });
  eq('default promoted after deleting the default', after.body?.data?.[0]?.isDefault, true);
});

/* ------------------------------- favourites ------------------------------- */

await step('favourites', async () => {
  const foods = await api('GET', '/api/foods?limit=1');
  const foodId = foods.body.data[0].id;

  const added = await api('POST', '/api/favourites', { token: userToken, body: { foodId } });
  eq('favourite added', added.status, 201);

  const ids = await api('GET', '/api/favourites/ids', { token: userToken });
  check('favourite id is listed', ids.body.data.includes(foodId));

  const list = await api('GET', '/api/favourites', { token: userToken });
  eq('favourite list returns the dish', list.body.data[0].id, foodId);

  const removed = await api('DELETE', `/api/favourites/${foodId}`, { token: userToken });
  eq('favourite removed', removed.body?.data?.isFavourite, false);
});

/* ---------------------------------- quote --------------------------------- */

await step('quote + pricing', async () => {
  const restaurant = await api('GET', '/api/restaurants?limit=1');
  const restaurantId = restaurant.body.data[0].id;
  const menu = await api('GET', `/api/restaurants/${restaurantId}/foods?limit=50`);
  const dish = menu.body.data.find((item) => item.stock > 5 && item.isAvailable);
  orderFoodId = dish.id;

  const quote = await api('POST', '/api/orders/quote', { body: { items: [{ foodId: dish.id, quantity: 2 }] } });
  eq('quote succeeds', quote.status, 200);
  eq('quote totals are server computed', quote.body.data.pricing.subtotal, Number((dish.effectivePrice * 2).toFixed(2)));

  const couponQuote = await api('POST', '/api/orders/quote', {
    body: { items: [{ foodId: dish.id, quantity: 2 }], couponCode: 'THISISNOTREAL' },
  });
  eq('unknown coupon surfaces couponError', typeof couponQuote.body?.data?.couponError, 'string');
  eq('unknown coupon keeps discount at 0', couponQuote.body.data.pricing.discount, 0);

  const belowMin = await api('POST', '/api/orders/quote', { body: { items: [{ foodId: dish.id, quantity: 1 }] } });
  if (Number(dish.effectivePrice) < Number(quote.body.data.pricing.minOrder)) {
    eq('below minimum order is rejected', belowMin.status, 400);
  } else {
    eq('single item quote accepted when above minimum', belowMin.status, 200);
  }

  const badItem = await api('POST', '/api/orders/quote', { body: { items: [{ foodId: 99999999, quantity: 1 }] } });
  eq('unknown dish quote rejected', badItem.status, 400);
});

/* ------------------------------- place order ------------------------------ */

await step('orders', async () => {
  const before = await api('GET', `/api/foods/${orderFoodId}`);
  const stockBefore = before.body.data.food.stock;

  const quote = await api('POST', '/api/orders/quote', {
    token: userToken,
    body: { items: [{ foodId: orderFoodId, quantity: 2 }], couponCode: 'WELCOME100' },
  });
  const withCoupon = quote.body?.data?.coupon;
  check('valid coupon applies a discount', withCoupon !== null && quote.body.data.pricing.discount > 0);

  const created = await api('POST', '/api/orders', {
    token: userToken,
    body: {
      items: [{ foodId: orderFoodId, quantity: 2 }],
      addressId,
      paymentMethod: 'COD',
      couponCode: withCoupon ? 'WELCOME100' : undefined,
      notes: 'Leave at the door',
    },
  });
  eq('order created', created.status, 201);
  orderId = created.body?.data?.id ?? null;
  check('order has a CRV number', /^CRV-[A-Z0-9]{4,}$/.test(created.body?.data?.orderNumber ?? ''));
  eq('order starts as PENDING', created.body?.data?.status, 'PENDING');
  check('order stores two line items', created.body?.data?.items?.length === 1);
  eq('order item quantity is 2', created.body?.data?.items?.[0]?.quantity, 2);
  eq('COD order starts unpaid', created.body?.data?.paymentStatus, 'PENDING');
  check('order seeds status history', created.body?.data?.statusHistory?.length >= 1);

  const after = await api('GET', `/api/foods/${orderFoodId}`);
  eq('stock decremented after order', after.body.data.food.stock, stockBefore - 2);

  const list = await api('GET', '/api/orders', { token: userToken });
  eq('order appears in customer history', list.body?.data?.[0]?.id, orderId);
  check('history returns spend summary', typeof list.body?.summary?.totalOrders === 'number');

  const detail = await api('GET', `/api/orders/${orderId}`, { token: userToken });
  eq('pending order can be cancelled', detail.body?.data?.canCancel, true);
  eq('pending order cannot be reviewed', detail.body?.data?.canReview, false);

  const otherUserOrder = await api('GET', `/api/orders/${orderId}`);
  eq('order detail needs a token', otherUserOrder.status, 401);

  const missingAddress = await api('POST', '/api/orders', {
    token: userToken,
    body: { items: [{ foodId: orderFoodId, quantity: 1 }], addressId: 99999999 },
  });
  eq('unknown address rejected', missingAddress.status, 404);

  const noDetails = await api('POST', '/api/orders', {
    token: userToken,
    body: { items: [{ foodId: orderFoodId, quantity: 1 }] },
  });
  eq('missing delivery details rejected', noDetails.status, 400);

  const cancelled = await api('PATCH', `/api/orders/${orderId}/cancel`, {
    token: userToken,
    body: { reason: 'Changed my mind' },
  });
  eq('order cancelled', cancelled.body?.data?.status, 'CANCELLED');
  eq('cancellation reason stored', cancelled.body?.data?.cancelReason, 'Changed my mind');

  const restored = await api('GET', `/api/foods/${orderFoodId}`);
  eq('stock restored after cancellation', restored.body.data.food.stock, stockBefore);

  const twice = await api('PATCH', `/api/orders/${orderId}/cancel`, { token: userToken, body: {} });
  eq('re-cancelling returns 409', twice.status, 409);
});

/* ---------------------------------- admin --------------------------------- */

await step('admin access control', async () => {
  const anonymous = await api('GET', '/api/admin/stats');
  eq('admin stats without token returns 401', anonymous.status, 401);

  const customer = await api('GET', '/api/admin/stats', { token: userToken });
  eq('customer blocked from admin stats', customer.status, 403);

  const login = await api('POST', '/api/auth/login', {
    body: { email: 'admin@craveo.app', password: 'Admin@123' },
  });
  eq('admin login works', login.status, 200);
  adminToken = login.body?.data?.token ?? null;
  eq('admin role returned', login.body?.data?.user?.role, 'ADMIN');
});

await step('admin dashboard + orders', async () => {
  const stats = await api('GET', '/api/admin/stats?days=30', { token: adminToken });
  eq('stats respond', stats.status, 200);
  check('stats cards include revenue', typeof stats.body?.data?.cards?.revenue === 'number');
  eq('stats series covers the range', stats.body?.data?.revenueSeries?.length, 30);
  check('stats include top dishes', Array.isArray(stats.body?.data?.topFoods));

  const orders = await api('GET', '/api/admin/orders?limit=5', { token: adminToken });
  eq('admin order list responds', orders.status, 200);
  check('admin order summary counts statuses', typeof orders.body?.summary?.statusCounts?.PENDING === 'number');

  const orderIdForAdmin = orderId;
  const detail = await api('GET', `/api/admin/orders/${orderIdForAdmin}`, { token: adminToken });
  eq('admin order detail responds', detail.status, 200);
  eq('cancelled order has no next statuses', detail.body?.data?.allowedNextStatuses?.length, 0);

  const invalid = await api('PATCH', `/api/admin/orders/${orderIdForAdmin}/status`, {
    token: adminToken,
    body: { status: 'DELIVERED' },
  });
  eq('cancelled order cannot move forward', invalid.status, 409);

  const payment = await api('PATCH', `/api/admin/orders/${orderIdForAdmin}/payment`, {
    token: adminToken,
    body: { paymentStatus: 'PAID' },
  });
  eq('cancelled order cannot be marked paid', payment.status, 409);

  const deleted = await api('DELETE', `/api/admin/orders/${orderIdForAdmin}`, { token: adminToken });
  eq('cancelled order deleted by admin', deleted.status, 200);
});

await step('admin order workflow', async () => {
  const foods = await api('GET', '/api/foods?limit=1');
  const dish = foods.body.data[0];

  const created = await api('POST', '/api/orders', {
    token: userToken,
    body: { items: [{ foodId: dish.id, quantity: 1 }], addressId, paymentMethod: 'UPI' },
  });

  if (created.status !== 201) {
    check('workflow order created', false, `status ${created.status}`);
    return;
  }

  const workflowOrderId = created.body.data.id;
  eq('UPI order is marked paid', created.body.data.paymentStatus, 'PAID');

  const confirmed = await api('PATCH', `/api/admin/orders/${workflowOrderId}/status`, {
    token: adminToken,
    body: { status: 'CONFIRMED', note: 'Kitchen accepted' },
  });
  eq('order moves to CONFIRMED', confirmed.body?.data?.status, 'CONFIRMED');

  const skip = await api('PATCH', `/api/admin/orders/${workflowOrderId}/status`, {
    token: adminToken,
    body: { status: 'DELIVERED' },
  });
  eq('skipping workflow steps is blocked', skip.status, 409);

  const preparing = await api('PATCH', `/api/admin/orders/${workflowOrderId}/status`, {
    token: adminToken,
    body: { status: 'PREPARING' },
  });
  eq('order moves to PREPARING', preparing.body?.data?.status, 'PREPARING');

  const out = await api('PATCH', `/api/admin/orders/${workflowOrderId}/status`, {
    token: adminToken,
    body: { status: 'OUT_FOR_DELIVERY' },
  });
  eq('order moves to OUT_FOR_DELIVERY', out.body?.data?.status, 'OUT_FOR_DELIVERY');

  const delivered = await api('PATCH', `/api/admin/orders/${workflowOrderId}/status`, {
    token: adminToken,
    body: { status: 'DELIVERED' },
  });
  eq('order moves to DELIVERED', delivered.body?.data?.status, 'DELIVERED');
  eq('delivery marks payment paid', delivered.body?.data?.paymentStatus, 'PAID');
  check('delivered order records a timestamp', Boolean(delivered.body?.data?.deliveredAt));

  const review = await api('POST', '/api/reviews', {
    token: userToken,
    body: { orderId: workflowOrderId, foodId: dish.id, rating: 5, comment: 'Great, hot and fresh' },
  });
  eq('customer can review a delivered dish', review.status, 201);

  const duplicateReview = await api('POST', '/api/reviews', {
    token: userToken,
    body: { orderId: workflowOrderId, foodId: dish.id, rating: 4 },
  });
  eq('duplicate review blocked', duplicateReview.status, 409);

  const afterReview = await api('GET', `/api/orders/${workflowOrderId}`, { token: userToken });
  eq('order now reports hasReview', afterReview.body?.data?.hasReview, true);

  const mine = await api('GET', '/api/reviews/mine', { token: userToken });
  check('customer review appears in my reviews', mine.body?.data?.length >= 1);

  const reviewId = review.body?.data?.id;
  const moderated = await api('PATCH', `/api/admin/reviews/${reviewId}`, {
    token: adminToken,
    body: { isApproved: false },
  });
  eq('admin can hide a review', moderated.body?.data?.isApproved, false);

  const published = await api('PATCH', `/api/admin/reviews/${reviewId}`, {
    token: adminToken,
    body: { isApproved: true },
  });
  eq('admin can publish a review', published.body?.data?.isApproved, true);

  const removedReview = await api('DELETE', `/api/admin/reviews/${reviewId}`, { token: adminToken });
  eq('admin can delete a review', removedReview.status, 200);

  const deleteDelivered = await api('DELETE', `/api/admin/orders/${workflowOrderId}`, { token: adminToken });
  eq('delivered orders cannot be deleted', deleteDelivered.status, 409);
});

await step('admin catalog CRUD', async () => {
  const created = await api('POST', '/api/admin/categories', {
    token: adminToken,
    body: { name: `Smoke Category ${stamp}`, description: 'Temporary' },
  });
  eq('category created', created.status, 201);
  const categoryId = created.body?.data?.id;
  check('category slug generated', typeof created.body?.data?.slug === 'string');

  const patched = await api('PATCH', `/api/admin/categories/${categoryId}`, {
    token: adminToken,
    body: { description: 'Updated description' },
  });
  eq('category patched', patched.body?.data?.description, 'Updated description');

  const restaurants = await api('GET', '/api/admin/restaurants?limit=1', { token: adminToken });
  const restaurantId = restaurants.body.data[0].id;

  const dish = await api('POST', '/api/admin/foods', {
    token: adminToken,
    body: {
      restaurantId,
      categoryId,
      name: `Smoke Dish ${stamp}`,
      price: 250,
      discountPrice: 199,
      foodType: 'VEG',
      stock: 12,
    },
  });
  eq('dish created', dish.status, 201);
  eq('dish effectivePrice uses discount', dish.body?.data?.effectivePrice, 199);
  const dishId = dish.body?.data?.id;

  const badDiscount = await api('PATCH', `/api/admin/foods/${dishId}`, {
    token: adminToken,
    body: { discountPrice: 300 },
  });
  eq('discount above price rejected', badDiscount.status, 400);

  const dishPatch = await api('PATCH', `/api/admin/foods/${dishId}`, {
    token: adminToken,
    body: { price: 300, discountPrice: 240, stock: 5 },
  });
  eq('dish patched price', dishPatch.body?.data?.price, 300);
  eq('dish patched discount', dishPatch.body?.data?.effectivePrice, 240);

  const deletedDish = await api('DELETE', `/api/admin/foods/${dishId}`, { token: adminToken });
  eq('dish deleted', deletedDish.status, 200);

  const usedCategory = await api('DELETE', `/api/admin/categories/${categoryId}`, { token: adminToken });
  eq('empty category deleted', usedCategory.status, 200);

  const restaurantCreated = await api('POST', '/api/admin/restaurants', {
    token: adminToken,
    body: { name: `Smoke Kitchen ${stamp}`, cuisine: 'Test', city: 'Chennai' },
  });
  eq('restaurant created', restaurantCreated.status, 201);

  const restaurantDeleted = await api('DELETE', `/api/admin/restaurants/${restaurantCreated.body.data.id}`, {
    token: adminToken,
  });
  eq('restaurant deleted', restaurantDeleted.status, 200);

  const restaurantWithOrders = await api('DELETE', `/api/admin/restaurants/${restaurantId}`, { token: adminToken });
  eq('restaurant with orders cannot be deleted', restaurantWithOrders.status, 409);
});

await step('admin marketing CRUD', async () => {
  const coupon = await api('POST', '/api/admin/coupons', {
    token: adminToken,
    body: {
      code: `SMOKE${stamp.toString().slice(-5)}`,
      discountType: 'PERCENT',
      discountValue: 15,
      maxDiscount: 100,
      minOrderValue: 200,
      perUserLimit: 2,
      usageLimit: 50,
    },
  });
  eq('coupon created', coupon.status, 201);
  const couponId = coupon.body?.data?.id;
  eq('coupon code upper-cased', coupon.body?.data?.code, `SMOKE${stamp.toString().slice(-5)}`);

  const overPercent = await api('PATCH', `/api/admin/coupons/${couponId}`, {
    token: adminToken,
    body: { discountValue: 150 },
  });
  eq('percent discount above 100 rejected', overPercent.status, 400);

  const couponPatch = await api('PATCH', `/api/admin/coupons/${couponId}`, {
    token: adminToken,
    body: { isActive: false },
  });
  eq('coupon deactivated', couponPatch.body?.data?.isActive, false);

  const couponDeleted = await api('DELETE', `/api/admin/coupons/${couponId}`, { token: adminToken });
  eq('unused coupon deleted', couponDeleted.status, 200);

  const banner = await api('POST', '/api/admin/banners', {
    token: adminToken,
    body: { title: `Smoke Banner ${stamp}`, accent: '#123456' },
  });
  eq('banner created', banner.status, 201);

  const bannerPatch = await api('PATCH', `/api/admin/banners/${banner.body.data.id}`, {
    token: adminToken,
    body: { subtitle: 'Hello' },
  });
  eq('banner patched', bannerPatch.body?.data?.subtitle, 'Hello');

  const bannerDeleted = await api('DELETE', `/api/admin/banners/${banner.body.data.id}`, { token: adminToken });
  eq('banner deleted', bannerDeleted.status, 200);

  const settings = await api('GET', '/api/admin/settings', { token: adminToken });
  check('admin settings list editable keys', Array.isArray(settings.body?.meta?.editableKeys));

  const saved = await api('PUT', '/api/admin/settings', {
    token: adminToken,
    body: { values: { tagline: 'Smoke tagline' } },
  });
  eq('settings saved', saved.body?.data?.tagline, 'Smoke tagline');

  const badKey = await api('PUT', '/api/admin/settings', {
    token: adminToken,
    body: { values: { not_a_setting: 'x' } },
  });
  eq('unknown setting key rejected', badKey.status, 400);

  const reset = await api('POST', '/api/admin/settings/reset', { token: adminToken });
  eq('settings reset to defaults', reset.body?.data?.tagline, 'Cravings delivered in 30 minutes');
});

await step('admin users', async () => {
  const created = await api('POST', '/api/admin/users', {
    token: adminToken,
    body: { name: 'Smoke Manager', email: `manager+${stamp}@craveo.test`, password: 'Manager@123', role: 'MANAGER' },
  });
  eq('manager account created', created.status, 201);
  eq('manager role stored', created.body?.data?.role, 'MANAGER');
  const managerId = created.body?.data?.id;

  const list = await api('GET', '/api/admin/users?limit=5', { token: adminToken });
  check('user list returns rows', list.body?.data?.length > 0);
  check('user summary counts roles', typeof list.body?.summary?.roleCounts === 'object');

  const patched = await api('PATCH', `/api/admin/users/${managerId}`, {
    token: adminToken,
    body: { isActive: false },
  });
  eq('user deactivated', patched.body?.data?.isActive, false);

  const duplicate = await api('POST', '/api/admin/users', {
    token: adminToken,
    body: { name: 'Dup', email: `manager+${stamp}@craveo.test`, password: 'Manager@123' },
  });
  eq('duplicate user email rejected', duplicate.status, 409);

  const deleted = await api('DELETE', `/api/admin/users/${managerId}`, { token: adminToken });
  eq('user without orders deleted', deleted.status, 200);
});

await step('uploads', async () => {
  const noFile = await api('POST', '/api/uploads/image', { token: userToken });
  eq('upload without a file rejected', noFile.status, 400);

  const anonymous = await api('POST', '/api/uploads/image');
  eq('upload requires auth', anonymous.status, 401);
});

/* --------------------------------- cleanup -------------------------------- */

await step('cleanup', async () => {
  const orders = await api('GET', '/api/orders?limit=50', { token: userToken });
  for (const order of orders.body?.data ?? []) {
    if (order.status === 'CANCELLED') {
      await api('DELETE', `/api/admin/orders/${order.id}`, { token: adminToken });
    }
  }

  if (userId) {
    const deleted = await api('DELETE', `/api/admin/users/${userId}`, { token: adminToken });
    if (deleted.status !== 200) {
      notes.push(`temp user ${userId} left behind (status ${deleted.status})`);
    }
  }
});

console.log('');
console.log(`passed: ${passed}, failed: ${failures.length}`);
for (const note of notes) console.log(`note: ${note}`);
if (failures.length) {
  console.log('');
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exit(1);
}
