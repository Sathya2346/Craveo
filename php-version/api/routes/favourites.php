<?php

declare(strict_types=1);

function register_favourite_routes(Router $router): void
{
    $auth = auth_middleware();

    $router->get('/api/favourites', function (): void {
        $user = Auth::user();
        $rows = Db::q(
            'SELECT f.*, r.name AS restaurant_name, r.slug AS restaurant_slug,
                    r.is_open AS restaurant_is_open, c.name AS category_name
             FROM favourites fav
             JOIN foods f ON f.id = fav.food_id
             JOIN restaurants r ON r.id = f.restaurant_id
             JOIN categories c ON c.id = f.category_id
             WHERE fav.user_id = ?
             ORDER BY fav.created_at DESC',
            [$user['id']]
        );

        ok(array_map('map_food', $rows));
    }, [$auth]);

    $router->get('/api/favourites/ids', function (): void {
        $user = Auth::user();
        $rows = Db::q('SELECT food_id FROM favourites WHERE user_id = ?', [$user['id']]);

        ok(array_map(static fn (array $row): int => (int) $row['food_id'], $rows));
    }, [$auth]);

    $router->post('/api/favourites', function (): void {
        $user = Auth::user();
        $data = Validator::validate(json_body(), [
            'foodId' => 'required|int|min:1',
        ]);

        $foodId = (int) $data['foodId'];
        $food = Db::one('SELECT id FROM foods WHERE id = ?', [$foodId]);
        if ($food === null) {
            not_found('Dish not found');
        }

        Db::exec('INSERT IGNORE INTO favourites (user_id, food_id) VALUES (?, ?)', [$user['id'], $foodId]);

        ok(['foodId' => $foodId, 'isFavourite' => true], ['message' => 'Saved to favourites'], 201);
    }, [$auth]);

    $router->delete('/api/favourites/:foodId', function (array $params): void {
        $user = Auth::user();
        $foodId = (int) $params['foodId'];
        if ($foodId <= 0) {
            not_found('Dish not found');
        }

        Db::exec('DELETE FROM favourites WHERE user_id = ? AND food_id = ?', [$user['id'], $foodId]);

        ok(['foodId' => $foodId, 'isFavourite' => false], ['message' => 'Removed from favourites']);
    }, [$auth]);
}
