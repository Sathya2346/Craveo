<?php

declare(strict_types=1);

/** camelCase payload key -> snake_case column, skipping absent keys. */
function build_update(array $payload, array $columnMap): array
{
    $data = [];
    foreach ($columnMap as $key => $column) {
        if (!array_key_exists($key, $payload)) {
            continue;
        }
        $value = $payload[$key];
        if (is_bool($value)) {
            $data[$column] = $value ? 1 : 0;
        } elseif ($value === '') {
            $data[$column] = null;
        } else {
            $data[$column] = $value;
        }
    }
    return $data;
}

function run_update(string $table, int $id, array $data, string $message): string
{
    if ($data === []) {
        bad_request('Nothing to update');
    }

    $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($data)));
    $values = array_values($data);
    $values[] = $id;

    $result = Db::exec("UPDATE $table SET $assignments WHERE id = ?", $values);
    if ($result['affected'] === 0) {
        // MySQL reports 0 affected rows when nothing actually changed; confirm existence.
        $exists = Db::one("SELECT id FROM $table WHERE id = ?", [$id]);
        if ($exists === null) {
            not_found('Record not found');
        }
    }

    return $message;
}

/** PATCH rules: drop `required` and `default:` so partial edits never reset fields. */
function partial_rules(array $rules): array
{
    $out = [];
    foreach ($rules as $field => $rule) {
        $tokens = array_filter(
            explode('|', $rule),
            static fn (string $token): bool => $token !== 'required' && !str_starts_with($token, 'default:')
        );
        $out[$field] = implode('|', $tokens);
    }
    return $out;
}

function unique_slug(string $table, string $base, ?int $id = null): string
{
    $root = slugify($base) ?: 'item';
    $candidate = $root;
    $counter = 2;

    while (true) {
        $row = Db::one("SELECT id FROM $table WHERE slug = ? LIMIT 1", [$candidate]);
        if ($row === null || (int) $row['id'] === $id) {
            return $candidate;
        }
        $candidate = $root . '-' . $counter;
        $counter++;
        if ($counter > 200) {
            return $root . '-' . base_convert((string) time(), 10, 36);
        }
    }
}

