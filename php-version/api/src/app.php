<?php

declare(strict_types=1);

$__config = require dirname(__DIR__) . '/config.php';
$GLOBALS['__config'] = $__config;

/** Dot-path config access: config('db.host'). */
function config(string $path, mixed $default = null): mixed
{
    $value = $GLOBALS['__config'] ?? [];
    foreach (explode('.', $path) as $segment) {
        if (!is_array($value) || !array_key_exists($segment, $value)) {
            return $default;
        }
        $value = $value[$segment];
    }
    return $value;
}

date_default_timezone_set((string) config('timezone', 'UTC'));

// A JSON API must never print warnings into the response body: log them instead.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/validate.php';
require_once __DIR__ . '/router.php';
require_once __DIR__ . '/mappers.php';
require_once __DIR__ . '/ratelimit.php';
require_once __DIR__ . '/auth.php';

require_once __DIR__ . '/services/settings.php';
require_once __DIR__ . '/services/coupon.php';
require_once __DIR__ . '/services/orders.php';

Db::configure((array) config('db'));

/** CORS: explicit allowlist in production, localhost/LAN allowed in development. */
function apply_cors(): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    $allowedOrigins = (array) config('client_origins', []);
    $isProduction = config('env') === 'production';

    $allowed = $origin === ''
        || in_array($origin, $allowedOrigins, true)
        || (!$isProduction && preg_match('#^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d{2,5})?$#', $origin) === 1)
        || (!$isProduction && preg_match('#^https?://(192\.168|10)\.\d{1,3}\.\d{1,3}(:\d{2,5})?$#', $origin) === 1);

    if ($allowed && $origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: false');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
        header('Access-Control-Max-Age: 86400');
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Maps PDO/MySQL failures onto the same codes the Node error handler uses. */
function handle_uncaught(Throwable $error): void
{
    $debug = (bool) config('debug', false);

    if ($error instanceof ApiException) {
        send_error($error->status, $error->getMessage(), $error->errorCode, $error->details);
        return;
    }

    if ($error instanceof PDOException) {
        $driverCode = (int) ($error->errorInfo[1] ?? 0);

        [$status, $code, $message] = match ($driverCode) {
            1062 => [409, 'DUPLICATE', 'That value already exists'],
            1451 => [409, 'IN_USE', 'This record is used by other data. Remove those first.'],
            1452 => [400, 'INVALID_REFERENCE', 'A linked record does not exist'],
            1406 => [400, 'TOO_LONG', 'One of the values is too long'],
            default => [0, '', ''],
        };

        if ($status === 0 && str_contains($error->getMessage(), '2002')) {
            [$status, $code, $message] = [503, 'DB_UNAVAILABLE', 'The database is unreachable. Is MySQL running?'];
        }

        if ($status !== 0) {
            send_error($status, $message, $code, $debug ? ['sqlMessage' => $error->getMessage()] : null);
            return;
        }
    }

    error_log('[api] ' . get_class($error) . ': ' . $error->getMessage() . "\n" . $error->getTraceAsString());
    send_error(
        500,
        $debug ? $error->getMessage() : 'Something went wrong on our side',
        'INTERNAL_ERROR',
        $debug ? ['trace' => array_slice(explode("\n", $error->getTraceAsString()), 0, 5)] : null
    );
}

set_exception_handler('handle_uncaught');

/** Escapes a value for safe use inside a LIKE clause. */
function like_escape(string $value): string
{
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
}
