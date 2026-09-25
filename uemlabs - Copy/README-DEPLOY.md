Deployment checklist

1) Copy `.env.example` to `.env` and fill values (DB and SMTP credentials). Do NOT commit `.env`.

	Option A (recommended): SSH to the host and run the interactive helper to create `.env` securely:

	```bash
	cd /path/to/uemlabs
	php scripts/create_env.php
	```

	Option B (manual): copy `.env.example` to `.env` and edit values locally then upload.

2) Create the database and user (example):

```sql
CREATE DATABASE uemlabs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'uem_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL ON uemlabs.* TO 'uem_user'@'localhost';
FLUSH PRIVILEGES;
```

3) Ensure directories exist and are writable by the web server:

```bash
mkdir -p /var/www/uemlabs/uploads /var/www/uemlabs/logs
chown -R www-data:www-data /var/www/uemlabs/uploads /var/www/uemlabs/logs
chmod 755 /var/www/uemlabs/uploads
```

4) Configure virtual host (Apache) and enable SSL/HSTS where appropriate.

5) Restart services and test with smoke tests (see `tests/`).

6) Example DB creation helper (edit credentials before running):

```bash
mysql -u root -p < scripts/create_db.sql
```

7) After verification, ensure `APP_ENV=production` in `.env` and remove any debug endpoints.