function register_admin_catalog_routes(Router $router): void
{
    $staff = staff_middleware();

    /* ------------------------------- restaurants ------------------------------ */

    $restaurantColumns = [
        'name' => 'name',
        'description' => 'description',
        'cuisine' => 'cuisine',
        'address' => 'address',
        'city' => 'city',
        'imageUrl' => 'image_url',
        'coverImageUrl' => 'cover_image_url',
        'rating' => 'rating',
        'deliveryTime' => 'delivery_time',
        'deliveryFee' => 'delivery_fee',
        'minOrder' => 'min_order',
        'priceForTwo' => 'price_for_two',
        'isOpen' => 'is_open',
        'isFeatured' => 'is_featured',
        'isActive' => 'is_active',
        'sortOrder' => 'sort_order',
    ];

    $restaurantRules = [
        'name' => 'required|string|min:2|max:120',
        'description' => 'nullable|string|max:500',
        'cuisine' => 'string|min:2|max:80|default:Multi cuisine',
        'address' => 'nullable|string|max:255',
        'city' => 'string|min:2|max:80|default:Chennai',
        'imageUrl' => 'nullable|imageUrl|max:500',
        'coverImageUrl' => 'nullable|imageUrl|max:500',
        'rating' => 'float|min:0|max:5',
        'deliveryTime' => 'int|min:5|max:180',
        'deliveryFee' => 'float|min:0|max:2000',
        'minOrder' => 'float|min:0|max:100000',
        'priceForTwo' => 'float|min:0|max:100000',
        'isOpen' => 'bool',
        'isFeatured' => 'bool',
        'isActive' => 'bool',
        'sortOrder' => 'int|min:0|max:9999',
    ];

    $router->get('/api/admin/restaurants', function (): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:60|default:12',
            'search' => 'string|max:80',
            'status' => 'in:all,active,inactive|default:all',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['1 = 1'];
        $params = [];
        if (!empty($q['search'])) {
            $where[] = '(r.name LIKE ? OR r.cuisine LIKE ? OR r.city LIKE ?)';
            $like = like_term((string) $q['search']);
            array_push($params, $like, $like, $like);
        }
        if (($q['status'] ?? 'all') === 'active') {
            $where[] = 'r.is_active = 1';
        }
        if (($q['status'] ?? 'all') === 'inactive') {
            $where[] = 'r.is_active = 0';
        }
        $whereSql = implode(' AND ', $where);

        $rows = Db::q(
            "SELECT r.*, (SELECT COUNT(*) FROM foods f WHERE f.restaurant_id = r.id) AS food_count
             FROM restaurants r WHERE $whereSql
             ORDER BY r.sort_order ASC, r.id DESC" . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one("SELECT COUNT(*) AS total FROM restaurants r WHERE $whereSql", $params);

        ok(array_map('map_restaurant', $rows), [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
        ]);
    }, [$staff]);

    $router->post('/api/admin/restaurants', function () use ($restaurantRules, $restaurantColumns): void {
        $payload = Validator::validate(json_body(), $restaurantRules);
        $data = build_update($payload, $restaurantColumns);
        $slug = unique_slug('restaurants', (string) $data['name']);

        $columns = array_keys($data);
        $columns[] = 'slug';
        $values = array_values($data);
        $values[] = $slug;

        $result = Db::exec(
            'INSERT INTO restaurants (' . implode(', ', $columns) . ') VALUES (' . placeholders($values) . ')',
            $values
        );

        $row = Db::one('SELECT * FROM restaurants WHERE id = ?', [$result['insertId']]);
        ok(map_restaurant($row), ['message' => 'Restaurant added'], 201);
    }, [$staff]);

    $router->patch('/api/admin/restaurants/:id', function (array $params) use ($restaurantRules, $restaurantColumns): void {
        $id = (int) $params['id'];
        $existing = Db::one('SELECT * FROM restaurants WHERE id = ?', [$id]);
        if ($existing === null) {
            not_found('Restaurant not found');
        }

        $payload = Validator::validate(json_body(), partial_rules($restaurantRules));
        $data = build_update($payload, $restaurantColumns);

        if (!empty($payload['name']) && $payload['name'] !== $existing['name']) {
            $data['slug'] = unique_slug('restaurants', (string) $payload['name'], $id);
        }

        run_update('restaurants', $id, $data, 'Restaurant updated');

        $row = Db::one('SELECT * FROM restaurants WHERE id = ?', [$id]);
        ok(map_restaurant($row), ['message' => 'Restaurant updated']);
    }, [$staff]);

    $router->delete('/api/admin/restaurants/:id', function (array $params): void {
        $id = (int) $params['id'];
        $existing = Db::one('SELECT id FROM restaurants WHERE id = ?', [$id]);
        if ($existing === null) {
            not_found('Restaurant not found');
        }

        $orders = Db::one('SELECT COUNT(*) AS total FROM orders WHERE restaurant_id = ?', [$id]);
        if ((int) ($orders['total'] ?? 0) > 0) {
            conflict(
                'This restaurant has ' . $orders['total']
                . ' order(s). Deactivate it instead of deleting so order history stays intact.'
            );
        }

        Db::exec('DELETE FROM restaurants WHERE id = ?', [$id]);
        ok(null, ['message' => 'Restaurant deleted']);
    }, [$staff]);

    /* -------------------------------- categories ------------------------------- */

    $categoryColumns = [
        'name' => 'name',
        'description' => 'description',
        'imageUrl' => 'image_url',
        'sortOrder' => 'sort_order',
        'isActive' => 'is_active',
    ];

    $categoryRules = [
        'name' => 'required|string|min:2|max:80',
        'description' => 'nullable|string|max:255',
        'imageUrl' => 'nullable|imageUrl|max:500',
        'sortOrder' => 'int|min:0|max:9999',
        'isActive' => 'bool',
    ];

    $router->get('/api/admin/categories', function (): void {
        $rows = Db::q(
            'SELECT c.*, (SELECT COUNT(*) FROM foods f WHERE f.category_id = c.id) AS food_count
             FROM categories c ORDER BY c.sort_order ASC, c.name ASC'
        );

        ok(array_map('map_category', $rows));
    }, [$staff]);

    $router->post('/api/admin/categories', function () use ($categoryRules, $categoryColumns): void {
        $payload = Validator::validate(json_body(), $categoryRules);
        $data = build_update($payload, $categoryColumns);
        $slug = unique_slug('categories', (string) $data['name']);

        $columns = array_keys($data);
        $columns[] = 'slug';
        $values = array_values($data);
        $values[] = $slug;

        $result = Db::exec(
            'INSERT INTO categories (' . implode(', ', $columns) . ') VALUES (' . placeholders($values) . ')',
            $values
        );

        $row = Db::one('SELECT * FROM categories WHERE id = ?', [$result['insertId']]);
        ok(map_category($row), ['message' => 'Category added'], 201);
    }, [$staff]);

    $router->patch('/api/admin/categories/:id', function (array $params) use ($categoryRules, $categoryColumns): void {
        $id = (int) $params['id'];
        $existing = Db::one('SELECT * FROM categories WHERE id = ?', [$id]);
        if ($existing === null) {
            not_found('Category not found');
        }

        $payload = Validator::validate(json_body(), partial_rules($categoryRules));
        $data = build_update($payload, $categoryColumns);

        if (!empty($payload['name']) && $payload['name'] !== $existing['name']) {
            $data['slug'] = unique_slug('categories', (string) $payload['name'], $id);
        }

        run_update('categories', $id, $data, 'Category updated');

        $row = Db::one('SELECT * FROM categories WHERE id = ?', [$id]);
        ok(map_category($row), ['message' => 'Category updated']);
    }, [$staff]);

    $router->delete('/api/admin/categories/:id', function (array $params): void {
        $id = (int) $params['id'];
        $existing = Db::one('SELECT id FROM categories WHERE id = ?', [$id]);
        if ($existing === null) {
            not_found('Category not found');
        }

        $foods = Db::one('SELECT COUNT(*) AS total FROM foods WHERE category_id = ?', [$id]);
        if ((int) ($foods['total'] ?? 0) > 0) {
            conflict($foods['total'] . ' dish(es) still use this category. Move them to another category first.');
        }

        Db::exec('DELETE FROM categories WHERE id = ?', [$id]);
        ok(null, ['message' => 'Category deleted']);
    }, [$staff]);

    /* ----------------------------------- foods --------------------------------- */

    $foodColumns = [
        'restaurantId' => 'restaurant_id',
        'categoryId' => 'category_id',
        'name' => 'name',
        'description' => 'description',
        'imageUrl' => 'image_url',
        'price' => 'price',
        'discountPrice' => 'discount_price',
        'foodType' => 'food_type',
        'calories' => 'calories',
        'prepTime' => 'prep_time',
        'stock' => 'stock',
        'isAvailable' => 'is_available',
        'isFeatured' => 'is_featured',
        'tag' => 'tag',
    ];

    $foodRules = [
        'restaurantId' => 'required|int|min:1',
        'categoryId' => 'required|int|min:1',
        'name' => 'required|string|min:2|max:120',
        'description' => 'nullable|string|max:500',
        'imageUrl' => 'nullable|imageUrl|max:500',
        'price' => 'required|float|positive|max:100000',
        'discountPrice' => 'nullable|float|min:0|max:100000',
        'foodType' => 'in:VEG,NON_VEG,EGG|default:VEG',
        'calories' => 'nullable|int|min:0|max:10000',
        'prepTime' => 'int|min:1|max:240',
        'stock' => 'int|min:0|max:100000',
        'isAvailable' => 'bool',
        'isFeatured' => 'bool',
        'tag' => 'nullable|string|max:40',
    ];

    $assertReferences = static function (array $data): void {
        if (array_key_exists('restaurant_id', $data)) {
            $restaurant = Db::one('SELECT id FROM restaurants WHERE id = ?', [$data['restaurant_id']]);
            if ($restaurant === null) {
                bad_request('Selected restaurant does not exist');
            }
        }
        if (array_key_exists('category_id', $data)) {
            $category = Db::one('SELECT id FROM categories WHERE id = ?', [$data['category_id']]);
            if ($category === null) {
                bad_request('Selected category does not exist');
            }
        }
    };

    $router->get('/api/admin/foods', function (): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:60|default:12',
            'search' => 'string|max:80',
            'restaurantId' => 'int|min:1',
            'categoryId' => 'int|min:1',
            'availability' => 'in:all,available,unavailable|default:all',
            'lowStock' => 'bool',
            'sort' => 'in:newest,name,price,stock|default:newest',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['1 = 1'];
        $params = [];

        if (!empty($q['search'])) {
            $where[] = '(f.name LIKE ? OR f.description LIKE ?)';
            $like = like_term((string) $q['search']);
            array_push($params, $like, $like);
        }
        if (!empty($q['restaurantId'])) {
            $where[] = 'f.restaurant_id = ?';
            $params[] = (int) $q['restaurantId'];
        }
        if (!empty($q['categoryId'])) {
            $where[] = 'f.category_id = ?';
            $params[] = (int) $q['categoryId'];
        }
        if (($q['availability'] ?? 'all') !== 'all') {
            $where[] = 'f.is_available = ?';
            $params[] = $q['availability'] === 'available' ? 1 : 0;
        }
        if (!empty($q['lowStock'])) {
            $where[] = 'f.stock <= 10';
        }

        $whereSql = implode(' AND ', $where);
        $orderBy = resolve_sort($q['sort'] ?? null, [
            'newest' => 'f.created_at DESC',
            'name' => 'f.name ASC',
            'price' => 'f.price DESC',
            'stock' => 'f.stock ASC',
        ], 'f.created_at DESC');

        $rows = Db::q(
            "SELECT f.*, r.name AS restaurant_name, c.name AS category_name
             FROM foods f
             JOIN restaurants r ON r.id = f.restaurant_id
             JOIN categories c ON c.id = f.category_id
             WHERE $whereSql ORDER BY $orderBy" . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one(
            "SELECT COUNT(*) AS total FROM foods f
             JOIN restaurants r ON r.id = f.restaurant_id
             JOIN categories c ON c.id = f.category_id
             WHERE $whereSql",
            $params
        );
        $lowStock = Db::one('SELECT COUNT(*) AS total FROM foods WHERE stock <= 10');

        ok(array_map('map_food', $rows), [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
            'summary' => ['lowStock' => (int) ($lowStock['total'] ?? 0)],
        ]);
    }, [$staff]);

    $router->post('/api/admin/foods', function () use ($foodRules, $foodColumns, $assertReferences): void {
        $payload = Validator::validate(json_body(), $foodRules);

        if (isset($payload['discountPrice']) && $payload['discountPrice'] !== null
            && (float) $payload['discountPrice'] >= (float) $payload['price']) {
            bad_request('Discount price must be lower than the price', [
                ['field' => 'discountPrice', 'message' => 'Discount price must be lower than the price'],
            ]);
        }

        $data = build_update($payload, $foodColumns);
        $assertReferences($data);

        if (array_key_exists('price', $data)) {
            $data['price'] = money($data['price']);
        }
        if (!empty($data['discount_price'])) {
            $data['discount_price'] = money($data['discount_price']);
        }

        $columns = array_keys($data);
        $values = array_values($data);
        $result = Db::exec(
            'INSERT INTO foods (' . implode(', ', $columns) . ') VALUES (' . placeholders($values) . ')',
            $values
        );

        $row = Db::one(
            'SELECT f.*, r.name AS restaurant_name, c.name AS category_name
             FROM foods f JOIN restaurants r ON r.id = f.restaurant_id
             JOIN categories c ON c.id = f.category_id WHERE f.id = ?',
            [$result['insertId']]
        );

        ok(map_food($row), ['message' => 'Dish added to the menu'], 201);
    }, [$staff]);

    $router->patch('/api/admin/foods/:id', function (array $params) use ($foodRules, $foodColumns, $assertReferences): void {
        $id = (int) $params['id'];
        $existing = Db::one('SELECT * FROM foods WHERE id = ?', [$id]);
        if ($existing === null) {
            not_found('Dish not found');
        }

        $payload = Validator::validate(json_body(), partial_rules($foodRules));
        $data = build_update($payload, $foodColumns);
        $assertReferences($data);

        if (array_key_exists('price', $data)) {
            $data['price'] = money($data['price']);
        }
        if (array_key_exists('discount_price', $data) && $data['discount_price'] !== null) {
            $data['discount_price'] = money($data['discount_price']);
        }

        $nextPrice = $data['price'] ?? (float) $existing['price'];
        $nextDiscount = array_key_exists('discount_price', $data)
            ? $data['discount_price']
            : $existing['discount_price'];

        if ($nextDiscount !== null && (float) $nextDiscount >= (float) $nextPrice) {
            bad_request('Discount price must be lower than the price', [
                ['field' => 'discountPrice', 'message' => 'Must be lower than the price'],
            ]);
        }

        run_update('foods', $id, $data, 'Dish updated');

        $row = Db::one(
            'SELECT f.*, r.name AS restaurant_name, c.name AS category_name
             FROM foods f JOIN restaurants r ON r.id = f.restaurant_id
             JOIN categories c ON c.id = f.category_id WHERE f.id = ?',
            [$id]
        );
        ok(map_food($row), ['message' => 'Dish updated']);
    }, [$staff]);

    $router->delete('/api/admin/foods/:id', function (array $params): void {
        $id = (int) $params['id'];
        $existing = Db::one('SELECT id FROM foods WHERE id = ?', [$id]);
        if ($existing === null) {
            not_found('Dish not found');
        }

        $items = Db::one('SELECT COUNT(*) AS total FROM order_items WHERE food_id = ?', [$id]);
        if ((int) ($items['total'] ?? 0) > 0) {
            conflict(
                'This dish appears in ' . $items['total']
                . ' past order(s). Mark it unavailable instead of deleting it.'
            );
        }

        Db::exec('DELETE FROM foods WHERE id = ?', [$id]);
        ok(null, ['message' => 'Dish deleted']);
    }, [$staff]);
}
