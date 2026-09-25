<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only GET allowed.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $sessionUser = $_SESSION['user'] ?? null;
    if (!$sessionUser || ($sessionUser['role'] ?? '') !== 'tutor') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT id, original_name, stored_name, mime, size, created_at FROM tutor_uploads WHERE user_id = :user_id ORDER BY created_at DESC');
    $stmt->execute([':user_id' => $sessionUser['id']]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Convert stored_name to safe URL
    $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] ?? '') === '443' ? 'https' : 'http';
    $base .= '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    foreach ($rows as &$r) {
        $r['url'] = $r['stored_name'] ? $base . '/uploads/tutor/' . $r['stored_name'] : null;
    }

    echo json_encode(['success' => true, 'uploads' => $rows]);
} catch (Throwable $e) {
    error_log('[tutor-uploads-list] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
