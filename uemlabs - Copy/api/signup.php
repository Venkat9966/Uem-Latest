<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/email.php';

// Rate limit signup by IP: 6 attempts per hour
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!rate_limit_check('signup_' . $ip, 6, 3600)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Too many signup attempts. Try again later.']);
    exit;
}

function generateTemporaryPassword(): string
{
    $alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $password = '';
    for ($i = 0; $i < 12; $i++) {
        $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $password;
}

function sendTempPasswordEmail(string $name, string $email, string $password): bool
{
    $subject = 'Your temporary UEM Labs password';
    $message = "Hello $name,\r\n\r\nYour temporary password is: $password\r\n\r\nPlease log in and set a new password immediately.\r\n";
    return sendEmailMessage($email, $subject, $message, $name);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST is allowed.']);
    exit;
}

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);

// Temporary verbose logging for debugging signup failures (do not log raw passwords)
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
$sanitizedPayload = null;
$decodedTemp = @json_decode($rawBody, true);
if (is_array($decodedTemp)) {
    if (isset($decodedTemp['password'])) $decodedTemp['password'] = '***MASKED***';
    $sanitizedPayload = json_encode($decodedTemp);
} else {
    $sanitizedPayload = $rawBody;
}

// collect some minimal headers if available
$headers = [];
if (function_exists('getallheaders')) {
    try { $headers = getallheaders(); } catch (Throwable $e) { $headers = []; }
}
@file_put_contents($logDir . '/signup_requests.log', "[".date('c')."] " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . " " . ($headers['User-Agent'] ?? '') . " payload: " . $sanitizedPayload . "\n", FILE_APPEND);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload.']);
    exit;
}

$name = isset($data['name']) ? trim((string) $data['name']) : '';
$email = isset($data['email']) ? trim(strtolower((string) $data['email'])) : '';
$role = isset($data['role']) ? strtolower((string) $data['role']) : '';

if ($name === '' || $email === '' || !in_array($role, ['candidate', 'tutor'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Name, email, and role are required.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('candidate', 'tutor') NOT NULL,
        must_reset_password TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // Ensure must_reset_password column exists on older MySQL versions
    ensureColumnExists($pdo, 'users', 'must_reset_password', "`must_reset_password` TINYINT(1) NOT NULL DEFAULT 1");

    $emailCheck = $pdo->prepare('SELECT id, full_name, password_hash, must_reset_password, role FROM users WHERE email = :email LIMIT 1');
    $emailCheck->execute([':email' => $email]);
    $existing = $emailCheck->fetch();

    if ($existing) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This email is already registered. Please log in.']);
        exit;
    }

    $temporaryPassword = generateTemporaryPassword();
    $passwordHash = password_hash($temporaryPassword, PASSWORD_DEFAULT);

    $insert = $pdo->prepare('INSERT INTO users (full_name, email, password_hash, role, must_reset_password) VALUES (:full_name, :email, :password_hash, :role, 1)');
    $insert->execute([
        ':full_name' => $name,
        ':email' => $email,
        ':password_hash' => $passwordHash,
        ':role' => $role,
    ]);

    $emailSent = sendTempPasswordEmail($name, $email, $temporaryPassword);

    if (!$emailSent) {
        // Log the SMTP failure but still return success for account creation.
        error_log('[signup] Email send failed for ' . $email);
        echo json_encode([
            'success' => true,
            'message' => 'Account created. Temporary password could not be emailed — contact support or configure SMTP.',
            'email' => $email,
            'role' => $role,
            'warning' => 'email_failed'
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Temporary password sent to your email.',
        'email' => $email,
        'role' => $role,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    // Ensure exception is logged to the PHP error log
    error_log('[signup] ' . $e->getMessage());

    $resp = [
        'success' => false,
        'message' => 'Could not create the account right now.',
    ];

    // Return debug information only in development mode
    if (defined('APP_ENV') && APP_ENV === 'development') {
        $resp['debug'] = $e->getMessage();
    }

    echo json_encode($resp);
}
