<?php

declare(strict_types=1);

/** Minimal HS256 JWT implementation (no external dependency). */

function base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64url_decode(string $value): string
{
    $padding = strlen($value) % 4;
    if ($padding > 0) {
        $value .= str_repeat('=', 4 - $padding);
    }
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    return $decoded === false ? '' : $decoded;
}

/** "7d" / "12h" / "30m" / "900" -> seconds. */
function jwt_ttl_seconds(string $expression): int
{
    if (preg_match('/^(\d+)([smhd])$/i', trim($expression), $matches) === 1) {
        $amount = (int) $matches[1];
        return match (strtolower($matches[2])) {
            's' => $amount,
            'm' => $amount * 60,
            'h' => $amount * 3600,
            'd' => $amount * 86400,
            default => 604800,
        };
    }

    $numeric = (int) $expression;
    return $numeric > 0 ? $numeric : 604800;
}

function jwt_sign(array $claims, string $secret, string $expiresIn = '7d'): string
{
    $issuedAt = time();
    $payload = array_merge($claims, [
        'iat' => $issuedAt,
        'exp' => $issuedAt + jwt_ttl_seconds($expiresIn),
    ]);

    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $body = base64url_encode(json_encode($payload));
    $signature = hash_hmac('sha256', $header . '.' . $body, $secret, true);

    return $header . '.' . $body . '.' . base64url_encode($signature);
}

/** Returns the claims, or null when the token is invalid/expired/unsigned. */
function jwt_verify(string $token, string $secret): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$header, $body, $signature] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', $header . '.' . $body, $secret, true));
    if (!hash_equals($expected, $signature)) {
        return null;
    }

    $decodedHeader = json_decode(base64url_decode($header), true);
    if (!is_array($decodedHeader) || ($decodedHeader['alg'] ?? '') !== 'HS256') {
        return null;
    }

    $claims = json_decode(base64url_decode($body), true);
    if (!is_array($claims)) {
        return null;
    }

    if (isset($claims['exp']) && time() >= (int) $claims['exp']) {
        return null;
    }

    return $claims;
}
