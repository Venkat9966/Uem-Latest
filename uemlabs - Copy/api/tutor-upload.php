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

// Ensure user is tutor
try {
    $pdo = getDatabaseConnection();
    $sessionUser = $_SESSION['user'] ?? null;
    if (!$sessionUser || ($sessionUser['role'] ?? '') !== 'tutor') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
    exit;
}

$allowed = [
    'application/pdf' => 'pdf',
    'image/png' => 'png',
    'image/jpeg' => 'jpg',
    'video/mp4' => 'mp4',
    'application/json' => 'json'
];

// Max upload 50MB
$maxBytes = 50 * 1024 * 1024;

if (empty($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No file uploaded.']);
    exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Upload error code: ' . $file['error']]);
    exit;
}

if ($file['size'] > $maxBytes) {
    http_response_code(413);
    echo json_encode(['success' => false, 'message' => 'File too large.']);
    exit;
}

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
$isAllowed = array_key_exists($mime, $allowed);
// Additional precaution: allow certain file extensions for json quizzes
$ext = $isAllowed ? $allowed[$mime] : null;
if (!$isAllowed) {
    http_response_code(415);
    echo json_encode(['success' => false, 'message' => 'Unsupported file type: ' . $mime]);
    exit;
}
$uploadDir = __DIR__ . '/../uploads/tutor';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

$basename = bin2hex(random_bytes(12));
$filename = $basename . '.' . $ext;
$dest = $uploadDir . '/' . $filename;
// Move file and set safe permissions
if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to move uploaded file.']);
    exit;
}

// Ensure uploaded file is not executable
@chmod($dest, 0644);

// Basic content scanning: for JSON quizzes ensure valid JSON
if ($mime === 'application/json') {
    $content = @file_get_contents($dest);
    if ($content === false) {
        @unlink($dest);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Could not read uploaded JSON.']);
        exit;
    }
    json_decode($content);
    if (json_last_error() !== JSON_ERROR_NONE) {
        @unlink($dest);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Uploaded JSON is invalid.']);
        exit;
    }
}

// Insert metadata into uploads table
try {
    $pdo->prepare('CREATE TABLE IF NOT EXISTS tutor_uploads (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, original_name VARCHAR(255) NOT NULL, stored_name VARCHAR(255) NOT NULL, mime VARCHAR(100) NOT NULL, size INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')->execute();

    $ins = $pdo->prepare('INSERT INTO tutor_uploads (user_id, original_name, stored_name, mime, size) VALUES (:user_id, :original_name, :stored_name, :mime, :size)');
    $ins->execute([
        ':user_id' => $sessionUser['id'],
        ':original_name' => $file['name'],
        ':stored_name' => $filename,
        ':mime' => $mime,
        ':size' => $file['size'],
    ]);

    echo json_encode(['success' => true, 'message' => 'Upload successful.', 'file' => ['url' => 'uploads/tutor/' . $filename, 'name' => $file['name'], 'mime' => $mime]]);
} catch (Throwable $e) {
    error_log('[tutor-upload] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to record upload.']);
}
