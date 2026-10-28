<?php

declare(strict_types=1);

const CRAVEO_ORDER_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
];

/** Allowed staff transitions. Terminal states are final. */
function order_transitions(): array
{
    return [
        'PENDING' => ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED' => ['PREPARING', 'CANCELLED'],
        'PREPARING' => ['OUT_FOR_DELIVERY', 'CANCELLED'],
        'OUT_FOR_DELIVERY' => ['DELIVERED', 'CANCELLED'],
        'DELIVERED' => [],
        'CANCELLED' => [],
    ];
}

function customer_cancellable(): array
{
    return ['PENDING', 'CONFIRMED'];
}

function assert_transition(string $from, string $to): void
{
    if ($from === $to) {
        bad_request('This order is already ' . strtolower($to));
    }

    $allowed = order_transitions()[$from] ?? [];
    if (!in_array($to, $allowed, true)) {
        conflict('Cannot move an order from ' . $from . ' to ' . $to, [
            'from' => $from,
            'to' => $to,
            'allowed' => $allowed,
        ]);
    }
}

/**
 * Loads items (and optionally history / review state) for a batch of orders.
 * Batched queries, so there is no N+1.
 */
function hydrate_orders(array $rows, array $options = []): array
{
    if ($rows === []) {
        return [];
    }

    $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
    $inClause = placeholders($ids);
    $withHistory = (bool) ($options['history'] ?? false);
    $reviewUserId = $options['reviews'] ?? null;

    $itemRows = Db::q(
        "SELECT * FROM order_items WHERE order_id IN ($inClause) ORDER BY id ASC",
        $ids
    );

    $itemsByOrder = [];
    foreach ($itemRows as $item) {
        $itemsByOrder[(int) $item['order_id']][] = map_order_item($item);
    }

    $historyByOrder = [];
    if ($withHistory) {
        $historyRows = Db::q(
            "SELECT order_id, status, note, created_at FROM order_status_history
             WHERE order_id IN ($inClause) ORDER BY id ASC",
            $ids
        );
        foreach ($historyRows as $entry) {
            $historyByOrder[(int) $entry['order_id']][] = [
                'status' => $entry['status'],
                'note' => $entry['note'],
                'at' => iso_datetime($entry['created_at']),
            ];
        }
    }

    $reviewedByOrder = [];
    if ($reviewUserId !== null) {
        $reviewRows = Db::q(
            "SELECT order_id, food_id FROM reviews WHERE user_id = ? AND order_id IN ($inClause)",
            array_merge([(int) $reviewUserId], $ids)
        );
        foreach ($reviewRows as $row) {
            $reviewedByOrder[(int) $row['order_id']][] = (int) $row['food_id'];
        }
    }

    $orders = [];
    foreach ($rows as $row) {
        $orderId = (int) $row['id'];
        $items = $itemsByOrder[$orderId] ?? [];
        $extras = ['items' => $items];

        if ($withHistory) {
            $extras['statusHistory'] = $historyByOrder[$orderId] ?? [];
        }

        if ($reviewUserId !== null) {
            $reviewed = $reviewedByOrder[$orderId] ?? [];
            $allReviewed = true;
            foreach ($items as $item) {
                if (!in_array((int) $item['foodId'], $reviewed, true)) {
                    $allReviewed = false;
                    break;
                }
            }
            $extras['hasReview'] = $allReviewed;
        }

        $orders[] = map_order($row, $extras);
    }

    return $orders;
}

function find_order_for_user(int $orderId, int $userId): array
{
    $row = Db::one(
        'SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
         WHERE o.id = ? AND o.user_id = ? LIMIT 1',
        [$orderId, $userId]
    );

    if ($row === null) {
        not_found('Order not found');
    }

    return $row;
}

function find_order_by_id(int $orderId): array
{
    $row = Db::one(
        'SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url,
                u.name AS customer_name, u.email AS customer_email
         FROM orders o
         JOIN restaurants r ON r.id = o.restaurant_id
         JOIN users u ON u.id = o.user_id
         WHERE o.id = ? LIMIT 1',
        [$orderId]
    );

    if ($row === null) {
        not_found('Order not found');
    }

    return $row;
}

/** Restores stock for every line item of a cancelled order. */
function restore_stock(DbTransaction $tx, int $orderId): void
{
    $items = $tx->query('SELECT food_id, quantity FROM order_items WHERE order_id = ?', [$orderId]);
    foreach ($items as $item) {
        if ($item['food_id'] === null) {
            continue;
        }
        $tx->execute('UPDATE foods SET stock = stock + ? WHERE id = ?', [
            (int) $item['quantity'],
            (int) $item['food_id'],
        ]);
    }
}

function push_history(DbTransaction $tx, int $orderId, string $status, ?string $note = null): void
{
    $tx->execute(
        'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
        [$orderId, $status, $note]
    );
}

/** Shared by customer cancel + admin status change. Must run inside a transaction. */
function apply_cancellation(DbTransaction $tx, array $order, ?string $reason): void
{
    $orderId = (int) $order['id'];
    restore_stock($tx, $orderId);

    if ($order['coupon_id'] !== null) {
        $tx->execute('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?', [
            (int) $order['coupon_id'],
        ]);
    }

    $paymentStatus = $order['payment_status'] === 'PAID' ? 'REFUNDED' : $order['payment_status'];
    $tx->execute(
        "UPDATE orders SET status = 'CANCELLED', payment_status = ?, cancelled_at = UTC_TIMESTAMP(),
         cancel_reason = ? WHERE id = ?",
        [$paymentStatus, $reason !== null && $reason !== '' ? $reason : null, $orderId]
    );

    push_history($tx, $orderId, 'CANCELLED', $reason !== null && $reason !== '' ? $reason : 'Order cancelled');
}

function recalculate_food_rating(int $foodId): void
{
    $stats = Db::one(
        'SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total
         FROM reviews WHERE food_id = ? AND is_approved = 1',
        [$foodId]
    );

    Db::exec('UPDATE foods SET rating = ?, review_count = ? WHERE id = ?', [
        $stats['avg_rating'] ?? 0,
        $stats['total'] ?? 0,
        $foodId,
    ]);
}
