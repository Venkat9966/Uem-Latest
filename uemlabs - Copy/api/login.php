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

// Verbose debug logging for login attempts (mask password)
$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
$decoded = @json_decode($rawBody, true);
if (is_array($decoded) && isset($decoded['password'])) $decoded['password'] = '***MASKED***';
$sanitized = is_array($decoded) ? json_encode($decoded) : $rawBody;
@file_put_contents($logDir . '/login_requests.log', "[".date('c')."] " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . " " . ($_SERVER['HTTP_USER_AGENT'] ?? '') . " payload: " . $sanitized . "\n", FILE_APPEND);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload.']);
    exit;
}

$email = isset($data['email']) ? trim(strtolower((string) $data['email'])) : '';
$password = isset($data['password']) ? (string) $data['password'] : '';
$role = isset($data['role']) ? strtolower((string) $data['role']) : '';

if ($email === '' || $password === '' || !in_array($role, ['candidate', 'tutor'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email, password, and valid role are required.']);
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
        must_reset_password TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // Ensure must_reset_password column exists on older MySQL versions
    ensureColumnExists($pdo, 'users', 'must_reset_password', "`must_reset_password` TINYINT(1) NOT NULL DEFAULT 0");

    $seedUsers = [
        ['Candidate User', 'candidate@uemlabs.com', 'candidate123', 'candidate', 0],
        ['Tutor User', 'tutor@uemlabs.com', 'tutor123', 'tutor', 0],
    ];

    foreach ($seedUsers as $seedUser) {
        [$fullName, $seedEmail, $seedPassword, $seedRole, $requiresReset] = $seedUser;

        $existing = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $existing->execute([':email' => $seedEmail]);

        if ($existing->fetch() === false) {
            $insert = $pdo->prepare('INSERT INTO users (full_name, email, password_hash, role, must_reset_password) VALUES (:full_name, :email, :password_hash, :role, :must_reset_password)');
            $insert->execute([
                ':full_name' => $fullName,
                ':email' => $seedEmail,
                ':password_hash' => password_hash($seedPassword, PASSWORD_DEFAULT),
                ':role' => $seedRole,
                ':must_reset_password' => $requiresReset,
            ]);
        }
    }

    $stmt = $pdo->prepare('SELECT id, full_name, email, role, password_hash, must_reset_password FROM users WHERE email = :email AND role = :role LIMIT 1');
    $stmt->execute([':email' => $email, ':role' => $role]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Incorrect credentials for the selected role.']);
        exit;
    }

    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'name' => $user['full_name'],
        'email' => $user['email'],
        'role' => $user['role'],
    ];

    echo json_encode([
        'success' => true,
        'message' => 'Login successful.',
        'must_reset_password' => (bool) $user['must_reset_password'],
        'user' => $_SESSION['user'],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('[login] ' . $e->getMessage());

        $resp = [
            'success' => false,
            'message' => 'An internal error occurred.',
        ];

    if (defined('APP_ENV') && APP_ENV === 'development') {
        $resp['debug'] = $e->getMessage();
    }

    echo json_encode($resp);
}
