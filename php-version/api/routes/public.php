<?php

declare(strict_types=1);

function register_public_routes(Router $router): void
{
    /* ------------------------------- restaurants ------------------------------ */

    $router->get('/api/restaurants', function (): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:500|default:12',
            'search' => 'string|max:80',
            'cuisine' => 'string|max:80',
            'city' => 'string|max:80',
            'featured' => 'bool',
            'openOnly' => 'bool',
            'sort' => 'in:popular,rating,delivery,fee,newest|default:popular',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['r.is_active = 1'];
        $params = [];

        if (!empty($q['openOnly'])) {
            $where[] = 'r.is_open = 1';
        }
        if (!empty($q['featured'])) {
            $where[] = 'r.is_featured = 1';
        }
        if (!empty($q['cuisine'])) {
            $where[] = 'r.cuisine = ?';
            $params[] = $q['cuisine'];
        }
        if (!empty($q['city'])) {
            $where[] = 'r.city = ?';
            $params[] = $q['city'];
        }
        if (!empty($q['search'])) {
            $where[] = '(r.name LIKE ? OR r.cuisine LIKE ? OR r.description LIKE ?)';
            $like = like_term((string) $q['search']);
            array_push($params, $like, $like, $like);
        }

        $orderBy = resolve_sort($q['sort'] ?? null, [
            'popular' => 'r.sort_order ASC, r.rating DESC',
            'rating' => 'r.rating DESC, r.review_count DESC',
            'delivery' => 'r.delivery_time ASC',
            'fee' => 'r.delivery_fee ASC',
            'newest' => 'r.created_at DESC',
        ], 'r.sort_order ASC');

        $whereSql = implode(' AND ', $where);

        $rows = Db::q(
            "SELECT r.*, (SELECT COUNT(*) FROM foods f WHERE f.restaurant_id = r.id AND f.is_available = 1) AS food_count
             FROM restaurants r WHERE $whereSql
             ORDER BY $orderBy" . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one("SELECT COUNT(*) AS total FROM restaurants r WHERE $whereSql", $params);

        ok(array_map('map_restaurant', $rows), [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
        ]);
    });

    $router->get('/api/restaurants/:idOrSlug', function (array $params): void {
        $idOrSlug = $params['idOrSlug'];
        $numeric = preg_match('/^\d+$/', $idOrSlug) === 1;

        $row = $numeric
            ? Db::one('SELECT * FROM restaurants WHERE id = ? AND is_active = 1 LIMIT 1', [(int) $idOrSlug])
            : Db::one('SELECT * FROM restaurants WHERE slug = ? AND is_active = 1 LIMIT 1', [$idOrSlug]);

        if ($row === null) {
            not_found('Restaurant not found');
        }

        $categories = Db::q(
            "SELECT c.id, c.name, c.slug, COUNT(f.id) AS food_count
             FROM categories c
             JOIN foods f ON f.category_id = c.id AND f.is_available = 1
             WHERE f.restaurant_id = ? AND c.is_active = 1
             GROUP BY c.id, c.name, c.slug, c.sort_order
             ORDER BY c.sort_order ASC, c.name ASC",
            [(int) $row['id']]
        );

        ok([
            'restaurant' => map_restaurant($row),
            'menuCategories' => array_map(static fn (array $category): array => [
                'id' => (int) $category['id'],
                'name' => $category['name'],
                'slug' => $category['slug'],
                'foodCount' => (int) $category['food_count'],
            ], $categories),
        ]);
    });

    $router->get('/api/restaurants/:idOrSlug/foods', function (array $params): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:500|default:12',
        ]);

        $idOrSlug = $params['idOrSlug'];
        $numeric = preg_match('/^\d+$/', $idOrSlug) === 1;

        $restaurant = $numeric
            ? Db::one('SELECT id FROM restaurants WHERE id = ? AND is_active = 1', [(int) $idOrSlug])
            : Db::one('SELECT id FROM restaurants WHERE slug = ? AND is_active = 1', [$idOrSlug]);

        if ($restaurant === null) {
            not_found('Restaurant not found');
        }

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $rows = Db::q(
            "SELECT f.*, c.name AS category_name
             FROM foods f JOIN categories c ON c.id = f.category_id
             WHERE f.restaurant_id = ?
             ORDER BY f.is_available DESC, f.is_featured DESC, f.name ASC"
            . limit_clause($limit, (int) $paging['offset']),
            [(int) $restaurant['id']]
        );
        $total = Db::one('SELECT COUNT(*) AS total FROM foods WHERE restaurant_id = ?', [(int) $restaurant['id']]);

        ok(array_map('map_food', $rows), [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
        ]);
    });

    /* ---------------------------------- foods --------------------------------- */

    $router->get('/api/foods', function (): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:500|default:12',
            'search' => 'string|max:80',
            'restaurantId' => 'int|min:1',
            'category' => 'string|max:80',
            'foodType' => 'in:VEG,NON_VEG,EGG',
            'featured' => 'bool',
            'minPrice' => 'float|min:0|max:100000',
            'maxPrice' => 'float|min:0|max:100000',
            'sort' => 'in:popular,price_asc,price_desc,rating,newest|default:popular',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['f.is_available = 1', 'f.stock > 0', 'r.is_active = 1'];
        $params = [];

        if (!empty($q['restaurantId'])) {
            $where[] = 'f.restaurant_id = ?';
            $params[] = (int) $q['restaurantId'];
        }
        if (!empty($q['category'])) {
            $where[] = 'c.slug = ?';
            $params[] = $q['category'];
        }
        if (!empty($q['foodType'])) {
            $where[] = 'f.food_type = ?';
            $params[] = $q['foodType'];
        }
        if (!empty($q['featured'])) {
            $where[] = 'f.is_featured = 1';
        }
        if (isset($q['minPrice'])) {
            $where[] = 'COALESCE(f.discount_price, f.price) >= ?';
            $params[] = (float) $q['minPrice'];
        }
        if (isset($q['maxPrice'])) {
            $where[] = 'COALESCE(f.discount_price, f.price) <= ?';
            $params[] = (float) $q['maxPrice'];
        }
        if (!empty($q['search'])) {
            $where[] = '(f.name LIKE ? OR f.description LIKE ? OR r.name LIKE ?)';
            $like = like_term((string) $q['search']);
            array_push($params, $like, $like, $like);
        }

        $orderBy = resolve_sort($q['sort'] ?? null, [
            'popular' => 'f.is_featured DESC, f.rating DESC',
            'price_asc' => 'COALESCE(f.discount_price, f.price) ASC',
            'price_desc' => 'COALESCE(f.discount_price, f.price) DESC',
            'rating' => 'f.rating DESC, f.review_count DESC',
            'newest' => 'f.created_at DESC',
        ], 'f.is_featured DESC');

        $whereSql = implode(' AND ', $where);
        $baseFrom = "FROM foods f
            JOIN restaurants r ON r.id = f.restaurant_id
            JOIN categories c ON c.id = f.category_id
            WHERE $whereSql";

        $rows = Db::q(
            "SELECT f.*, r.name AS restaurant_name, r.slug AS restaurant_slug, r.is_open AS restaurant_is_open,
                    c.name AS category_name
             $baseFrom ORDER BY $orderBy" . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one("SELECT COUNT(*) AS total $baseFrom", $params);

        ok(array_map('map_food', $rows), [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
        ]);
    });

    $router->get('/api/foods/:id', function (array $params): void {
        $id = (int) $params['id'];
        if ($id <= 0) {
            not_found('Food not found');
        }

        $row = Db::one(
            "SELECT f.*, r.name AS restaurant_name, r.slug AS restaurant_slug, r.is_open AS restaurant_is_open,
                    c.name AS category_name
             FROM foods f
             JOIN restaurants r ON r.id = f.restaurant_id
             JOIN categories c ON c.id = f.category_id
             WHERE f.id = ? LIMIT 1",
            [$id]
        );

        if ($row === null) {
            not_found('Food not found');
        }

        $related = Db::q(
            "SELECT f.*, r.name AS restaurant_name, c.name AS category_name
             FROM foods f
             JOIN restaurants r ON r.id = f.restaurant_id
             JOIN categories c ON c.id = f.category_id
             WHERE f.category_id = ? AND f.id <> ? AND f.is_available = 1
             ORDER BY f.rating DESC LIMIT 4",
            [(int) $row['category_id'], $id]
        );

        ok([
            'food' => map_food($row),
            'related' => array_map('map_food', $related),
        ]);
    });

    $router->get('/api/foods/:id/reviews', function (array $params): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:500|default:6',
        ]);

        $foodId = (int) $params['id'];
        if ($foodId <= 0) {
            not_found('Food not found');
        }

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $rows = Db::q(
            "SELECT rv.*, u.name AS user_name, u.avatar_url AS user_avatar_url
             FROM reviews rv JOIN users u ON u.id = rv.user_id
             WHERE rv.food_id = ? AND rv.is_approved = 1
             ORDER BY rv.created_at DESC" . limit_clause($limit, (int) $paging['offset']),
            [$foodId]
        );
        $total = Db::one('SELECT COUNT(*) AS total FROM reviews WHERE food_id = ? AND is_approved = 1', [$foodId]);
        $summary = Db::one(
            'SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total
             FROM reviews WHERE food_id = ? AND is_approved = 1',
            [$foodId]
        );

        ok([
            'reviews' => array_map('map_review', $rows),
            'averageRating' => !empty($summary['avg_rating']) ? (float) $summary['avg_rating'] : 0,
            'totalReviews' => (int) ($summary['total'] ?? 0),
        ], [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
        ]);
    });

    /* ---------------------------- categories / misc ---------------------------- */

    $router->get('/api/categories', function (): void {
        $rows = Db::q(
            "SELECT c.*, (SELECT COUNT(*) FROM foods f WHERE f.category_id = c.id AND f.is_available = 1) AS food_count
             FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order ASC, c.name ASC"
        );

        ok(array_map('map_category', $rows));
    });

    $router->get('/api/banners', function (): void {
        $rows = Db::q(
            'SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 8'
        );

        ok(array_map('map_banner', $rows));
    });

    $router->get('/api/coupons', function (): void {
        $rows = Db::q(
            'SELECT * FROM coupons
             WHERE is_active = 1
               AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
               AND (expires_at IS NULL OR expires_at >= UTC_TIMESTAMP())
               AND (usage_limit IS NULL OR used_count < usage_limit)
             ORDER BY min_order_value ASC, id ASC'
        );

        ok(array_map('map_coupon', $rows));
    });

    $router->get('/api/settings', function (): void {
        ok(get_settings());
    });

    $router->get('/api/stats', function (): void {
        $restaurants = Db::one('SELECT COUNT(*) AS total FROM restaurants WHERE is_active = 1');
        $foods = Db::one('SELECT COUNT(*) AS total FROM foods WHERE is_available = 1');
        $orders = Db::one("SELECT COUNT(*) AS total FROM orders WHERE status = 'DELIVERED'");
        $customers = Db::one("SELECT COUNT(*) AS total FROM users WHERE role = 'CUSTOMER'");

        ok([
            'restaurants' => (int) ($restaurants['total'] ?? 0),
            'dishes' => (int) ($foods['total'] ?? 0),
            'ordersDelivered' => (int) ($orders['total'] ?? 0),
            'happyCustomers' => (int) ($customers['total'] ?? 0),
        ]);
    });
}
