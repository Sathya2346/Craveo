<?php

declare(strict_types=1);

/**
 * Thin PDO wrapper: query(), one(), exec() and transaction().
 * Mirrors the helpers the Express build uses so the ported SQL stays identical.
 */
final class Db
{
    private static ?PDO $pdo = null;
    private static array $config = [];

    public static function configure(array $config): void
    {
        self::$config = $config;
    }

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $config = self::$config;
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $config['host'],
            $config['port'],
            $config['name']
        );

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Emulated prepares keep LIMIT ? portable across MySQL/MariaDB builds.
            PDO::ATTR_EMULATE_PREPARES => true,
            PDO::ATTR_STRINGIFY_FETCHES => false,
            PDO::ATTR_TIMEOUT => 10,
        ];

        self::$pdo = new PDO($dsn, $config['user'], $config['password'], $options);
        // The API speaks UTC everywhere, exactly like the Node build.
        self::$pdo->exec("SET time_zone = '+00:00'");

        return self::$pdo;
    }

    /** @return array<int, array<string, mixed>> */
    public static function q(string $sql, array $params = []): array
    {
        $statement = self::pdo()->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public static function one(string $sql, array $params = []): ?array
    {
        $statement = self::pdo()->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    /** @return array{affected:int, insertId:int} */
    public static function exec(string $sql, array $params = []): array
    {
        $statement = self::pdo()->prepare($sql);
        $statement->execute($params);
        return [
            'affected' => $statement->rowCount(),
            'insertId' => (int) self::pdo()->lastInsertId(),
        ];
    }

    /** Runs the callback inside a transaction and rolls back on any throw. */
    public static function transaction(callable $work): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $result = $work(new DbTransaction($pdo));
            $pdo->commit();
            return $result;
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    }

    public static function ping(): bool
    {
        $row = self::one('SELECT 1 AS ok');
        return (int) ($row['ok'] ?? 0) === 1;
    }
}

/** Scoped handle passed to Db::transaction() callbacks. */
final class DbTransaction
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return array<int, array<string, mixed>> */
    public function query(string $sql, array $params = []): array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function one(string $sql, array $params = []): ?array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    /** @return array{affected:int, insertId:int} */
    public function execute(string $sql, array $params = []): array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return [
            'affected' => $statement->rowCount(),
            'insertId' => (int) $this->pdo->lastInsertId(),
        ];
    }
}
