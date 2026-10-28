<?php

declare(strict_types=1);

/**
 * Fixed-window limiter backed by a small file per key.
 * Same idea as the in-memory limiter in the Node build, but survives per-request
 * PHP workers (Apache/FPM). Swap for Redis when you run several nodes.
 */
function rate_limit(string $prefix, int $max, int $windowSeconds): void
{
    $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'craveo-rate-limit';
    if (!is_dir($directory)) {
        @mkdir($directory, 0777, true);
    }

    $identifier = $prefix . ':' . ($_SERVER['REMOTE_ADDR'] ?? 'cli');
    $file = $directory . DIRECTORY_SEPARATOR . sha1($identifier) . '.json';
    $now = time();

    $bucket = ['count' => 0, 'reset' => $now + $windowSeconds];
    if (is_file($file)) {
        $raw = json_decode((string) file_get_contents($file), true);
        if (is_array($raw) && (int) ($raw['reset'] ?? 0) > $now) {
            $bucket = ['count' => (int) ($raw['count'] ?? 0), 'reset' => (int) $raw['reset']];
        }
    }

    $bucket['count']++;
    @file_put_contents($file, json_encode($bucket), LOCK_EX);

    $remaining = max(0, $max - $bucket['count']);
    header('X-RateLimit-Remaining: ' . $remaining);

    if ($bucket['count'] > $max) {
        $retryAfter = max(1, $bucket['reset'] - $now);
        header('Retry-After: ' . $retryAfter);
        too_many_requests('Too many attempts. Try again in ' . $retryAfter . 's.');
    }
}
