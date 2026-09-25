CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('candidate', 'tutor') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (full_name, email, password_hash, role)
VALUES
    ('Candidate User', 'candidate@uemlabs.com', '$2b$12$cGEiuEboVX6OEqkzxu4IqelaQieK.EflS54n5V5nzJmCQ9anrCS0y', 'candidate'),
    ('Tutor User', 'tutor@uemlabs.com', '$2b$12$UQHid.jspIbs7sdXKktN.eZm.FgJ1qNnaX9xo5F6pkjEMmtej5cN.', 'tutor')
ON DUPLICATE KEY UPDATE
    full_name = VALUES(full_name),
    password_hash = VALUES(password_hash),
    role = VALUES(role);
