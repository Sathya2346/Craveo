<?php

declare(strict_types=1);

require_once __DIR__ . '/mappers.php';

const PUBLIC_USER_COLUMNS = 'id, name, email, phone, role, avatar_url, is_active, created_at';

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp((string) $name, 'Authorization') === 0) {
                $header = (string) $value;
                break;
            }
        }
    }

    if (stripos($header, 'Bearer ') !== 0) {
        return null;
    }

    $token = trim(substr($header, 7));
    return $token === '' ? null : $token;
}

final class Auth
{
    private static ?array $user = null;
    private static bool $resolved = false;

    /** Resolves the token to a user without throwing (anonymous requests). */
    public static function optional(): ?array
    {
        if (self::$resolved) {
            return self::$user;
        }
        self::$resolved = true;

        $token = bearer_token();
        if ($token === null) {
            return null;
        }

        $claims = jwt_verify($token, (string) config('jwt.secret'));
        if ($claims === null || !isset($claims['sub'])) {
            return null;
        }

        $row = Db::one(
            'SELECT ' . PUBLIC_USER_COLUMNS . ' FROM users WHERE id = ? LIMIT 1',
            [(int) $claims['sub']]
        );

        if ($row !== null && as_bool($row['is_active'])) {
            self::$user = map_user($row);
        }

        return self::$user;
    }

    /** Requires a valid token for an active account. */
    public static function user(): array
    {
        $token = bearer_token();
        if ($token === null) {
            unauthorized();
        }

        $claims = jwt_verify($token, (string) config('jwt.secret'));
        if ($claims === null || !isset($claims['sub'])) {
            unauthorized('Your session has expired, please sign in again');
        }

        $row = Db::one(
            'SELECT ' . PUBLIC_USER_COLUMNS . ' FROM users WHERE id = ? LIMIT 1',
            [(int) $claims['sub']]
        );

        if ($row === null) {
            unauthorized('This account no longer exists');
        }
        if (!as_bool($row['is_active'])) {
            forbidden('This account has been deactivated');
        }

        self::$user = map_user($row);
        self::$resolved = true;

        return self::$user;
    }

    /** Role gate used as route middleware. */
    public static function requireRole(string ...$roles): array
    {
        $user = self::user();
        if (!in_array($user['role'], $roles, true)) {
            forbidden();
        }
        return $user;
    }
}

/** Middleware factories, mirroring requireAuth / requireStaff / requireAdmin. */
function auth_middleware(): callable
{
    return static function (): void {
        Auth::user();
    };
}

function staff_middleware(): callable
{
    return static function (): void {
        Auth::requireRole('ADMIN', 'MANAGER');
    };
}

function admin_middleware(): callable
{
    return static function (): void {
        Auth::requireRole('ADMIN');
    };
}
