<?php

declare(strict_types=1);

/**
 * HTTP helpers: the JSON envelope, error types and the body reader.
 * Envelope matches the Node build exactly so the React client needs no changes:
 *   success -> { success: true, data, message?, meta?, summary? }
 *   failure -> { success: false, error: { code, message, details? } }
 */
final class ApiException extends RuntimeException
{
    public int $status;
    public string $errorCode;
    public mixed $details;

    public function __construct(int $status, string $message, string $errorCode = 'ERROR', mixed $details = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $errorCode;
        $this->details = $details;
    }
}

function bad_request(string $message, mixed $details = null): never
{
    throw new ApiException(400, $message, 'VALIDATION_ERROR', $details);
}

function unauthorized(string $message = 'Please sign in to continue'): never
{
    throw new ApiException(401, $message, 'UNAUTHORIZED');
}

function forbidden(string $message = 'You do not have permission to do that'): never
{
    throw new ApiException(403, $message, 'FORBIDDEN');
}

function not_found(string $message = 'Resource not found'): never
{
    throw new ApiException(404, $message, 'NOT_FOUND');
}

function conflict(string $message, mixed $details = null): never
{
    throw new ApiException(409, $message, 'CONFLICT', $details);
}

function too_many_requests(string $message = 'Too many requests, please slow down'): never
{
    throw new ApiException(429, $message, 'RATE_LIMITED');
}

/** Sends the JSON response. Nothing else should echo after this. */
function send_json(mixed $payload, int $status = 200): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** Failure envelope (matches { success:false, error:{ code, message, details? } }). */
function send_error(int $status, string $message, string $code = 'ERROR', mixed $details = null): void
{
    $error = ['code' => $code, 'message' => $message];
    if ($details !== null) {
        $error['details'] = $details;
    }

    send_json(['success' => false, 'error' => $error], $status);
}

/** Success envelope. */
function ok(mixed $data = null, array $extra = [], int $status = 200): void
{
    $payload = ['success' => true];
    if ($data !== null) {
        $payload['data'] = $data;
    }
    send_json(array_merge($payload, $extra), $status);
}

/** Raw request body, decoded once. */
function json_body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        $body = [];
        return $body;
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new ApiException(400, 'Request body is not valid JSON', 'INVALID_JSON');
    }

    $body = $decoded;
    return $body;
}

/** Query string values (always strings, trimmed by the validators). */
function query_param(string $key, ?string $default = null): ?string
{
    $value = $_GET[$key] ?? null;
    if ($value === null || !is_string($value)) {
        return $default;
    }
    $value = trim($value);
    return $value === '' ? $default : $value;
}
