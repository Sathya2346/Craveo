<?php

declare(strict_types=1);

function register_review_routes(Router $router): void
{
    $auth = auth_middleware();

    $router->get('/api/reviews/mine', function (): void {
        $user = Auth::user();
        $rows = Db::q(
            'SELECT rv.*, f.name AS food_name, f.image_url AS food_image_url,
                    r.name AS restaurant_name
             FROM reviews rv
             JOIN foods f ON f.id = rv.food_id
             JOIN restaurants r ON r.id = rv.restaurant_id
             WHERE rv.user_id = ? ORDER BY rv.created_at DESC',
            [$user['id']]
        );

        ok(array_map('map_review', $rows));
    }, [$auth]);

    $router->post('/api/reviews', function (): void {
        $user = Auth::user();
        $data = Validator::validate(json_body(), [
            'orderId' => 'required|int|min:1',
            'foodId' => 'required|int|min:1',
            'rating' => 'required|int|min:1|max:5',
            'comment' => 'nullable|string|max:600',
        ], [
            'rating' => 'Pick a rating between 1 and 5',
            'comment' => 'Keep it under 600 characters',
        ]);

        $orderId = (int) $data['orderId'];
        $foodId = (int) $data['foodId'];

        $order = Db::one(
            'SELECT id, status, restaurant_id FROM orders WHERE id = ? AND user_id = ?',
            [$orderId, $user['id']]
        );
        if ($order === null) {
            not_found('Order not found');
        }
        if ($order['status'] !== 'DELIVERED') {
            bad_request('You can review dishes only after the order is delivered');
        }

        $item = Db::one('SELECT id FROM order_items WHERE order_id = ? AND food_id = ?', [$orderId, $foodId]);
        if ($item === null) {
            bad_request('That dish is not part of this order');
        }

        $existing = Db::one('SELECT id FROM reviews WHERE order_id = ? AND food_id = ?', [$orderId, $foodId]);
        if ($existing !== null) {
            conflict('You already reviewed this dish for this order');
        }

        $result = Db::exec(
            'INSERT INTO reviews (user_id, food_id, restaurant_id, order_id, rating, comment, is_approved)
             VALUES (?, ?, ?, ?, ?, ?, 1)',
            [
                $user['id'],
                $foodId,
                (int) $order['restaurant_id'],
                $orderId,
                (int) $data['rating'],
                $data['comment'] ?? null,
            ]
        );

        recalculate_food_rating($foodId);

        $row = Db::one(
            'SELECT rv.*, f.name AS food_name, r.name AS restaurant_name,
                    u.name AS user_name, u.avatar_url AS user_avatar_url
             FROM reviews rv
             JOIN foods f ON f.id = rv.food_id
             JOIN restaurants r ON r.id = rv.restaurant_id
             JOIN users u ON u.id = rv.user_id
             WHERE rv.id = ?',
            [$result['insertId']]
        );

        ok(map_review($row), ['message' => 'Thanks for the review!'], 201);
    }, [$auth]);

    $router->delete('/api/reviews/:id', function (array $params): void {
        $user = Auth::user();
        $id = (int) $params['id'];
        if ($id <= 0) {
            not_found('Review not found');
        }

        $review = Db::one('SELECT * FROM reviews WHERE id = ? AND user_id = ?', [$id, $user['id']]);
        if ($review === null) {
            not_found('Review not found');
        }

        Db::exec('DELETE FROM reviews WHERE id = ?', [$id]);
        recalculate_food_rating((int) $review['food_id']);

        ok(null, ['message' => 'Review removed']);
    }, [$auth]);
}
