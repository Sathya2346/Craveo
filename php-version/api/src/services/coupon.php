<?php

declare(strict_types=1);

/**
 * Validates a coupon against the current cart and returns the discount.
 * Pass `one` to run inside a transaction (and `lock` to lock the row).
 */
function evaluate_coupon(array $args): array
{
    $normalized = strtoupper(trim((string) ($args['code'] ?? '')));
    if ($normalized === '') {
        bad_request('Enter a coupon code');
    }

    $subtotal = (float) ($args['subtotal'] ?? 0);
    $userId = $args['userId'] ?? null;
    $one = $args['one'] ?? 'Db::one';
    $lock = (bool) ($args['lock'] ?? false);

    $row = $one(
        'SELECT * FROM coupons WHERE code = ? LIMIT 1' . ($lock ? ' FOR UPDATE' : ''),
        [$normalized]
    );

    if ($row === null) {
        bad_request('That coupon code is not valid');
    }
    if (!as_bool($row['is_active'])) {
        bad_request('This coupon is no longer active');
    }

    $now = time();
    if (!empty($row['starts_at']) && (strtotime($row['starts_at'] . ' UTC') ?: 0) > $now) {
        bad_request('This coupon is not active yet');
    }
    if (!empty($row['expires_at']) && (strtotime($row['expires_at'] . ' UTC') ?: 0) < $now) {
        bad_request('This coupon has expired');
    }
    if ($row['usage_limit'] !== null && as_int($row['used_count']) >= as_int($row['usage_limit'])) {
        bad_request('This coupon has been fully redeemed');
    }

    $minOrder = money($row['min_order_value']);
    if ($subtotal < $minOrder) {
        bad_request(
            'Add ₹' . round2($minOrder - $subtotal) . ' more to use ' . $normalized . ' (minimum order ₹' . $minOrder . ')',
            [['field' => 'couponCode', 'message' => 'Minimum order is ₹' . $minOrder]]
        );
    }

    if ($userId !== null && as_int($row['per_user_limit']) > 0) {
        $usage = $one(
            'SELECT COUNT(*) AS used FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?',
            [(int) $row['id'], (int) $userId]
        );
        if (as_int($usage['used'] ?? 0) >= as_int($row['per_user_limit'])) {
            bad_request('You have already used this coupon');
        }
    }

    $discount = $row['discount_type'] === 'PERCENT'
        ? (money($subtotal) * money($row['discount_value'])) / 100
        : money($row['discount_value']);

    if ($row['max_discount'] !== null) {
        $discount = min($discount, money($row['max_discount']));
    }
    $discount = min(round2($discount), money($subtotal));

    return [
        'coupon' => map_coupon($row),
        'discount' => round2($discount),
    ];
}
