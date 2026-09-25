<?php
// Lightweight smoke tests for API endpoints. Run after starting PHP built-in server
// Usage: php tests/test_api_smoke.php

function request($method, $url, $data = null, $headers = []) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($data !== null) {
        $payload = is_string($data) ? $data : json_encode($data);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        $headers[] = 'Content-Type: application/json';
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $body = curl_exec($ch);
    $info = curl_getinfo($ch);
    $err = curl_error($ch);
    curl_close($ch);
    return ['info' => $info, 'body' => $body, 'error' => $err];
}

$base = 'http://127.0.0.1:8000';
echo "Running lightweight API smoke tests against $base\n\n";

$tests = [];

$tests[] = ['GET', "$base/api/tutor-uploads-list.php", null, 'Expect 403 (not logged in)'];
$tests[] = ['POST', "$base/api/forgot-password.php", ['email' => 'no-such-user+'.time().'@example.test'], 'Expect success message (non-revealing)'];
$tests[] = ['POST', "$base/api/tutor-upload.php", null, 'Expect 403 (not logged in)'];
$tests[] = ['POST', "$base/api/tutor-upload-delete.php", ['id' => 1], 'Expect 403 (not logged in)'];

foreach ($tests as $t) {
    list($method, $url, $data, $note) = $t;
    echo "Test: $method $url — $note\n";
    $res = request($method, $url, $data);
    if ($res['error']) {
        echo "  CURL ERROR: " . $res['error'] . "\n\n";
        continue;
    }
    echo "  HTTP/1.x " . ($res['info']['http_code'] ?? 'N/A') . "\n";
    echo "  Body: " . (strlen($res['body']) > 800 ? substr($res['body'],0,800).'...': $res['body']) . "\n\n";
}

echo "Done.\n";
