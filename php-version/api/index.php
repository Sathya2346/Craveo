<?php

declare(strict_types=1);

require_once __DIR__ . '/src/app.php';

require_once __DIR__ . '/routes/public.php';
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/addresses.php';
require_once __DIR__ . '/routes/favourites.php';
require_once __DIR__ . '/routes/orders.php';
require_once __DIR__ . '/routes/reviews.php';
require_once __DIR__ . '/routes/uploads.php';
require_once __DIR__ . '/routes/admin_stats.php';
require_once __DIR__ . '/routes/admin_orders.php';
require_once __DIR__ . '/routes/admin_users.php';
require_once __DIR__ . '/routes/admin_reviews.php';
require_once __DIR__ . '/routes/admin_catalog.php';
require_once __DIR__ . '/routes/admin_marketing.php';

apply_cors();

/**
 * The app can be mounted at /api (Apache/xampp) or at the docroot (/api/...).
 * Either way, take everything from the /api segment onwards.
 */
function request_path(): string
{
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $position = strpos($uri, '/api');

    if ($position !== false) {
        $uri = substr($uri, $position);
    }

    $uri = rtrim($uri, '/');
    return $uri === '' ? '/' : $uri;
}

$router = new Router();

$router->get('/api/health', function (): void {
    $database = 'up';

    try {
        $ok = Db::ping();
        if (!$ok) {
            $database = 'down';
        }
    } catch (Throwable $error) {
        $database = 'down';
    }

    send_json([
        'success' => $database === 'up',
        'data' => [
            'status' => $database === 'up' ? 'ok' : 'degraded',
            'database' => $database,
            'env' => config('env'),
            'runtime' => 'php ' . PHP_VERSION,
            'timestamp' => gmdate('Y-m-d\TH:i:s.000\Z'),
        ],
    ], $database === 'up' ? 200 : 503);
});

register_public_routes($router);
register_auth_routes($router);
register_address_routes($router);
register_favourite_routes($router);
register_order_routes($router);
register_review_routes($router);
register_upload_routes($router);
register_admin_stats_routes($router);
register_admin_order_routes($router);
register_admin_user_routes($router);
register_admin_review_routes($router);
register_admin_catalog_routes($router);
register_admin_marketing_routes($router);

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = request_path();

if (!$router->dispatch($method, $path)) {
    send_error(404, 'Route ' . $method . ' ' . $path . ' does not exist', 'NOT_FOUND');
}
