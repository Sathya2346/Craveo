<?php

declare(strict_types=1);

/**
 * Minimal router. Patterns use :name segments, e.g. /restaurants/:idOrSlug.
 * Routes are matched in registration order (same as Express).
 */
final class Router
{
    private array $routes = [];
    private array $compiled = [];

    public function add(string $method, string $pattern, callable $handler, array $middleware = []): void
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'handler' => $handler,
            'middleware' => $middleware,
        ];
    }

    public function get(string $pattern, callable $handler, array $middleware = []): void
    {
        $this->add('GET', $pattern, $handler, $middleware);
    }

    public function post(string $pattern, callable $handler, array $middleware = []): void
    {
        $this->add('POST', $pattern, $handler, $middleware);
    }

    public function patch(string $pattern, callable $handler, array $middleware = []): void
    {
        $this->add('PATCH', $pattern, $handler, $middleware);
    }

    public function put(string $pattern, callable $handler, array $middleware = []): void
    {
        $this->add('PUT', $pattern, $handler, $middleware);
    }

    public function delete(string $pattern, callable $handler, array $middleware = []): void
    {
        $this->add('DELETE', $pattern, $handler, $middleware);
    }

    public function dispatch(string $method, string $path): bool
    {
        $method = strtoupper($method);

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $regex = $this->compiled[$route['pattern']] ??= $this->compile($route['pattern']);
            if (preg_match($regex, $path, $matches) !== 1) {
                continue;
            }

            $params = [];
            foreach ($matches as $key => $value) {
                if (!is_int($key)) {
                    $params[$key] = urldecode((string) $value);
                }
            }

            foreach ($route['middleware'] as $middleware) {
                $middleware($params);
            }

            ($route['handler'])($params);
            return true;
        }

        return false;
    }

    private function compile(string $pattern): string
    {
        $compiled = preg_replace_callback(
            '#:([A-Za-z_][A-Za-z0-9_]*)#',
            static fn (array $matches): string => '(?P<' . $matches[1] . '>[^/]+)',
            $pattern
        );

        return '#^' . $compiled . '$#';
    }
}
