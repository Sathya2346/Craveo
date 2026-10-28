<?php

declare(strict_types=1);

function stats_delta(float $current, float $previous): float
{
    if ($previous == 0.0) {
        return $current > 0 ? 100.0 : 0.0;
    }

    return round2((($current - $previous) / $previous) * 100);
}

function register_admin_stats_routes(Router $router): void
{
    $router->get('/api/admin/stats', function (): void {
        $q = Validator::query(['days' => 'int|min:1|max:365|default:7']);
        $days = (int) $q['days'];

        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $rangeStart = $now->setTime(0, 0, 0)->modify('-' . ($days - 1) . ' days');
        $previousStart = $rangeStart->modify('-' . $days . ' days');
        $rangeSql = $rangeStart->format('Y-m-d H:i:s');
        $previousSql = $previousStart->format('Y-m-d H:i:s');

        $currentRow = Db::one(
            "SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue,
                    COALESCE(AVG(total), 0) AS avg_value
             FROM orders WHERE placed_at >= ? AND status = 'DELIVERED'",
            [$rangeSql]
        );
        $previousRow = Db::one(
            "SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue,
                    COALESCE(AVG(total), 0) AS avg_value
             FROM orders WHERE placed_at >= ? AND placed_at < ? AND status = 'DELIVERED'",
            [$previousSql, $rangeSql]
        );
        $statusRows = Db::q('SELECT status, COUNT(*) AS total FROM orders GROUP BY status');
        $seriesRows = Db::q(
            "SELECT DATE(placed_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
             FROM orders WHERE placed_at >= ? AND status = 'DELIVERED'
             GROUP BY DATE(placed_at) ORDER BY day ASC",
            [$rangeSql]
        );
        $topFoods = Db::q(
            "SELECT f.id, f.name, f.image_url, SUM(oi.quantity) AS sold, SUM(oi.line_total) AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id AND o.status = 'DELIVERED'
             JOIN foods f ON f.id = oi.food_id
             WHERE o.placed_at >= ?
             GROUP BY f.id, f.name, f.image_url
             ORDER BY sold DESC LIMIT 5",
            [$rangeSql]
        );
        $topRestaurants = Db::q(
            "SELECT r.id, r.name, COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS revenue
             FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
             WHERE o.status = 'DELIVERED' AND o.placed_at >= ?
             GROUP BY r.id, r.name ORDER BY revenue DESC LIMIT 5",
            [$rangeSql]
        );
        $recentOrders = Db::q(
            "SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url,
                    u.name AS customer_name, u.email AS customer_email
             FROM orders o
             JOIN restaurants r ON r.id = o.restaurant_id
             JOIN users u ON u.id = o.user_id
             ORDER BY o.placed_at DESC, o.id DESC LIMIT 6"
        );
        $counts = Db::one(
            "SELECT
               (SELECT COUNT(*) FROM users WHERE role = 'CUSTOMER') AS customers,
               (SELECT COUNT(*) FROM restaurants WHERE is_active = 1) AS restaurants,
               (SELECT COUNT(*) FROM foods) AS foods,
               (SELECT COUNT(*) FROM orders) AS all_orders"
        );
        $lowStock = Db::one('SELECT COUNT(*) AS total FROM foods WHERE stock <= 10');
        $pendingRow = Db::one("SELECT COUNT(*) AS total FROM orders WHERE status IN ('PENDING','CONFIRMED')");

        $newCustomers = Db::one(
            'SELECT COUNT(*) AS total FROM users WHERE role = ? AND created_at >= ?',
            ['CUSTOMER', $rangeSql]
        );
        $prevCustomers = Db::one(
            'SELECT COUNT(*) AS total FROM users WHERE role = ? AND created_at >= ? AND created_at < ?',
            ['CUSTOMER', $previousSql, $rangeSql]
        );

        // Zero-filled ordered series so the chart never has gaps.
        $seriesMap = [];
        foreach ($seriesRows as $row) {
            $key = substr((string) $row['day'], 0, 10);
            $seriesMap[$key] = [
                'revenue' => money($row['revenue']),
                'orders' => (int) $row['orders'],
            ];
        }

        $revenueSeries = [];
        for ($index = 0; $index < $days; $index++) {
            $date = $rangeStart->modify('+' . $index . ' days')->format('Y-m-d');
            $entry = $seriesMap[$date] ?? ['revenue' => 0.0, 'orders' => 0];
            $revenueSeries[] = ['date' => $date, 'revenue' => $entry['revenue'], 'orders' => $entry['orders']];
        }

        $statusCounts = [];
        foreach ($statusRows as $row) {
            $statusCounts[$row['status']] = (int) $row['total'];
        }

        $revenue = money($currentRow['revenue'] ?? 0);
        $previousRevenue = money($previousRow['revenue'] ?? 0);
        $averageOrderValue = money($currentRow['avg_value'] ?? 0);
        $previousAverage = money($previousRow['avg_value'] ?? 0);

        ok([
            'range' => [
                'days' => $days,
                'from' => iso_datetime($rangeSql),
                'to' => $now->format('Y-m-d\TH:i:s.000\Z'),
            ],
            'cards' => [
                'revenue' => $revenue,
                'revenueDelta' => stats_delta($revenue, $previousRevenue),
                'orders' => (int) ($currentRow['orders'] ?? 0),
                'ordersDelta' => stats_delta((float) ($currentRow['orders'] ?? 0), (float) ($previousRow['orders'] ?? 0)),
                'avgOrderValue' => $averageOrderValue,
                'avgOrderValueDelta' => stats_delta($averageOrderValue, $previousAverage),
                'customers' => (int) ($counts['customers'] ?? 0),
                'newCustomers' => (int) ($newCustomers['total'] ?? 0),
                'newCustomersDelta' => stats_delta(
                    (float) ($newCustomers['total'] ?? 0),
                    (float) ($prevCustomers['total'] ?? 0)
                ),
            ],
            'inventory' => [
                'restaurants' => (int) ($counts['restaurants'] ?? 0),
                'foods' => (int) ($counts['foods'] ?? 0),
                'totalOrders' => (int) ($counts['all_orders'] ?? 0),
                'lowStock' => (int) ($lowStock['total'] ?? 0),
                'awaitingAction' => (int) ($pendingRow['total'] ?? 0),
            ],
            'revenueSeries' => $revenueSeries,
            'statusBreakdown' => array_map(
                static fn (string $status): array => ['status' => $status, 'count' => $statusCounts[$status]],
                array_keys($statusCounts)
            ),
            'topFoods' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'imageUrl' => $row['image_url'],
                'sold' => (int) $row['sold'],
                'revenue' => money($row['revenue']),
            ], $topFoods),
            'topRestaurants' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'orders' => (int) $row['orders'],
                'revenue' => money($row['revenue']),
            ], $topRestaurants),
            'recentOrders' => array_map('map_order', $recentOrders),
        ]);
    }, [staff_middleware()]);
}
