-- Helper SQL to create database and user for UEM Labs
-- Usage (MySQL root):
--   mysql -u root -p < scripts/create_db.sql

CREATE DATABASE IF NOT EXISTS `uemlabs` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'uem_user'@'localhost' IDENTIFIED BY 'SET_A_STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON `uemlabs`.* TO 'uem_user'@'localhost';
FLUSH PRIVILEGES;

-- Note: edit the username/password and DB name as desired before running this on production.
