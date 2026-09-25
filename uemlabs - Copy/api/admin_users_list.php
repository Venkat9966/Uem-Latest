<?php
declare(strict_types=1);
// Simple admin-only users list for testing (REMOVE in production)
header('Content-Type: application/json');
require_once __DIR__ . '/db.php';

// Basic protection: require a query token ?token=admin-test
if (!isset($_GET['token']) || $_GET['token'] !== 'admin-test-token') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $stmt = $pdo->query('SELECT id, full_name, email, role, must_reset_password, created_at FROM users ORDER BY id DESC');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'users' => $rows], JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}cha
