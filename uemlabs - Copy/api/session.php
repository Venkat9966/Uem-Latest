<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in.']);
    exit;
}

echo json_encode([
    'success' => true,
    'user' => $_SESSION['user'],
]);
