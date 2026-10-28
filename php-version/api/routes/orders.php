<?php

declare(strict_types=1);

/** Validates the cart payload into [['foodId'=>int,'quantity'=>int], ...]. */
function validate_cart_items(array $body): array
{
    $items = $body['items'] ?? null;

    if (!is_array($items) || $items === []) {
        bad_request('Add at least one dish', [['field' => 'items', 'message' => 'Add at least one dish']]);
    }
    if (count($items) > 20) {
        bad_request('Add at least one dish', [['field' => 'items', 'message' => 'Maximum 20 dishes per order']]);
    }

    $clean = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            bad_request('Invalid dish', [['field' => 'items', 'message' => 'Invalid dish']]);
        }

        $foodId = (int) ($item['foodId'] ?? 0);
        $quantity = (int) ($item['quantity'] ?? 0);

        if ($foodId <= 0) {
            bad_request('Invalid dish', [['field' => 'items', 'message' => 'Invalid dish']]);
        }
        if ($quantity < 1 || $quantity > 20) {
            bad_request('Quantity must be at least 1', [
                ['field' => 'items', 'message' => 'Quantity must be between 1 and 20'],
            ]);
        }

        $clean[] = ['foodId' => $foodId, 'quantity' => $quantity];
    }

    return $clean;
}

/**
 * Loads cart lines with restaurant data and validates availability.
 * @return array{lines: array, restaurant: array, restaurantSummary: ?array}
 */
