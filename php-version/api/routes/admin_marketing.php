<?php

declare(strict_types=1);

function register_admin_marketing_routes(Router $router): void
{
    $staff = staff_middleware();
    $admin = admin_middleware();

    /* --------------------------------- banners -------------------------------- */

    $bannerColumns = [
        'title' => 'title',
        'subtitle' => 'subtitle',
        'imageUrl' => 'image_url',
        'ctaLabel' => 'cta_label',
        'ctaLink' => 'cta_link',
        'accent' => 'accent',
        'sortOrder' => 'sort_order',
        'isActive' => 'is_active',
    ];

    $bannerRules = [
        'title' => 'required|string|min:2|max:120',
        'subtitle' => 'nullable|string|max:255',
        'imageUrl' => 'nullable|imageUrl|max:500',
        'ctaLabel' => 'nullable|string|max:40',
        'ctaLink' => 'nullable|string|max:255',
        'accent' => 'hex',
        'sortOrder' => 'int|min:0|max:9999',
        'isActive' => 'bool',
    ];

    $router->get('/api/admin/banners', function (): void {
        $rows = Db::q('SELECT * FROM banners ORDER BY sort_order ASC, id ASC');
        ok(array_map('map_banner', $rows));
    }, [$staff]);

    $router->post('/api/admin/banners', function () use ($bannerRules, $bannerColumns): void {
        $payload = Validator::validate(json_body(), $bannerRules);
        $data = build_update($payload, $bannerColumns);

        $columns = array_keys($data);
        $values = array_values($data);
        $result = Db::exec(
            'INSERT INTO banners (' . implode(', ', $columns) . ') VALUES (' . placeholders($values) . ')',
            $values
        );

        $row = Db::one('SELECT * FROM banners WHERE id = ?', [$result['insertId']]);
        ok(map_banner($row), ['message' => 'Banner added'], 201);
    }, [$staff]);

    $router->patch('/api/admin/banners/:id', function (array $params) use ($bannerRules, $bannerColumns): void {
        $id = (int) $params['id'];
        $payload = Validator::validate(json_body(), partial_rules($bannerRules));
        $data = build_update($payload, $bannerColumns);

        run_update('banners', $id, $data, 'Banner updated');

        $row = Db::one('SELECT * FROM banners WHERE id = ?', [$id]);
        ok(map_banner($row), ['message' => 'Banner updated']);
    }, [$staff]);

    $router->delete('/api/admin/banners/:id', function (array $params): void {
        $id = (int) $params['id'];
        $result = Db::exec('DELETE FROM banners WHERE id = ?', [$id]);
        if ($result['affected'] === 0) {
            not_found('Banner not found');
        }
        ok(null, ['message' => 'Banner deleted']);
    }, [$staff]);

    /* --------------------------------- coupons -------------------------------- */

    $couponColumns = [
        'code' => 'code',
        'description' => 'description',
        'discountType' => 'discount_type',
        'discountValue' => 'discount_value',
        'minOrderValue' => 'min_order_value',
        'maxDiscount' => 'max_discount',
        'usageLimit' => 'usage_limit',
        'perUserLimit' => 'per_user_limit',
        'startsAt' => 'starts_at',
        'expiresAt' => 'expires_at',
        'isActive' => 'is_active',
    ];

    $couponRules = [
        'code' => 'required|string|min:3|max:30|regex:/^[A-Z0-9_-]+$/',
        'description' => 'nullable|string|max:255',
        'discountType' => 'in:PERCENT,FLAT|default:PERCENT',
        'discountValue' => 'required|float|positive|max:100000',
        'minOrderValue' => 'float|min:0|max:100000',
        'maxDiscount' => 'nullable|float|min:0|max:100000',
        'usageLimit' => 'nullable|int|min:1|max:1000000',
        'perUserLimit' => 'int|min:1|max:100',
        'startsAt' => 'nullable|datetime|max:40',
        'expiresAt' => 'nullable|datetime|max:40',
        'isActive' => 'bool',
    ];

    $router->get('/api/admin/coupons', function (): void {
        $q = Validator::query([
            'page' => 'int|min:1|max:10000|default:1',
            'limit' => 'int|min:1|max:60|default:20',
            'search' => 'string|max:40',
            'status' => 'in:all,active,inactive|default:all',
        ]);

        $paging = paginate($q['page'], $q['limit']);
        $page = (int) $paging['page'];
        $limit = (int) $q['limit'];

        $where = ['1 = 1'];
        $params = [];
        if (!empty($q['search'])) {
            $where[] = 'code LIKE ?';
            $params[] = '%' . strtoupper((string) $q['search']) . '%';
        }
        if (($q['status'] ?? 'all') !== 'all') {
            $where[] = 'is_active = ?';
            $params[] = $q['status'] === 'active' ? 1 : 0;
        }
        $whereSql = implode(' AND ', $where);

        $rows = Db::q(
            "SELECT * FROM coupons WHERE $whereSql ORDER BY id DESC" . limit_clause($limit, (int) $paging['offset']),
            $params
        );
        $total = Db::one("SELECT COUNT(*) AS total FROM coupons WHERE $whereSql", $params);

        ok(array_map('map_coupon', $rows), [
            'meta' => pagination_meta($total['total'] ?? 0, $page, $limit),
        ]);
    }, [$staff]);

    $router->post('/api/admin/coupons', function () use ($couponRules, $couponColumns): void {
        $payload = Validator::validate(json_body(), $couponRules);
        $payload['code'] = strtoupper((string) $payload['code']);

        if (($payload['discountType'] ?? 'PERCENT') === 'PERCENT' && (float) $payload['discountValue'] > 100) {
            bad_request('Percentage discount cannot exceed 100', [['field' => 'discountValue']]);
        }
        if (!empty($payload['startsAt']) && !empty($payload['expiresAt'])
            && strtotime((string) $payload['startsAt']) >= strtotime((string) $payload['expiresAt'])) {
            bad_request('End date must be after start date', [['field' => 'expiresAt']]);
        }

        $data = build_update($payload, $couponColumns);
        $data['starts_at'] = to_mysql_datetime($payload['startsAt'] ?? null);
        $data['expires_at'] = to_mysql_datetime($payload['expiresAt'] ?? null);

        $existing = Db::one('SELECT id FROM coupons WHERE code = ?', [$payload['code']]);
        if ($existing !== null) {
            conflict('A coupon with this code already exists', ['field' => 'code']);
        }

        $columns = array_keys($data);
        $values = array_values($data);
        $result = Db::exec(
            'INSERT INTO coupons (' . implode(', ', $columns) . ') VALUES (' . placeholders($values) . ')',
            $values
        );

        $row = Db::one('SELECT * FROM coupons WHERE id = ?', [$result['insertId']]);
        ok(map_coupon($row), ['message' => 'Coupon created'], 201);
    }, [$staff]);

    $router->patch('/api/admin/coupons/:id', function (array $params) use ($couponRules, $couponColumns): void {
        $id = (int) $params['id'];
        $existing = Db::one('SELECT * FROM coupons WHERE id = ?', [$id]);
        if ($existing === null) {
            not_found('Coupon not found');
        }

        $payload = Validator::validate(json_body(), partial_rules($couponRules));
        if (isset($payload['code'])) {
            $payload['code'] = strtoupper((string) $payload['code']);
        }

        $data = build_update($payload, $couponColumns);
        if (array_key_exists('startsAt', $payload)) {
            $data['starts_at'] = to_mysql_datetime($payload['startsAt']);
        }
        if (array_key_exists('expiresAt', $payload)) {
            $data['expires_at'] = to_mysql_datetime($payload['expiresAt']);
        }

        if (!empty($payload['code']) && $payload['code'] !== $existing['code']) {
            $clash = Db::one('SELECT id FROM coupons WHERE code = ? AND id <> ?', [$payload['code'], $id]);
            if ($clash !== null) {
                conflict('A coupon with this code already exists', ['field' => 'code']);
            }
        }

        $nextType = $payload['discountType'] ?? $existing['discount_type'];
        $nextValue = (float) ($payload['discountValue'] ?? $existing['discount_value']);
        if ($nextType === 'PERCENT' && $nextValue > 100) {
            bad_request('Percentage discount cannot exceed 100', [['field' => 'discountValue']]);
        }

        $nextStarts = array_key_exists('startsAt', $payload) ? $payload['startsAt'] : $existing['starts_at'];
        $nextExpires = array_key_exists('expiresAt', $payload) ? $payload['expiresAt'] : $existing['expires_at'];
        if (!empty($nextStarts) && !empty($nextExpires)
            && strtotime((string) $nextStarts) >= strtotime((string) $nextExpires)) {
            bad_request('End date must be after start date', [['field' => 'expiresAt']]);
        }

        if ($data === []) {
            bad_request('Nothing to update');
        }

        $assignments = implode(', ', array_map(static fn (string $column): string => $column . ' = ?', array_keys($data)));
        $values = array_values($data);
        $values[] = $id;
        Db::exec("UPDATE coupons SET $assignments WHERE id = ?", $values);

        $row = Db::one('SELECT * FROM coupons WHERE id = ?', [$id]);
        ok(map_coupon($row), ['message' => 'Coupon updated']);
    }, [$staff]);

    $router->delete('/api/admin/coupons/:id', function (array $params): void {
        $id = (int) $params['id'];
        $existing = Db::one('SELECT id FROM coupons WHERE id = ?', [$id]);
        if ($existing === null) {
            not_found('Coupon not found');
        }

        $used = Db::one('SELECT COUNT(*) AS total FROM orders WHERE coupon_id = ?', [$id]);
        if ((int) ($used['total'] ?? 0) > 0) {
            conflict(
                'This coupon was used in ' . $used['total']
                . ' order(s). Deactivate it instead of deleting it.'
            );
        }

        Db::exec('DELETE FROM coupons WHERE id = ?', [$id]);
        ok(null, ['message' => 'Coupon deleted']);
    }, [$staff]);

    /* -------------------------------- settings -------------------------------- */

    $router->get('/api/admin/settings', function (): void {
        ok(get_settings(), ['meta' => ['editableKeys' => setting_keys()]]);
    }, [$staff]);

    $router->put('/api/admin/settings', function (): void {
        $body = json_body();
        $values = $body['values'] ?? null;

        if (!is_array($values)) {
            bad_request('Please check the highlighted fields', [
                ['field' => 'values', 'message' => 'values is required'],
            ]);
        }

        $allowed = setting_keys();
        foreach ($values as $key => $value) {
            if (!in_array($key, $allowed, true)) {
                bad_request('One of the settings keys is not editable', [
                    ['field' => 'values', 'message' => 'One of the settings keys is not editable'],
                ]);
            }
            if (is_array($value) || mb_strlen((string) $value) > 2000) {
                bad_request('Please check the highlighted fields', [
                    ['field' => 'values', 'message' => 'Setting values must be text under 2000 characters'],
                ]);
            }
        }

        if ($values === []) {
            bad_request('Nothing to save');
        }

        foreach ($values as $key => $value) {
            Db::exec(
                'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
                [$key, (string) ($value ?? '')]
            );
        }

        ok(get_settings(), ['message' => 'Settings saved']);
    }, [$admin]);

    $router->post('/api/admin/settings/reset', function (): void {
        foreach (CRAVEO_DEFAULT_SETTINGS as $key => $value) {
            Db::exec(
                'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
                [$key, $value]
            );
        }

        ok(get_settings(), ['message' => 'Settings restored to defaults']);
    }, [$admin]);
}
