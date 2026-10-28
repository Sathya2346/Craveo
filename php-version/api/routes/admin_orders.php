<?php

declare(strict_types=1);

function register_admin_order_routes(Router $router): void
{
    $staff = staff_middleware();
    $admin = admin_middleware();

    $orderSelect = 'SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url,
        u.name AS customer_name, u.email AS customer_email
      FROM orders o
      JOIN restaurants r ON r.id = o.restaurant_id
      JOIN users u ON u.id = o.user_id';

    $router->get('/api/admin/orders', function () use ($orderSelect): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:50|default:10',
            'status' => 'in:PENDING,CONFIRMED,PREPARING,OUT_FOR_DELIVERY,DELIVERED,CANCELLED',
            'search' => 'string|max:80',
            'from' => 'string|max:30',
            'to' => 'string|max:30',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['1 = 1'];
        $params = [];

        if (!empty($q['status'])) {
            $where[] = 'o.status = ?';
            $params[] = $q['status'];
        }
        if (!empty($q['search'])) {
            $where[] = '(o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR r.name LIKE ?)';
            $like = like_term((string) $q['search']);
            array_push($params, $like, $like, $like, $like);
        }
        if (!empty($q['from'])) {
            $from = to_mysql_datetime((string) $q['from']);
            if ($from === null) {
                bad_request('Invalid "from" date');
            }
            $where[] = 'o.placed_at >= ?';
            $params[] = $from;
        }
        if (!empty($q['to'])) {
            $to = to_mysql_datetime((string) $q['to']);
            if ($to === null) {
                bad_request('Invalid "to" date');
            }
            $where[] = 'o.placed_at <= ?';
            $params[] = $to;
        }

        $whereSql = implode(' AND ', $where);

        $rows = Db::q(
            $orderSelect . " WHERE $whereSql ORDER BY o.placed_at DESC, o.id DESC"
            . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one(
            "SELECT COUNT(*) AS total FROM orders o
             JOIN users u ON u.id = o.user_id
             JOIN restaurants r ON r.id = o.restaurant_id WHERE $whereSql",
            $params
        );
        $statusRows = Db::q('SELECT status, COUNT(*) AS total FROM orders GROUP BY status');
        $revenueRow = Db::one("SELECT COALESCE(SUM(total), 0) AS revenue FROM orders o WHERE o.status = 'DELIVERED'");

        $statusCounts = array_fill_keys(CRAVEO_ORDER_STATUSES, 0);
        foreach ($statusRows as $row) {
            $statusCounts[$row['status']] = (int) $row['total'];
        }

        ok(hydrate_orders($rows), [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
            'summary' => [
                'statusCounts' => $statusCounts,
                'totalOrders' => array_sum($statusCounts),
                'revenue' => (float) ($revenueRow['revenue'] ?? 0),
            ],
        ]);
    }, [$staff]);

    $router->get('/api/admin/orders/:id', function (array $params): void {
        $id = (int) $params['id'];
        if ($id <= 0) {
            not_found('Order not found');
        }

        $row = find_order_by_id($id);
        $order = hydrate_orders([$row], ['history' => true])[0] ?? null;
        $order['allowedNextStatuses'] = order_transitions()[$order['status']] ?? [];

        ok($order);
    }, [$staff]);

    $router->patch('/api/admin/orders/:id/status', function (array $params): void {
        $id = (int) $params['id'];
        if ($id <= 0) {
            not_found('Order not found');
        }

        $data = Validator::validate(json_body(), [
            'status' => 'required|in:PENDING,CONFIRMED,PREPARING,OUT_FOR_DELIVERY,DELIVERED,CANCELLED',
            'note' => 'nullable|string|max:255',
            'reason' => 'nullable|string|max:255',
        ]);

        $status = (string) $data['status'];
        $note = $data['note'] ?? null;
        $reason = $data['reason'] ?? null;

        Db::transaction(function (DbTransaction $tx) use ($id, $status, $note, $reason): void {
            $order = $tx->one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$id]);
            if ($order === null) {
                not_found('Order not found');
            }

            assert_transition((string) $order['status'], $status);

            if ($status === 'CANCELLED') {
                apply_cancellation($tx, $order, $reason ?: ($note ?: 'Cancelled by restaurant'));
                return;
            }

            if ($status === 'DELIVERED') {
                $paymentStatus = $order['payment_status'] === 'REFUNDED' ? 'REFUNDED' : 'PAID';
                $tx->execute(
                    "UPDATE orders SET status = 'DELIVERED', delivered_at = UTC_TIMESTAMP(), payment_status = ?
                     WHERE id = ?",
                    [$paymentStatus, $id]
                );
            } else {
                $tx->execute('UPDATE orders SET status = ? WHERE id = ?', [$status, $id]);
            }

            push_history($tx, $id, $status, $note ?: null);
        });

        $row = find_order_by_id($id);
        $order = hydrate_orders([$row], ['history' => true])[0] ?? null;
        $order['allowedNextStatuses'] = order_transitions()[$order['status']] ?? [];

        ok($order, ['message' => 'Order marked ' . strtolower(str_replace('_', ' ', $status))]);
    }, [$staff]);

    $router->patch('/api/admin/orders/:id/payment', function (array $params): void {
        $id = (int) $params['id'];
        $data = Validator::validate(json_body(), [
            'paymentStatus' => 'required|in:PENDING,PAID,REFUNDED,FAILED',
        ]);

        $order = Db::one('SELECT * FROM orders WHERE id = ?', [$id]);
        if ($order === null) {
            not_found('Order not found');
        }
        if ($order['status'] === 'CANCELLED' && $data['paymentStatus'] === 'PAID') {
            conflict('A cancelled order cannot be marked as paid');
        }

        Db::exec('UPDATE orders SET payment_status = ? WHERE id = ?', [$data['paymentStatus'], $id]);

        $row = find_order_by_id($id);
        $updated = hydrate_orders([$row], ['history' => true])[0] ?? null;

        ok($updated, ['message' => 'Payment status updated']);
    }, [$staff]);

    $router->delete('/api/admin/orders/:id', function (array $params): void {
        $id = (int) $params['id'];
        $order = Db::one('SELECT status FROM orders WHERE id = ?', [$id]);
        if ($order === null) {
            not_found('Order not found');
        }
        if ($order['status'] !== 'CANCELLED') {
            conflict('Only cancelled orders can be deleted. Cancel the order first.');
        }

        Db::exec('DELETE FROM orders WHERE id = ?', [$id]);
        ok(null, ['message' => 'Cancelled order deleted']);
    }, [$admin]);
}
