<?php

declare(strict_types=1);

function count_active_admins(?int $excludeId = null): int
{
    $row = $excludeId !== null
        ? Db::one(
            "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND is_active = 1 AND id <> ?",
            [$excludeId]
        )
        : Db::one("SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND is_active = 1");

    return (int) ($row['total'] ?? 0);
}

function register_admin_user_routes(Router $router): void
{
    $staff = staff_middleware();
    $admin = admin_middleware();
    $userColumns = 'id, name, email, phone, role, avatar_url, is_active, created_at';

    $router->get('/api/admin/users', function () use ($userColumns): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:50|default:10',
            'search' => 'string|max:80',
            'role' => 'in:CUSTOMER,MANAGER,ADMIN',
            'status' => 'in:all,active,inactive|default:all',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['1 = 1'];
        $params = [];

        if (!empty($q['search'])) {
            $where[] = '(name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $like = like_term((string) $q['search']);
            array_push($params, $like, $like, $like);
        }
        if (!empty($q['role'])) {
            $where[] = 'role = ?';
            $params[] = $q['role'];
        }
        if (($q['status'] ?? 'all') !== 'all') {
            $where[] = 'is_active = ?';
            $params[] = $q['status'] === 'active' ? 1 : 0;
        }

        $whereSql = implode(' AND ', $where);

        $rows = Db::q(
            "SELECT $userColumns,
               (SELECT COUNT(*) FROM orders o WHERE o.user_id = users.id) AS order_count,
               (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = users.id AND o.status = 'DELIVERED') AS total_spent
             FROM users WHERE $whereSql ORDER BY created_at DESC" . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one("SELECT COUNT(*) AS total FROM users WHERE $whereSql", $params);
        $roleRows = Db::q('SELECT role, COUNT(*) AS total FROM users GROUP BY role');
        $withoutOrders = Db::one(
            'SELECT COUNT(*) AS total FROM users u
             WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)'
        );

        $roleCounts = [];
        foreach ($roleRows as $row) {
            $roleCounts[$row['role']] = (int) $row['total'];
        }

        $items = array_map(static function (array $row): array {
            $mapped = map_user($row);
            $mapped['orderCount'] = (int) $row['order_count'];
            $mapped['totalSpent'] = (float) $row['total_spent'];
            return $mapped;
        }, $rows);

        ok($items, [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
            'summary' => [
                'roleCounts' => $roleCounts,
                'withoutOrders' => (int) ($withoutOrders['total'] ?? 0),
            ],
        ]);
    }, [$staff]);

    $router->post('/api/admin/users', function () use ($userColumns): void {
        $data = Validator::validate(json_body(), [
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|email|lower|max:190',
            'password' => 'required|string|min:6|max:72',
            'phone' => 'nullable|string|max:20',
            'role' => 'in:CUSTOMER,MANAGER,ADMIN|default:CUSTOMER',
        ]);

        $existing = Db::one('SELECT id FROM users WHERE email = ?', [$data['email']]);
        if ($existing !== null) {
            conflict('An account with this email already exists', ['field' => 'email']);
        }

        $hash = password_hash((string) $data['password'], PASSWORD_BCRYPT, ['cost' => 10]);
        $role = (string) ($data['role'] ?? 'CUSTOMER');

        $result = Db::exec(
            'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [$data['name'], $data['email'], ($data['phone'] ?? null) ?: null, $hash, $role]
        );

        $row = Db::one("SELECT $userColumns FROM users WHERE id = ?", [$result['insertId']]);
        ok(map_user($row), ['message' => $role . ' account created'], 201);
    }, [$admin]);

    $router->patch('/api/admin/users/:id', function (array $params) use ($userColumns): void {
        $id = (int) $params['id'];
        $target = Db::one("SELECT $userColumns FROM users WHERE id = ?", [$id]);
        if ($target === null) {
            not_found('User not found');
        }

        $data = Validator::validate(json_body(), [
            'name' => 'string|min:2|max:100',
            'phone' => 'nullable|string|max:20',
            'role' => 'in:CUSTOMER,MANAGER,ADMIN',
            'isActive' => 'bool',
            'password' => 'string|min:6|max:72',
        ]);

        $current = Auth::user();
        $isSelf = $id === (int) $current['id'];

        if ($isSelf && isset($data['role']) && $data['role'] !== $target['role']) {
            forbidden('You cannot change your own role. Ask another admin.');
        }
        if ($isSelf && array_key_exists('isActive', $data) && $data['isActive'] === false) {
            forbidden('You cannot deactivate your own account.');
        }
        if (isset($data['role']) && $target['role'] === 'ADMIN' && $data['role'] !== 'ADMIN') {
            if (count_active_admins($id) === 0) {
                conflict('At least one active admin must remain.');
            }
        }
        if (array_key_exists('isActive', $data) && $data['isActive'] === false && $target['role'] === 'ADMIN') {
            if (count_active_admins($id) === 0) {
                conflict('At least one active admin must remain.');
            }
        }

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
        if (array_key_exists('role', $data)) {
            $updates[] = 'role = ?';
            $values[] = $data['role'];
        }
        if (array_key_exists('isActive', $data)) {
            $updates[] = 'is_active = ?';
            $values[] = $data['isActive'] ? 1 : 0;
        }
        if (array_key_exists('password', $data)) {
            $updates[] = 'password_hash = ?';
            $values[] = password_hash((string) $data['password'], PASSWORD_BCRYPT, ['cost' => 10]);
        }

        if ($updates === []) {
            bad_request('Nothing to update');
        }

        $values[] = $id;
        Db::exec('UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?', $values);

        $row = Db::one("SELECT $userColumns FROM users WHERE id = ?", [$id]);
        ok(map_user($row), ['message' => 'User updated']);
    }, [$admin]);

    $router->delete('/api/admin/users/:id', function (array $params): void {
        $id = (int) $params['id'];
        $current = Auth::user();

        if ($id === (int) $current['id']) {
            forbidden('You cannot delete your own account.');
        }

        $target = Db::one('SELECT id, role FROM users WHERE id = ?', [$id]);
        if ($target === null) {
            not_found('User not found');
        }

        if ($target['role'] === 'ADMIN' && count_active_admins($id) === 0) {
            conflict('At least one active admin must remain.');
        }

        $orders = Db::one('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [$id]);
        if ((int) ($orders['total'] ?? 0) > 0) {
            conflict(
                'This customer has ' . $orders['total']
                . ' order(s). Deactivate the account instead of deleting it.'
            );
        }

        Db::exec('DELETE FROM users WHERE id = ?', [$id]);
        ok(null, ['message' => 'User deleted']);
    }, [$admin]);
}
