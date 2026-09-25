<?php
declare(strict_types=1);

// Security helpers: headers, session cookie params, and simple rate limiter.

// Set security headers
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer-when-downgrade');
header('Permissions-Policy: geolocation=()');

// Strict Transport Security for production
if (defined('APP_ENV') && APP_ENV === 'production') {
    header('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload');
}

// Minimal Content Security Policy - adjust as needed for external assets
// Recommended CSP - explicit and conservative. Allow styles/scripts from self and trusted CDNs only.
if (!defined('CSP_POLICY')) {
    define('CSP_POLICY', "default-src 'self'; script-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self'; font-src https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self';");
}
header('Content-Security-Policy: ' . CSP_POLICY);

// Configure session cookie params depending on environment
function configure_session_cookies(): void
{
    $isProd = defined('APP_ENV') && APP_ENV === 'production';
    $secure = $isProd; // only use secure cookies in production
    $params = [
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ];

    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params($params);
    } else {
        session_set_cookie_params($params['lifetime'], $params['path'], ini_get('session.cookie_domain') ?: '', $params['secure'], $params['httponly']);
    }
}

// Simple file-based rate limiter by key (e.g., IP). Returns true if allowed.
function rate_limit_check(string $key, int $maxAttempts, int $periodSeconds): bool
{
    $safeKey = preg_replace('/[^a-z0-9_\-]/i', '_', $key);
    $dir = __DIR__ . '/../logs';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $file = $dir . "/ratelimit_{$safeKey}.json";
    $now = time();
    $data = ['timestamps' => []];
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $data = $raw ? json_decode($raw, true) : $data;
        if (!is_array($data) || !isset($data['timestamps'])) $data = ['timestamps' => []];
    }

    // prune old
    $data['timestamps'] = array_filter($data['timestamps'], function ($ts) use ($now, $periodSeconds) {
        return ($now - (int)$ts) <= $periodSeconds;
    });

    if (count($data['timestamps']) >= $maxAttempts) {
        // too many
        return false;
    }

    $data['timestamps'][] = $now;
    @file_put_contents($file, json_encode($data));
    return true;
}

// Call to set session cookie params before session_start()
configure_session_cookies();
