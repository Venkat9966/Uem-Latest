<?php

declare(strict_types=1);
// Load environment file if present (simple .env loader)
if (!function_exists('load_dotenv')) {
	function load_dotenv(string $path = __DIR__ . '/../.env'): void
	{
		if (!is_file($path)) return;
		$lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
		foreach ($lines as $line) {
			$line = trim($line);
			if ($line === '' || $line[0] === '#') continue;
			if (strpos($line, '=') === false) continue;
			list($k, $v) = explode('=', $line, 2);
			$k = trim($k); $v = trim($v);
			$v = preg_replace('/^\"|\"$/', '', $v);
			if (getenv($k) === false) putenv("$k=$v");
			if (!isset($_ENV[$k])) $_ENV[$k] = $v;
			if (!isset($_SERVER[$k])) $_SERVER[$k] = $v;
		}
	}
}

// Try loading project .env (not committed)
load_dotenv();

// Host/DB settings (use environment variables first; fall back to safe defaults)
defined('DB_HOST') or define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
defined('DB_NAME') or define('DB_NAME', getenv('DB_NAME') ?: '');
defined('DB_USER') or define('DB_USER', getenv('DB_USER') ?: '');
defined('DB_PASS') or define('DB_PASS', getenv('DB_PASS') ?: '');

// Application environment: set to 'development' for local dev to show errors.
// Set APP_ENV to 'development' temporarily to surface detailed errors in API responses.
// WARNING: Do not leave this enabled on a public/live site. Revert to 'production' after debugging.
// Set to production now that credentials are configured
defined('APP_ENV') or define('APP_ENV', getenv('APP_ENV') ?: 'production');

// Production-safe PHP settings
ini_set('display_errors', APP_ENV === 'development' ? '1' : '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/logs/php-error.log');
error_reporting(E_ALL);

// SMTP / email settings (used by api/email.php)
defined('SMTP_HOST') or define('SMTP_HOST', getenv('SMTP_HOST') ?: '');
defined('SMTP_PORT') or define('SMTP_PORT', getenv('SMTP_PORT') ?: '');
defined('SMTP_USERNAME') or define('SMTP_USERNAME', getenv('SMTP_USERNAME') ?: '');
defined('SMTP_PASSWORD') or define('SMTP_PASSWORD', getenv('SMTP_PASSWORD') ?: '');
defined('APP_EMAIL_FROM') or define('APP_EMAIL_FROM', getenv('APP_EMAIL_FROM') ?: '');
defined('APP_EMAIL_NAME') or define('APP_EMAIL_NAME', getenv('APP_EMAIL_NAME') ?: '');

// If DB_NAME/USER/PASS are empty, try legacy hard-coded fallbacks (ensure continuity)
if (DB_NAME === '' || DB_USER === '' || DB_PASS === '') {
	defined('DB_NAME') or define('DB_NAME', 'u554942462_uemlabs');
	defined('DB_USER') or define('DB_USER', 'u554942462_uemlabsdbad');
	defined('DB_PASS') or define('DB_PASS', 'v6!Fl@03Sa/');
}

if (SMTP_HOST === '' || SMTP_USERNAME === '' || SMTP_PASSWORD === '') {
	// Leave SMTP empty; recommend filling .env. Do NOT ship credentials in repo.
}
