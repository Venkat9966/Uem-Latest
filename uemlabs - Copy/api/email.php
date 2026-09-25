<?php

declare(strict_types=1);

function ensureEmailConfig(): array
{
    $smtpHost = getenv('SMTP_HOST') ?: (defined('SMTP_HOST') ? SMTP_HOST : 'smtp.gmail.com');
    $smtpPort = getenv('SMTP_PORT') ?: (defined('SMTP_PORT') ? SMTP_PORT : '587');
    $smtpUsername = getenv('SMTP_USERNAME') ?: (defined('SMTP_USERNAME') ? SMTP_USERNAME : '');
    $smtpPassword = getenv('SMTP_PASSWORD') ?: (defined('SMTP_PASSWORD') ? SMTP_PASSWORD : '');
    $fromEmail = getenv('APP_EMAIL_FROM') ?: (defined('APP_EMAIL_FROM') ? APP_EMAIL_FROM : 'noreply@uemlabs.com');
    $fromName = getenv('APP_EMAIL_NAME') ?: (defined('APP_EMAIL_NAME') ? APP_EMAIL_NAME : 'UEM Labs');

    return [$smtpHost, (int) $smtpPort, $smtpUsername, $smtpPassword, $fromEmail, $fromName];
}

function sendEmailMessage(string $toEmail, string $subject, string $messageBody, string $recipientName = ''): bool
{
    [$smtpHost, $smtpPort, $smtpUsername, $smtpPassword, $fromEmail, $fromName] = ensureEmailConfig();

    if ($smtpHost !== '' && $smtpUsername !== '' && $smtpPassword !== '') {
        return sendEmailViaSmtp($toEmail, $recipientName, $subject, $messageBody, $smtpHost, $smtpPort, $smtpUsername, $smtpPassword, $fromEmail, $fromName);
    }

    $headers = "From: {$fromEmail}\r\n";
    $headers .= "Reply-To: {$fromEmail}\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    return mail($toEmail, $subject, $messageBody, $headers);
}

function sendEmailViaSmtp(
    string $toEmail,
    string $recipientName,
    string $subject,
    string $messageBody,
    string $smtpHost,
    int $smtpPort,
    string $smtpUsername,
    string $smtpPassword,
    string $fromEmail,
    string $fromName
): bool {
    // Support implicit-SSL (port 465) by connecting with ssl:// prefix when needed
    $transportHost = ($smtpPort === 465 || $smtpPort === '465') ? 'ssl://' . $smtpHost : $smtpHost;
    $socket = fsockopen($transportHost, $smtpPort, $errno, $errstr, 20);
    if ($socket === false) {
        return false;
    }

    $read = function () use ($socket) {
        $response = '';
        while (!feof($socket)) {
            $line = fgets($socket, 515);
            $response .= $line;
            if (substr($line, 3, 1) === ' ') {
                break;
            }
        }
        return $response;
    };

    $response = $read();
    if (strpos($response, '220') !== 0) {
        fclose($socket);
        return false;
    }

    // For implicit SSL (connected via ssl://) the socket is already encrypted; skip STARTTLS
    $isImplicitSsl = ($transportHost !== $smtpHost);

    // Send EHLO first
    fwrite($socket, 'EHLO ' . $smtpHost . "\r\n");
    $response = $read();

    if (!$isImplicitSsl) {
        // Try STARTTLS if server supports it
        fwrite($socket, "STARTTLS\r\n");
        $response = $read();
        if (strpos($response, '220') === 0) {
            // negotiate TLS
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                fclose($socket);
                return false;
            }
            // Re-EHLO over TLS
            fwrite($socket, "EHLO " . $smtpHost . "\r\n");
            $response = $read();
        }
    }

    if (strpos($response, '250') !== 0 && strpos($response, '220') !== 0) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "AUTH LOGIN\r\n");
    $response = $read();
    if (strpos($response, '334') !== 0) {
        fclose($socket);
        return false;
    }

    fwrite($socket, base64_encode($smtpUsername) . "\r\n");
    $response = $read();
    if (strpos($response, '334') !== 0) {
        fclose($socket);
        return false;
    }

    fwrite($socket, base64_encode($smtpPassword) . "\r\n");
    $response = $read();
    if (strpos($response, '235') !== 0) {
        fclose($socket);
        return false;
    }

    fwrite($socket, 'MAIL FROM: <' . $fromEmail . '>' . "\r\n");
    $response = $read();
    if (strpos($response, '250') !== 0) {
        fclose($socket);
        return false;
    }

    fwrite($socket, 'RCPT TO: <' . $toEmail . '>' . "\r\n");
    $response = $read();
    if (strpos($response, '250') !== 0 && strpos($response, '251') !== 0) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "DATA\r\n");
    $response = $read();
    if (strpos($response, '354') !== 0) {
        fclose($socket);
        return false;
    }

    $boundary = '----=_NextPart_' . md5((string) microtime(true));
    $headers = "From: \"{$fromName}\" <{$fromEmail}>\r\n";
    $headers .= "To: \"{$recipientName}\" <{$toEmail}>\r\n";
    $headers .= "Subject: {$subject}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "Content-Transfer-Encoding: 8bit\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    $headers .= "\r\n";

    fwrite($socket, $headers . $messageBody . "\r\n.\r\n");
    $response = $read();
    if (strpos($response, '250') !== 0 && strpos($response, '354') !== 0) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "QUIT\r\n");
    $read();
    fclose($socket);

    return true;
}
