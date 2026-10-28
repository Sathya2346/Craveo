import { queryOne } from '../config/db.js';
import { badRequest } from '../utils/ApiError.js';
import { round2, toMoney } from '../utils/helpers.js';
import { mapCoupon } from '../modules/mappers.js';

/**
 * Validates a coupon against the current cart and returns the discount.
 * Pass `one` to run inside a transaction (locks the coupon row for updates).
 */
export const evaluateCoupon = async ({ code, subtotal, userId = null, one = queryOne, lock = false }) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) throw badRequest('Enter a coupon code');

  const row = await one(
    `SELECT * FROM coupons WHERE code = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [normalized],
  );

  if (!row) throw badRequest('That coupon code is not valid');
  if (!row.is_active) throw badRequest('This coupon is no longer active');

  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) {
    throw badRequest('This coupon is not active yet');
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < now) {
    throw badRequest('This coupon has expired');
  }
  if (row.usage_limit !== null && row.used_count >= row.usage_limit) {
    throw badRequest('This coupon has been fully redeemed');
  }

  const minOrder = toMoney(row.min_order_value);
  if (subtotal < minOrder) {
    throw badRequest(
      `Add ₹${round2(minOrder - subtotal)} more to use ${normalized} (minimum order ₹${minOrder})`,
      [{ field: 'couponCode', message: `Minimum order is ₹${minOrder}` }],
    );
  }

  if (userId && row.per_user_limit > 0) {
    const usage = await one(
      'SELECT COUNT(*) AS used FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?',
      [row.id, userId],
    );
    if (Number(usage.used) >= row.per_user_limit) {
      throw badRequest('You have already used this coupon');
    }
  }

  let discount =
    row.discount_type === 'PERCENT'
      ? (toMoney(subtotal) * toMoney(row.discount_value)) / 100
      : toMoney(row.discount_value);

  if (row.max_discount !== null) {
    discount = Math.min(discount, toMoney(row.max_discount));
  }
  discount = Math.min(round2(discount), toMoney(subtotal));

  return { coupon: mapCoupon(row), discount: round2(discount) };
};

export const assertCouponUsable = (row, subtotal) => {
  if (!row || !row.is_active) throw badRequest('That coupon is not valid');
  if (subtotal < toMoney(row.min_order_value)) throw badRequest('Cart total is below the coupon minimum');
};
