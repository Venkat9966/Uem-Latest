<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/email.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST is allowed.']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data) || empty($data['email'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email is required.']);
    exit;
}

$email = strtolower(trim((string) $data['email']));

try {
    $pdo = getDatabaseConnection();
    $stmt = $pdo->prepare('SELECT id, full_name FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        // Do not reveal whether the email exists
        echo json_encode(['success' => true, 'message' => 'If an account exists, a reset link has been sent.']);
        exit;
    }

    // Create a short-lived token and store a hash in DB
    $token = bin2hex(random_bytes(24));
    $tokenHash = password_hash($token, PASSWORD_DEFAULT);
    $expires = (new DateTime('+1 hour'))->format('Y-m-d H:i:s');

    $pdo->prepare('CREATE TABLE IF NOT EXISTS password_resets (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token_hash VARCHAR(255) NOT NULL, expires_at DATETIME NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')->execute();

    $insert = $pdo->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, :expires_at)');
    $insert->execute([
        ':user_id' => $user['id'],
        ':token_hash' => $tokenHash,
        ':expires_at' => $expires,
    ]);

    $resetUrl = sprintf('%s/set-password.html?token=%s&email=%s', rtrim(getBaseUrl(), '/'), urlencode($token), urlencode($email));

    $subject = 'UEM Labs password reset';
    $message = "Hello {$user['full_name']},\r\n\r\nWe received a request to reset your password. Click the link below to set a new password (valid for 1 hour):\r\n\r\n$resetUrl\r\n\r\nIf you did not request this, ignore this email.";

    $sent = sendEmailMessage($email, $subject, $message, $user['full_name']);

    if (!$sent) {
        // Don't reveal email failure too verbosely
        error_log('[forgot-password] email send failed for ' . $email);
    }

    echo json_encode(['success' => true, 'message' => 'If an account exists, a reset link has been sent.']);
} catch (Throwable $e) {
    error_log('[forgot-password] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to process request.']);
}

function getBaseUrl(): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] ?? '') === '443' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return $scheme . '://' . $host;
}
