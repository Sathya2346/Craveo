<?php

declare(strict_types=1);

const MAX_ADDRESSES = 10;

function address_rules(bool $partial = false): array
{
    return [
        'label' => $partial ? 'string|min:1|max:40' : 'string|min:1|max:40|default:Home',
        'contactName' => ($partial ? '' : 'required|') . 'string|min:2|max:100',
        'phone' => ($partial ? '' : 'required|') . 'phone',
        'line1' => ($partial ? '' : 'required|') . 'string|min:5|max:255',
        'line2' => 'nullable|string|max:255',
        'city' => ($partial ? '' : 'required|') . 'string|min:2|max:80',
        'state' => 'nullable|string|max:80',
        'pincode' => ($partial ? '' : 'required|') . 'pincode',
        'isDefault' => 'bool',
    ];
}

function register_address_routes(Router $router): void
{
    $auth = auth_middleware();

    $router->get('/api/addresses', function (): void {
        $user = Auth::user();
        $rows = Db::q(
            'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC',
            [$user['id']]
        );

        ok(array_map('map_address', $rows));
    }, [$auth]);

    $router->post('/api/addresses', function (): void {
        $user = Auth::user();
        $data = Validator::validate(json_body(), address_rules());

        $count = Db::one('SELECT COUNT(*) AS total FROM addresses WHERE user_id = ?', [$user['id']]);
        $total = (int) ($count['total'] ?? 0);
        if ($total >= MAX_ADDRESSES) {
            bad_request('You can save up to ' . MAX_ADDRESSES . ' addresses. Delete one first.');
        }

        $shouldDefault = !empty($data['isDefault']) || $total === 0;
        if ($shouldDefault) {
            Db::exec('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [$user['id']]);
        }

        $result = Db::exec(
            'INSERT INTO addresses (user_id, label, contact_name, phone, line1, line2, city, state, pincode, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $user['id'],
                $data['label'] ?? 'Home',
                $data['contactName'],
                $data['phone'],
                $data['line1'],
                $data['line2'] ?? null,
                $data['city'],
                $data['state'] ?? null,
                $data['pincode'],
                $shouldDefault ? 1 : 0,
            ]
        );

        $row = Db::one('SELECT * FROM addresses WHERE id = ?', [$result['insertId']]);
        ok(map_address($row), ['message' => 'Address saved'], 201);
    }, [$auth]);

    $router->patch('/api/addresses/:id', function (array $params): void {
        $user = Auth::user();
        $id = (int) $params['id'];
        if ($id <= 0) {
            not_found('Address not found');
        }

        $existing = Db::one('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [$id, $user['id']]);
        if ($existing === null) {
            not_found('Address not found');
        }

        $data = Validator::validate(json_body(), address_rules(true));

        // camelCase payload key -> snake_case column
        $columnMap = [
            'label' => 'label',
            'contact_name' => 'contactName',
            'phone' => 'phone',
            'line1' => 'line1',
            'line2' => 'line2',
            'city' => 'city',
            'state' => 'state',
            'pincode' => 'pincode',
        ];

        $updates = [];
        foreach ($columnMap as $column => $key) {
            if (!array_key_exists($key, $data)) {
                continue;
            }
            $updates[$column] = $data[$key] === '' ? null : $data[$key];
        }

        if ($updates === [] && !array_key_exists('isDefault', $data)) {
            bad_request('Nothing to update');
        }

        if (!empty($data['isDefault'])) {
            Db::exec('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [$user['id']]);
        }

        if ($updates !== []) {
            $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($updates)));
            $values = array_values($updates);
            $values[] = $id;
            $values[] = $user['id'];
            Db::exec("UPDATE addresses SET $assignments WHERE id = ? AND user_id = ?", $values);
        }

        if (array_key_exists('isDefault', $data)) {
            Db::exec('UPDATE addresses SET is_default = ? WHERE id = ? AND user_id = ?', [
                !empty($data['isDefault']) ? 1 : 0,
                $id,
                $user['id'],
            ]);
        }

        $row = Db::one('SELECT * FROM addresses WHERE id = ?', [$id]);
        ok(map_address($row), ['message' => 'Address updated']);
    }, [$auth]);

    $router->delete('/api/addresses/:id', function (array $params): void {
        $user = Auth::user();
        $id = (int) $params['id'];
        if ($id <= 0) {
            not_found('Address not found');
        }

        $existing = Db::one('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [$id, $user['id']]);
        if ($existing === null) {
            not_found('Address not found');
        }

        Db::exec('DELETE FROM addresses WHERE id = ? AND user_id = ?', [$id, $user['id']]);

        if (as_bool($existing['is_default'])) {
            $next = Db::one(
                'SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1',
                [$user['id']]
            );
            if ($next !== null) {
                Db::exec('UPDATE addresses SET is_default = 1 WHERE id = ?', [(int) $next['id']]);
            }
        }

        ok(null, ['message' => 'Address removed']);
    }, [$auth]);
}
