<?php
// Full end-to-end smoke test for auth + tutor upload flows.
// Usage: php tests/test_api_full.php --host=http://127.0.0.1:8000 --email=tutor@uemlabs.com --password=tutor123

function usage() {
    echo "Usage: php tests/test_api_full.php --host=http://127.0.0.1:8000 --email=... --password=... [--file=path_to_file] [--verbose]\n";
    exit(1);
}

$opts = getopt('', ['host:', 'email:', 'password:', 'file::', 'verbose']);
if (empty($opts['host']) || empty($opts['email']) || empty($opts['password'])) usage();
$base = rtrim($opts['host'], '/');
$email = $opts['email'];
$password = $opts['password'];
$filePath = $opts['file'] ?? null;
$verbose = isset($opts['verbose']);

$cookieJar = sys_get_temp_dir() . '/uem_test_cookie_' . bin2hex(random_bytes(6));

function curlJson($method, $url, $data = null, $cookieJar = null, $isMultipart = false) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    if ($cookieJar) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
    }

    if ($data !== null) {
        if ($isMultipart) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        } else {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }
    }

    $body = curl_exec($ch);
    $info = curl_getinfo($ch);
    $err = curl_error($ch);
    $hdr = curl_getinfo($ch, CURLINFO_HEADER_OUT);
    curl_close($ch);
    return ['info' => $info, 'body' => $body, 'error' => $err, 'request_headers' => $hdr];
}

echo "Logging in as $email against $base...\n";
$login = curlJson('POST', $base . '/api/login.php', ['email' => $email, 'password' => $password], $cookieJar);
echo "  HTTP: " . ($login['info']['http_code'] ?? 'N/A') . "\n";
echo "  Body: " . ($login['body'] ?: '(empty)') . "\n";
if (!empty($login['error'])) { echo "CURL ERROR: " . $login['error'] . "\n"; exit(1); }

if ($verbose) {
    echo "Request headers:\n" . ($login['request_headers'] ?? '(none)') . "\n";
}

$resp = json_decode($login['body'] ?: '{}', true);
if (!($resp['success'] ?? false)) { echo "Login failed — aborting.\n"; exit(1); }

// Prepare test file (JSON quiz) if not provided
if (!$filePath) {
    $tmp = sys_get_temp_dir() . '/uem_quiz_' . bin2hex(random_bytes(6)) . '.json';
    $quiz = ['title' => 'CI Test Quiz', 'questions' => [['q' => '2+2', 'a' => ['2','3','4'], 'correct' => 2]]];
    file_put_contents($tmp, json_encode($quiz));
    $filePath = $tmp;
    echo "Created temp quiz file: $filePath\n";
}

if (!is_file($filePath)) { echo "File not found: $filePath\n"; exit(1); }

echo "Uploading file...\n";
$cfile = new CURLFile($filePath, mime_content_type($filePath), basename($filePath));
$multipart = ['file' => $cfile];
$up = curlJson('POST', $base . '/api/tutor-upload.php', $multipart, $cookieJar, true);
echo "  HTTP: " . ($up['info']['http_code'] ?? 'N/A') . "\n";
echo "  Body: " . ($up['body'] ?: '(empty)') . "\n";
if (!empty($up['error'])) { echo "CURL ERROR: " . $up['error'] . "\n"; }
if ($verbose) {
    echo "Upload request headers:\n" . ($up['request_headers'] ?? '(none)') . "\n";
}

$uresp = json_decode($up['body'] ?: '{}', true);
if (!($uresp['success'] ?? false)) { echo "Upload failed.\n"; /* continue to list anyway */ }

echo "Listing uploads...\n";
$list = curlJson('GET', $base . '/api/tutor-uploads-list.php', null, $cookieJar);
echo "  HTTP: " . ($list['info']['http_code'] ?? 'N/A') . "\n";
echo "  Body: " . ($list['body'] ?: '(empty)') . "\n";
$ljson = json_decode($list['body'] ?: '{}', true);
if ($verbose) {
    echo "List request headers:\n" . ($list['request_headers'] ?? '(none)') . "\n";
}

$firstId = null;
if (!empty($ljson['uploads']) && is_array($ljson['uploads'])) {
    $firstId = $ljson['uploads'][0]['id'] ?? null;
    echo "Found " . count($ljson['uploads']) . " uploads. First id: " . ($firstId ?: '(none)') . "\n";
}

if ($firstId) {
    echo "Deleting upload id $firstId...\n";
    $del = curlJson('POST', $base . '/api/tutor-upload-delete.php', ['id' => $firstId], $cookieJar);
    echo "  HTTP: " . ($del['info']['http_code'] ?? 'N/A') . "\n";
    echo "  Body: " . ($del['body'] ?: '(empty)') . "\n";
    if ($verbose) {
        echo "Delete request headers:\n" . ($del['request_headers'] ?? '(none)') . "\n";
    }
}

echo "Test completed.\n";
