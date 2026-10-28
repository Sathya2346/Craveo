<?php

declare(strict_types=1);

function register_admin_review_routes(Router $router): void
{
    $staff = staff_middleware();

    $reviewSelect = 'SELECT rv.*, f.name AS food_name, f.image_url AS food_image_url,
        r.name AS restaurant_name, u.name AS user_name, u.avatar_url AS user_avatar_url
      FROM reviews rv
      JOIN foods f ON f.id = rv.food_id
      JOIN restaurants r ON r.id = rv.restaurant_id
      JOIN users u ON u.id = rv.user_id';

    $router->get('/api/admin/reviews', function () use ($reviewSelect): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:50|default:10',
            'status' => 'in:all,approved,pending|default:all',
            'rating' => 'int|min:1|max:5',
            'search' => 'string|max:80',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['1 = 1'];
        $params = [];

        if (($q['status'] ?? 'all') !== 'all') {
            $where[] = 'rv.is_approved = ?';
            $params[] = $q['status'] === 'approved' ? 1 : 0;
        }
        if (!empty($q['rating'])) {
            $where[] = 'rv.rating = ?';
            $params[] = (int) $q['rating'];
        }
        if (!empty($q['search'])) {
            $where[] = '(f.name LIKE ? OR u.name LIKE ? OR rv.comment LIKE ?)';
            $like = like_term((string) $q['search']);
            array_push($params, $like, $like, $like);
        }

        $whereSql = implode(' AND ', $where);

        $rows = Db::q(
            $reviewSelect . " WHERE $whereSql ORDER BY rv.created_at DESC"
            . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one("SELECT COUNT(*) AS total FROM reviews rv WHERE $whereSql", $params);
        $summary = Db::one(
            'SELECT ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS total,
                    SUM(CASE WHEN is_approved = 0 THEN 1 ELSE 0 END) AS pending
             FROM reviews'
        );

        ok(array_map('map_review', $rows), [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
            'summary' => [
                'averageRating' => !empty($summary['avg_rating']) ? (float) $summary['avg_rating'] : 0,
                'total' => (int) ($summary['total'] ?? 0),
                'pending' => (int) ($summary['pending'] ?? 0),
            ],
        ]);
    }, [$staff]);

    $router->patch('/api/admin/reviews/:id', function (array $params) use ($reviewSelect): void {
        $id = (int) $params['id'];
        $data = Validator::validate(json_body(), [
            'isApproved' => 'required|bool',
        ]);

        $review = Db::one('SELECT * FROM reviews WHERE id = ?', [$id]);
        if ($review === null) {
            not_found('Review not found');
        }

        $approved = (bool) $data['isApproved'];
        Db::exec('UPDATE reviews SET is_approved = ? WHERE id = ?', [$approved ? 1 : 0, $id]);
        recalculate_food_rating((int) $review['food_id']);

        $row = Db::one($reviewSelect . ' WHERE rv.id = ?', [$id]);

        ok(map_review($row), ['message' => $approved ? 'Review published' : 'Review hidden']);
    }, [$staff]);

    $router->delete('/api/admin/reviews/:id', function (array $params): void {
        $id = (int) $params['id'];
        $review = Db::one('SELECT * FROM reviews WHERE id = ?', [$id]);
        if ($review === null) {
            not_found('Review not found');
        }

        Db::exec('DELETE FROM reviews WHERE id = ?', [$id]);
        recalculate_food_rating((int) $review['food_id']);

        ok(null, ['message' => 'Review deleted']);
    }, [$staff]);
}
