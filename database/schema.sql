-- MySQL schema for UEM Labs authentication and role-based access
-- This matches the PHP + MySQL login flow used by the app.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('candidate', 'tutor') NOT NULL,
  must_reset_password TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);

-- Optional: this is the exact table the app creates automatically if it does not exist.
-- You can import this file in phpMyAdmin or MySQL Workbench on Hostinger.