function load_cart(array $items, callable $query): array
{
    $merged = [];
    foreach ($items as $item) {
        $merged[$item['foodId']] = ($merged[$item['foodId']] ?? 0) + $item['quantity'];
    }

    $ids = array_keys($merged);
    if (count($ids) > 20) {
        bad_request('Too many different dishes in one order');
    }
    if (array_sum($merged) > 50) {
        bad_request('Maximum 50 items per order');
    }

    $inClause = placeholders($ids);
    $rows = $query(
        "SELECT f.*,
                r.name AS restaurant_name, r.slug AS restaurant_slug, r.is_open AS restaurant_open,
                r.is_active AS restaurant_active, r.delivery_fee AS delivery_fee,
                r.min_order AS min_order, r.rating AS restaurant_rating,
                r.description AS restaurant_description, r.cuisine AS restaurant_cuisine,
                r.address AS restaurant_address, r.city AS restaurant_city,
                r.image_url AS restaurant_image_url, r.cover_image_url AS restaurant_cover_image,
                r.review_count AS restaurant_review_count, r.delivery_time AS restaurant_delivery_time,
                r.price_for_two AS restaurant_price_for_two, r.is_featured AS restaurant_featured,
                r.sort_order AS restaurant_sort_order, r.created_at AS restaurant_created_at,
                r.updated_at AS restaurant_updated_at
         FROM foods f JOIN restaurants r ON r.id = f.restaurant_id
         WHERE f.id IN ($inClause)",
        $ids
    );

    $byId = [];
    foreach ($rows as $row) {
        $byId[(int) $row['id']] = $row;
    }

    $missing = array_values(array_filter($ids, static fn (int $id): bool => !isset($byId[$id])));
    if ($missing !== []) {
        bad_request(
            'Some dishes are no longer on the menu',
            array_map(static fn (int $id): array => ['field' => 'items', 'id' => $id], $missing)
        );
    }

    $restaurant = $rows[0];
    foreach ($rows as $row) {
        if ((int) $row['restaurant_id'] !== (int) $restaurant['restaurant_id']) {
            bad_request('Each order can only contain dishes from one restaurant');
        }
    }

    if (!as_bool($restaurant['restaurant_active'])) {
        conflict('This restaurant is no longer available');
    }
    if (!as_bool($restaurant['restaurant_open'])) {
        conflict('This restaurant is currently closed');
    }

    $unavailable = [];
    $lines = [];

    foreach ($merged as $foodId => $quantity) {
        $row = $byId[$foodId];

        if (!as_bool($row['is_available'])) {
            $unavailable[] = ['foodId' => $foodId, 'name' => $row['name'], 'reason' => 'unavailable'];
            continue;
        }
        if ((int) $row['stock'] < $quantity) {
            $unavailable[] = [
                'foodId' => $foodId,
                'name' => $row['name'],
                'reason' => 'stock',
                'available' => (int) $row['stock'],
            ];
            continue;
        }

        $unitPrice = $row['discount_price'] !== null ? money($row['discount_price']) : money($row['price']);
        $lines[] = [
            'foodId' => $foodId,
            'name' => $row['name'],
            'imageUrl' => $row['image_url'],
            'quantity' => $quantity,
            'unitPrice' => $unitPrice,
            'lineTotal' => round2($unitPrice * $quantity),
        ];
    }

    if ($unavailable !== []) {
        conflict(
            $unavailable[0]['reason'] === 'stock'
                ? 'Only ' . $unavailable[0]['available'] . ' left of ' . $unavailable[0]['name']
                : 'Some dishes just became unavailable',
            $unavailable
        );
    }

    $restaurantSummary = map_restaurant([
        'id' => $restaurant['restaurant_id'],
        'name' => $restaurant['restaurant_name'],
        'slug' => $restaurant['restaurant_slug'],
        'description' => $restaurant['restaurant_description'] ?? null,
        'cuisine' => $restaurant['restaurant_cuisine'] ?? null,
        'address' => $restaurant['restaurant_address'] ?? null,
        'city' => $restaurant['restaurant_city'] ?? null,
        'image_url' => $restaurant['restaurant_image_url'] ?? null,
        'cover_image_url' => $restaurant['restaurant_cover_image'] ?? null,
        'rating' => $restaurant['restaurant_rating'],
        'review_count' => $restaurant['restaurant_review_count'] ?? 0,
        'delivery_time' => $restaurant['restaurant_delivery_time'] ?? 0,
        'delivery_fee' => $restaurant['delivery_fee'],
        'min_order' => $restaurant['min_order'],
        'price_for_two' => $restaurant['restaurant_price_for_two'] ?? 0,
        'is_open' => $restaurant['restaurant_open'],
        'is_featured' => $restaurant['restaurant_featured'] ?? 0,
        'is_active' => $restaurant['restaurant_active'],
        'sort_order' => $restaurant['restaurant_sort_order'] ?? 0,
        'created_at' => $restaurant['restaurant_created_at'] ?? null,
        'updated_at' => $restaurant['restaurant_updated_at'] ?? null,
    ]);

    return [
        'lines' => $lines,
        'restaurant' => $restaurant,
        'restaurantSummary' => $restaurantSummary,
    ];
}

/** Server-authoritative pricing. Client numbers are never trusted. */
function build_quote(array $args): array
{
    $query = $args['query'] ?? 'Db::q';
    $one = $args['one'] ?? 'Db::one';
    $userId = $args['userId'] ?? null;
    $couponCode = $args['couponCode'] ?? null;
    $lockCoupon = (bool) ($args['lockCoupon'] ?? false);
    $settings = $args['settings'] ?? null;

    $cart = load_cart($args['items'], $query);
    $subtotal = round2(array_reduce(
        $cart['lines'],
        static fn (float $sum, array $line): float => $sum + (float) $line['lineTotal'],
        0.0
    ));

    $settings = $settings ?? get_settings();
    $minOrder = money($cart['restaurant']['min_order']);

    if ($subtotal < $minOrder) {
        bad_request(
            'Minimum order for ' . $cart['restaurant']['restaurant_name'] . ' is ₹' . $minOrder,
            [['field' => 'items', 'message' => 'Add ₹' . round2($minOrder - $subtotal) . ' more to checkout']]
        );
    }

    $discount = 0.0;
    $coupon = null;
    $couponError = null;

    if ($couponCode !== null && $couponCode !== '') {
        try {
            $evaluated = evaluate_coupon([
                'code' => $couponCode,
                'subtotal' => $subtotal,
                'userId' => $userId,
                'one' => $one,
                'lock' => $lockCoupon,
            ]);
            $discount = (float) $evaluated['discount'];
            $coupon = $evaluated['coupon'];
        } catch (ApiException $error) {
            if ($lockCoupon) {
                throw $error;
            }
            $couponError = $error->getMessage();
        }
    }

    $pricing = build_pricing($subtotal, $cart['restaurant'], $settings, $discount);
    $pricing['minOrder'] = $minOrder;
    $pricing['freeDeliveryAbove'] = money($settings['free_delivery_above'] ?? 0);

    return [
        'lines' => $cart['lines'],
        'restaurant' => $cart['restaurant'],
        'restaurantSummary' => $cart['restaurantSummary'],
        'pricing' => $pricing,
        'coupon' => $coupon === null ? null : [
            'id' => $coupon['id'],
            'code' => $coupon['code'],
            'description' => $coupon['description'],
            'discount' => $discount,
        ],
        'couponError' => $couponError,
    ];
}

