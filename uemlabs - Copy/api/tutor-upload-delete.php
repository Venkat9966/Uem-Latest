<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST allowed.']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || empty($data['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'id is required.']);
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

    $stmt = $pdo->prepare('SELECT stored_name FROM tutor_uploads WHERE id = :id AND user_id = :user_id LIMIT 1');
    $stmt->execute([':id' => $data['id'], ':user_id' => $sessionUser['id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Not found']);
        exit;
    }

    $path = __DIR__ . '/../uploads/tutor/' . $row['stored_name'];
    if (is_file($path)) @unlink($path);

    $del = $pdo->prepare('DELETE FROM tutor_uploads WHERE id = :id AND user_id = :user_id');
    $del->execute([':id' => $data['id'], ':user_id' => $sessionUser['id']]);

    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    error_log('[tutor-upload-delete] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
