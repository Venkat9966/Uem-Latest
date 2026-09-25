<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST is allowed.']);
    exit;
}

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload.']);
    exit;
}

$email = isset($data['email']) ? trim(strtolower((string) $data['email'])) : '';
$temporaryPassword = isset($data['temporaryPassword']) ? (string) $data['temporaryPassword'] : '';
$newPassword = isset($data['newPassword']) ? (string) $data['newPassword'] : '';

// Support token-based reset from forgot-password link
$token = isset($data['token']) ? (string) $data['token'] : '';

if ($email === '' || $temporaryPassword === '' || $newPassword === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email, temporary password, and new password are required.']);
    exit;
}

if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'New password must be at least 8 characters long.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $stmt = $pdo->prepare('SELECT id, password_hash, must_reset_password FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // If token is provided, validate it against the password_resets table
    if ($token !== '') {
        $pr = $pdo->prepare('SELECT id, token_hash, expires_at FROM password_resets WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1');
        $pr->execute([':user_id' => $user['id']]);
        $row = $pr->fetch(PDO::FETCH_ASSOC);

        if (!$row || new DateTime($row['expires_at']) < new DateTime()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Reset token is invalid or expired.']);
            exit;
        }

        if (!password_verify($token, $row['token_hash'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Reset token is invalid.']);
            exit;
        }
    }

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'No account found for that email.']);
        exit;
    }

    if (!password_verify($temporaryPassword, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'The temporary password is incorrect.']);
        exit;
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $update = $pdo->prepare('UPDATE users SET password_hash = :new_password_hash, must_reset_password = 0 WHERE id = :id');
    $update->execute([
        ':new_password_hash' => $newHash,
        ':id' => $user['id'],
    ]);

    // If a token was used, delete any outstanding reset tokens for this user
    if ($token !== '') {
        $del = $pdo->prepare('DELETE FROM password_resets WHERE user_id = :user_id');
        $del->execute([':user_id' => $user['id']]);
    }

    echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('[set-password] ' . $e->getMessage());

    $resp = [
        'success' => false,
        'message' => 'Could not update the password right now.',
    ];

    if (defined('APP_ENV') && APP_ENV === 'development') {
        $resp['debug'] = $e->getMessage();
    }

    echo json_encode($resp);
}
