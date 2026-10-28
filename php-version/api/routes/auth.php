<?php

declare(strict_types=1);

const AUTH_PUBLIC_COLUMNS = 'id, name, email, phone, role, avatar_url, is_active, created_at';

function password_ok(string $password, string $hash): bool
{
    if (password_verify($password, $hash)) {
        return true;
    }

    // bcryptjs hashes can carry a $2b$ prefix; PHP's verifier wants $2y$.
    if (str_starts_with($hash, '$2b$')) {
        return password_verify($password, '$2y$' . substr($hash, 4));
    }

    return false;
}

function issue_token(array $user): string
{
    return jwt_sign(
        ['sub' => (string) $user['id'], 'role' => $user['role']],
        (string) config('jwt.secret'),
        (string) config('jwt.expires_in')
    );
}

function register_auth_routes(Router $router): void
{
    $router->post('/api/auth/register', function (): void {
        rate_limit('register', 20, 3600);

        $data = Validator::validate(json_body(), [
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|email|lower|min:5|max:190',
            'password' => 'required|string|min:6|max:72',
            'phone' => 'nullable|phone',
        ], [
            'name' => 'Name must be at least 2 characters',
            'password' => 'Password must be at least 6 characters',
        ]);

        $existing = Db::one('SELECT id FROM users WHERE email = ? LIMIT 1', [$data['email']]);
        if ($existing !== null) {
            conflict('An account with this email already exists', ['field' => 'email']);
        }

        $hash = password_hash((string) $data['password'], PASSWORD_BCRYPT, ['cost' => 10]);
        $result = Db::exec(
            "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'CUSTOMER')",
            [$data['name'], $data['email'], $data['phone'] ?? null, $hash]
        );

        $row = Db::one('SELECT ' . AUTH_PUBLIC_COLUMNS . ' FROM users WHERE id = ?', [$result['insertId']]);
        $user = map_user($row);

        ok(
            ['user' => $user, 'token' => issue_token($row)],
            ['message' => 'Welcome to Craveo, ' . explode(' ', $user['name'])[0] . '!'],
            201
        );
    });

    $router->post('/api/auth/login', function (): void {
        rate_limit('login', 30, 900);

        $data = Validator::validate(json_body(), [
            'email' => 'required|email|lower|max:190',
            'password' => 'required|string|max:72',
        ], [
            'password' => 'Password is required',
        ]);

        $user = Db::one('SELECT * FROM users WHERE email = ? LIMIT 1', [$data['email']]);

        // Same message for unknown email and wrong password: no account enumeration.
        if ($user === null || !password_ok((string) $data['password'], (string) $user['password_hash'])) {
            unauthorized('Email or password is incorrect');
        }
        if (!as_bool($user['is_active'])) {
            unauthorized('This account has been deactivated. Contact support.');
        }

        ok([
            'user' => map_user($user),
            'token' => issue_token($user),
        ], [
            'message' => 'Welcome back, ' . explode(' ', (string) $user['name'])[0] . '!',
        ]);
    });

    $router->get('/api/auth/me', function (): void {
        $user = Auth::user();

        $orderStats = Db::one(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered
             FROM orders WHERE user_id = ?",
            [$user['id']]
        );
        $addressCount = Db::one('SELECT COUNT(*) AS total FROM addresses WHERE user_id = ?', [$user['id']]);
        $favouriteCount = Db::one('SELECT COUNT(*) AS total FROM favourites WHERE user_id = ?', [$user['id']]);

        ok([
            'user' => $user,
            'stats' => [
                'orders' => (int) ($orderStats['total'] ?? 0),
                'delivered' => (int) ($orderStats['delivered'] ?? 0),
                'addresses' => (int) ($addressCount['total'] ?? 0),
                'favourites' => (int) ($favouriteCount['total'] ?? 0),
            ],
        ]);
    }, [auth_middleware()]);

    $router->patch('/api/auth/me', function (): void {
        $user = Auth::user();

        $data = Validator::validate(json_body(), [
            'name' => 'string|min:2|max:100',
            'phone' => 'nullable|phone',
            'avatarUrl' => 'nullable|imageUrl|max:500',
        ]);

        $updates = [];
        $values = [];

        if (array_key_exists('name', $data)) {
            $updates[] = 'name = ?';
            $values[] = $data['name'];
        }
        if (array_key_exists('phone', $data)) {
            $updates[] = 'phone = ?';
            $values[] = $data['phone'] ?: null;
        }
        if (array_key_exists('avatarUrl', $data)) {
            $updates[] = 'avatar_url = ?';
            $values[] = $data['avatarUrl'] ?: null;
        }

        if ($updates === []) {
            bad_request('Nothing to update');
        }

        $values[] = $user['id'];
        Db::exec('UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?', $values);

        $row = Db::one('SELECT ' . AUTH_PUBLIC_COLUMNS . ' FROM users WHERE id = ?', [$user['id']]);
        ok(['user' => map_user($row)], ['message' => 'Profile updated']);
    }, [auth_middleware()]);

    $router->patch('/api/auth/password', function (): void {
        $user = Auth::user();

        $data = Validator::validate(json_body(), [
            'currentPassword' => 'required|string',
            'newPassword' => 'required|string|min:6|max:72',
        ], [
            'currentPassword' => 'Current password is required',
            'newPassword' => 'Password must be at least 6 characters',
        ]);

        if ($data['currentPassword'] === $data['newPassword']) {
            bad_request('New password must be different from the current one');
        }

        $row = Db::one('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
        if ($row === null || !password_ok((string) $data['currentPassword'], (string) $row['password_hash'])) {
            bad_request('Current password is incorrect', [['field' => 'currentPassword']]);
        }

        $hash = password_hash((string) $data['newPassword'], PASSWORD_BCRYPT, ['cost' => 10]);
        Db::exec('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $user['id']]);

        ok(null, ['message' => 'Password updated successfully']);
    }, [auth_middleware()]);

    $router->post('/api/auth/logout', function (): void {
        // JWTs are stateless: the client drops the token. Kept for a clean API shape.
        ok(null, ['message' => 'Signed out']);
    });

    $router->get('/api/auth/check-email', function (): void {
        $q = Validator::query([
            'email' => 'required|email|lower|min:5|max:190',
        ]);

        $row = Db::one('SELECT id FROM users WHERE email = ? LIMIT 1', [$q['email']]);
        ok(['available' => $row === null]);
    });
}