const ORDER_ROW_SELECT = 'SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image_url
  FROM orders o JOIN restaurants r ON r.id = o.restaurant_id';

function register_order_routes(Router $router): void
{
    /* --------------------------------- quote --------------------------------- */

    $router->post('/api/orders/quote', function (): void {
        $body = json_body();
        $items = validate_cart_items($body);

        $couponCode = isset($body['couponCode']) && is_string($body['couponCode'])
            ? trim($body['couponCode'])
            : null;
        if ($couponCode !== null && mb_strlen($couponCode) > 30) {
            bad_request('Please check the highlighted fields', [
                ['field' => 'couponCode', 'message' => 'Coupon code is too long'],
            ]);
        }

        $user = Auth::optional();
        $quote = build_quote([
            'userId' => $user['id'] ?? null,
            'items' => $items,
            'couponCode' => $couponCode,
        ]);

        ok([
            'items' => $quote['lines'],
            'restaurant' => $quote['restaurantSummary'],
            'pricing' => $quote['pricing'],
            'coupon' => $quote['coupon'],
            'couponError' => $quote['couponError'],
            'itemCount' => array_reduce(
                $quote['lines'],
                static fn (int $sum, array $line): int => $sum + (int) $line['quantity'],
                0
            ),
        ]);
    });

    /* ------------------------------- place order ------------------------------ */

    $router->post('/api/orders', function (): void {
        $user = Auth::user();
        $body = json_body();
        $items = validate_cart_items($body);

        $data = Validator::validate($body, [
            'addressId' => 'int|min:1',
            'contactName' => 'string|min:2|max:100',
            'contactPhone' => 'phone',
            'line1' => 'string|min:5|max:255',
            'line2' => 'nullable|string|max:255',
            'city' => 'string|min:2|max:80',
            'pincode' => 'pincode',
            'couponCode' => 'nullable|string|max:30',
            'paymentMethod' => 'in:COD,UPI,CARD|default:COD',
            'notes' => 'nullable|string|max:500',
        ], [
            'contactPhone' => 'Enter a valid phone number',
            'pincode' => 'Enter a valid pincode',
        ]);

        if (empty($data['addressId'])) {
            $required = [
                'contactName' => 'Delivery name is required',
                'contactPhone' => 'Phone number is required',
                'line1' => 'Address is required',
                'city' => 'City is required',
                'pincode' => 'Pincode is required',
            ];
            $errors = [];
            foreach ($required as $field => $message) {
                if (empty($data[$field])) {
                    $errors[] = ['field' => $field, 'message' => $message];
                }
            }
            if ($errors !== []) {
                bad_request('Please check the highlighted fields', $errors);
            }
        }

        if (!empty($data['addressId'])) {
            $address = Db::one('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [
                (int) $data['addressId'],
                $user['id'],
            ]);
            if ($address === null) {
                not_found('Selected delivery address was not found');
            }
            $snapshot = [
                'contactName' => $address['contact_name'],
                'contactPhone' => $address['phone'],
                'line1' => $address['line1'],
                'line2' => $address['line2'],
                'city' => $address['city'],
                'pincode' => $address['pincode'],
            ];
        } else {
            $snapshot = [
                'contactName' => $data['contactName'],
                'contactPhone' => $data['contactPhone'],
                'line1' => $data['line1'],
                'line2' => ($data['line2'] ?? null) ?: null,
                'city' => $data['city'],
                'pincode' => $data['pincode'],
            ];
        }

        $paymentMethod = (string) ($data['paymentMethod'] ?? 'COD');
        $paymentStatus = $paymentMethod === 'COD' ? 'PENDING' : 'PAID';

        $orderId = Db::transaction(function (DbTransaction $tx) use ($user, $items, $data, $snapshot, $paymentMethod, $paymentStatus): int {
            $settings = get_settings();
            $quote = build_quote([
                'userId' => $user['id'],
                'items' => $items,
                'couponCode' => $data['couponCode'] ?? null,
                'query' => static fn (string $sql, array $params = []): array => $tx->query($sql, $params),
                'one' => static fn (string $sql, array $params = []): ?array => $tx->one($sql, $params),
                'lockCoupon' => true,
                'settings' => $settings,
            ]);

            foreach ($quote['lines'] as $line) {
                $updated = $tx->execute(
                    'UPDATE foods SET stock = stock - ? WHERE id = ? AND stock >= ?',
                    [$line['quantity'], $line['foodId'], $line['quantity']]
                );
                if ($updated['affected'] === 0) {
                    conflict($line['name'] . ' just went out of stock', [['foodId' => $line['foodId']]]);
                }
            }

            $number = order_number();
            $inserted = $tx->execute(
                "INSERT INTO orders (order_number, user_id, restaurant_id, status, payment_method, payment_status,
                   contact_name, contact_phone, delivery_line1, delivery_line2, delivery_city, delivery_pincode, notes,
                   subtotal, discount, delivery_fee, tax, total, coupon_id, coupon_code)
                 VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    $number,
                    $user['id'],
                    (int) $quote['restaurant']['restaurant_id'],
                    $paymentMethod,
                    $paymentStatus,
                    $snapshot['contactName'],
                    $snapshot['contactPhone'],
                    $snapshot['line1'],
                    $snapshot['line2'] ?? null,
                    $snapshot['city'],
                    $snapshot['pincode'],
                    !empty($data['notes']) ? $data['notes'] : null,
                    $quote['pricing']['subtotal'],
                    $quote['pricing']['discount'],
                    $quote['pricing']['deliveryFee'],
                    $quote['pricing']['tax'],
                    $quote['pricing']['total'],
                    $quote['coupon']['id'] ?? null,
                    $quote['coupon']['code'] ?? null,
                ]
            );

            $newOrderId = (int) $inserted['insertId'];

            foreach ($quote['lines'] as $line) {
                $tx->execute(
                    'INSERT INTO order_items (order_id, food_id, name, image_url, unit_price, quantity, line_total)
                     VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [
                        $newOrderId,
                        $line['foodId'],
                        $line['name'],
                        $line['imageUrl'],
                        $line['unitPrice'],
                        $line['quantity'],
                        $line['lineTotal'],
                    ]
                );
            }

            if ($quote['coupon'] !== null) {
                $tx->execute('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [$quote['coupon']['id']]);
                $tx->execute(
                    'INSERT INTO coupon_redemptions (coupon_id, user_id, order_id) VALUES (?, ?, ?)',
                    [$quote['coupon']['id'], $user['id'], $newOrderId]
                );
            }

            push_history(
                $tx,
                $newOrderId,
                'PENDING',
                $paymentMethod === 'COD' ? 'Order placed · Cash on delivery' : 'Order placed · Paid via ' . $paymentMethod
            );

            return $newOrderId;
        });

        $row = Db::one(ORDER_ROW_SELECT . ' WHERE o.id = ?', [$orderId]);
        $order = hydrate_orders([$row], ['history' => true])[0] ?? null;

        ok($order, ['message' => 'Order placed. The kitchen has been notified!'], 201);
    }, [auth_middleware()]);

    /* -------------------------------- history -------------------------------- */

    $router->get('/api/orders', function (): void {
        $user = Auth::user();
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:50|default:10',
            'status' => 'in:PENDING,CONFIRMED,PREPARING,OUT_FOR_DELIVERY,DELIVERED,CANCELLED',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['o.user_id = ?'];
        $params = [$user['id']];
        if (!empty($q['status'])) {
            $where[] = 'o.status = ?';
            $params[] = $q['status'];
        }
        $whereSql = implode(' AND ', $where);

        $rows = Db::q(
            ORDER_ROW_SELECT . " WHERE $whereSql ORDER BY o.placed_at DESC, o.id DESC"
            . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one("SELECT COUNT(*) AS total FROM orders o WHERE $whereSql", $params);
        $summary = Db::one(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status = 'DELIVERED' THEN total ELSE 0 END) AS spent
             FROM orders WHERE user_id = ?",
            [$user['id']]
        );

        $orders = hydrate_orders($rows, ['reviews' => (int) $user['id']]);

        ok($orders, [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
            'summary' => [
                'totalOrders' => (int) ($summary['total'] ?? 0),
                'totalSpent' => money($summary['spent'] ?? 0),
            ],
        ]);
    }, [auth_middleware()]);

    $router->get('/api/orders/:id', function (array $params): void {
        $user = Auth::user();
        $id = (int) $params['id'];
        if ($id <= 0) {
            not_found('Order not found');
        }

        $row = find_order_for_user($id, (int) $user['id']);
        $order = hydrate_orders([$row], ['history' => true, 'reviews' => (int) $user['id']])[0] ?? null;

        $order['canCancel'] = in_array($order['status'], customer_cancellable(), true);
        $order['canReview'] = $order['status'] === 'DELIVERED' && empty($order['hasReview']);

        ok($order);
    }, [auth_middleware()]);

    $router->patch('/api/orders/:id/cancel', function (array $params): void {
        $user = Auth::user();
        $id = (int) $params['id'];
        if ($id <= 0) {
            not_found('Order not found');
        }

        $body = json_body();
        $reason = isset($body['reason']) && is_string($body['reason']) ? trim($body['reason']) : '';
        if (mb_strlen($reason) > 255) {
            bad_request('Please check the highlighted fields', [
                ['field' => 'reason', 'message' => 'Reason must be 255 characters or less'],
            ]);
        }

        $order = find_order_for_user($id, (int) $user['id']);
        if ($order['status'] === 'CANCELLED') {
            conflict('This order is already cancelled');
        }
        if (!in_array($order['status'], customer_cancellable(), true)) {
            conflict(
                'Your order is already ' . strtolower(str_replace('_', ' ', $order['status']))
                . ' and cannot be cancelled here. Contact support.'
            );
        }

        Db::transaction(function (DbTransaction $tx) use ($id, $reason): void {
            $fresh = $tx->one('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$id]);
            if ($fresh === null) {
                not_found('Order not found');
            }
            if (!in_array($fresh['status'], customer_cancellable(), true)) {
                conflict('This order moved forward and can no longer be cancelled');
            }
            apply_cancellation($tx, $fresh, $reason !== '' ? $reason : 'Cancelled by customer');
        });

        $row = find_order_for_user($id, (int) $user['id']);
        $updated = hydrate_orders([$row], ['history' => true, 'reviews' => (int) $user['id']])[0] ?? null;

        ok($updated, ['message' => 'Order cancelled']);
    }, [auth_middleware()]);
}
