<?php

declare(strict_types=1);

/** Shared helpers: money, slugs, pagination, dates, base36 order numbers. */

function round2(mixed $value): float
{
    return round((float) $value, 2);
}

function money(mixed $value): float
{
    return is_numeric($value) ? round2($value) : 0.0;
}

function as_bool(mixed $value): bool
{
    return (bool) (int) ($value ?? 0);
}

function as_int(mixed $value): int
{
    return (int) ($value ?? 0);
}

function nullable_float(mixed $value): ?float
{
    return ($value === null || $value === '') ? null : (float) $value;
}

function slugify(string $value): string
{
    $slug = strtolower(trim($value));
    $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug) ?? '';
    $slug = preg_replace('/\s+/', '-', $slug) ?? '';
    $slug = preg_replace('/-+/', '-', $slug) ?? '';
    return substr($slug, 0, 120);
}

/** CRV-<base36 timestamp><4 random chars>, same shape as the Node build. */
function order_number(): string
{
    $milliseconds = (int) round(microtime(true) * 1000);

    $base36 = '';
    $value = $milliseconds;
    while ($value > 0) {
        $base36 = base_convert((string) ($value % 36), 10, 36) . $base36;
        $value = intdiv($value, 36);
    }

    $alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $random = '';
    for ($index = 0; $index < 4; $index++) {
        $random .= $alphabet[random_int(0, 35)];
    }

    return strtoupper('CRV-' . $base36 . $random);
}

/** @return array{page:int, limit:int, offset:int} */
function paginate(mixed $page = 1, mixed $limit = 12): array
{
    $safePage = max(1, (int) ($page ?: 1));
    $safeLimit = min(100, max(1, (int) ($limit ?: 12)));

    return [
        'page' => $safePage,
        'limit' => $safeLimit,
        'offset' => ($safePage - 1) * $safeLimit,
    ];
}

function pagination_meta(mixed $total, int $page, mixed $rawLimit): array
{
    $limit = min(100, max(1, (int) ($rawLimit ?: 12)));
    $count = (int) $total;

    return [
        'total' => $count,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => max(1, (int) ceil($count / $limit)),
        'hasNext' => $page * $limit < $count,
        'hasPrev' => $page > 1,
    ];
}

/** MySQL DATETIME (UTC) -> ISO 8601 string, matching what mysql2 returned. */
function iso_datetime(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    $timestamp = strtotime((string) $value . ' UTC');
    if ($timestamp === false) {
        return null;
    }

    return gmdate('Y-m-d\TH:i:s.000\Z', $timestamp);
}

/** Sorts are whitelisted, never interpolated from raw input. */
function resolve_sort(?string $sort, array $map, string $fallback): string
{
    if ($sort !== null && isset($map[$sort])) {
        return $map[$sort];
    }
    return $fallback;
}

/** Safe LIMIT/OFFSET clause built from already-validated integers. */
function limit_clause(int $limit, int $offset): string
{
    return ' LIMIT ' . max(0, $limit) . ' OFFSET ' . max(0, $offset);
}

function placeholders(array $values): string
{
    return implode(',', array_fill(0, count($values), '?'));
}

function like_term(string $search): string
{
    return '%' . $search . '%';
}

function image_url_is_valid(string $value): bool
{
    return $value === '' || str_starts_with($value, '/') || preg_match('#^https?://#i', $value) === 1;
}

/** Normalises a JS-style ISO string into a MySQL DATETIME (UTC). */
function to_mysql_datetime(?string $value): ?string
{
    if ($value === null || trim($value) === '') {
        return null;
    }
    $timestamp = strtotime($value);
    return $timestamp === false ? null : gmdate('Y-m-d H:i:s', $timestamp);
}

function today_utc(): string
{
    return gmdate('Y-m-d H:i:s');
}
