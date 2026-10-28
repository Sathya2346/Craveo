<?php

declare(strict_types=1);

/**
 * Removes accounts created by api-smoke.mjs (and their orders) so the demo data
 * stays clean, then repairs coupon usage counters from the redemption log.
 *
 *   php tests/cleanup.php
 */

require_once __DIR__ . '/../api/src/app.php';

// Every account the suites create uses the reserved @craveo.test domain.
$users = Db::q("SELECT id, email FROM users WHERE email LIKE '%@craveo.test'");

$removedOrders = 0;
foreach ($users as $user) {
    $orders = Db::q('SELECT id FROM orders WHERE user_id = ?', [$user['id']]);
    $removedOrders += count($orders);
    Db::exec('DELETE FROM orders WHERE user_id = ?', [$user['id']]);
    Db::exec('DELETE FROM users WHERE id = ?', [$user['id']]);
}

Db::exec(
    'UPDATE coupons c
     SET used_count = (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id)'
);

echo 'removed ' . count($users) . ' test account(s) and ' . $removedOrders . " order(s)\n";
echo "coupon counters recalculated\n";
