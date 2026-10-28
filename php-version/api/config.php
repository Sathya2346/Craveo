<?php

declare(strict_types=1);

require_once __DIR__ . '/src/env.php';

$root = dirname(__DIR__);
load_env_file($root . '/api/.env');
load_env_file($root . '/.env');

$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CLIENT_ORIGIN', 'http://localhost:5173'))
)));

return [
    'env' => env('APP_ENV', env('NODE_ENV', 'development')),
    'debug' => env_bool('APP_DEBUG', env('APP_ENV', 'development') !== 'production'),
    'timezone' => 'UTC',
    'db' => [
        'host' => (string) env('DB_HOST', '127.0.0.1'),
        'port' => (int) env('DB_PORT', '3306'),
        'user' => (string) env('DB_USER', 'root'),
        'password' => (string) env('DB_PASSWORD', ''),
        'name' => (string) env('DB_NAME', 'craveo'),
        'ssl' => env_bool('DB_SSL', false),
    ],
    'jwt' => [
        'secret' => (string) env('JWT_SECRET', 'craveo-php-dev-secret-change-me'),
        'expires_in' => (string) env('JWT_EXPIRES_IN', '7d'),
    ],
    'client_origins' => $origins,
    'uploads_dir' => $root . '/uploads',
    'uploads_url' => '/uploads',
    'max_upload_bytes' => ((int) env('MAX_UPLOAD_MB', '5')) * 1024 * 1024,
];
