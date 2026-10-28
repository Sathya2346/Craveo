<?php

declare(strict_types=1);

/**
 * Router for PHP's built-in server:
 *   php -S localhost:8000 -t php-version php-version/router.php
 *
 * /api/*          -> api/index.php
 * /uploads/*      -> served from disk
 * anything else   -> the built React app in web/dist when it exists
 */

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (str_starts_with($path, '/api')) {
    require __DIR__ . '/api/index.php';
    return true;
}

$absolute = __DIR__ . $path;
if ($path !== '/' && is_file($absolute)) {
    return false; // let the built-in server stream the file
}

$spaIndex = __DIR__ . '/web/dist/index.html';
if (is_file($spaIndex)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($spaIndex);
    return true;
}

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success' => false,
    'error' => [
        'code' => 'NOT_FOUND',
        'message' => 'Route ' . ($_SERVER['REQUEST_METHOD'] ?? 'GET') . ' ' . $path . ' does not exist',
    ],
]);

return true;
