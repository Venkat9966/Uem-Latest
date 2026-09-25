<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function getDatabaseConnection(): PDO
{
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    // If credentials are missing, provide a clearer error and helpful log entry.
    if (DB_USER === '' || DB_NAME === '') {
        $err = 'Database credentials appear empty; check config and .env. DB_USER=' . (DB_USER === '' ? '<empty>' : DB_USER) . ', DB_NAME=' . (DB_NAME === '' ? '<empty>' : DB_NAME);
        @file_put_contents(__DIR__ . '/../logs/db-connection.log', '[' . date('c') . '] ' . $err . "\n", FILE_APPEND);
        throw new RuntimeException($err);
    }

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

/**
 * Ensure a column exists on a table. Uses information_schema to avoid
 * relying on MySQL's non-portable `ADD COLUMN IF NOT EXISTS` syntax.
 */
function ensureColumnExists(PDO $pdo, string $table, string $column, string $definition): void
{
    $check = $pdo->prepare('SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table AND COLUMN_NAME = :column');
    $check->execute([
        ':db' => DB_NAME,
        ':table' => $table,
        ':column' => $column,
    ]);
    $row = $check->fetch(PDO::FETCH_ASSOC);
    if (!$row || (int) $row['cnt'] === 0) {
        // $definition should include the column name and type, e.g. "`must_reset_password` TINYINT(1) NOT NULL DEFAULT 0"
        $pdo->exec('ALTER TABLE `' . $table . '` ADD COLUMN ' . $definition);
    }
}
