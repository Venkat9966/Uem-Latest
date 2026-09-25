# UEM Labs Academy

A responsive frontend MVP for an endpoint-management learning platform.

## New in this phase

- Added `dashboard.html`, a student learning dashboard with active enrollments, progress, activity, streak, and access-expiration UI.
- Added `dashboard.css` and `dashboard.js` for the responsive dashboard and demo interactions.
- Added `database/schema.sql` with a Supabase/PostgreSQL model for profiles, courses, sections, lessons, enrollments, progress, access extensions, RLS, and course-access checks.

## Run locally

Open `index.html` or `dashboard.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Deployment / Production checklist

- Update `api/config.php` with production `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASS` values or set corresponding environment variables.
- Configure SMTP credentials as environment variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `APP_EMAIL_FROM`, and `APP_EMAIL_NAME` or define them in `api/email.php`.
- Ensure the `logs/` directory is writable by the webserver user.
- Use HTTPS in production and set secure cookie flags if sessions are used.
- Remove any debug/test scripts and verify `api/signup.php` does not return temporary passwords (already removed).
- Run the SQL in `database/schema.sql` to create required tables, or allow the app to create tables automatically on first request.

## Changelog (summary of applied fixes)

- Replaced non-portable `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with a safe `ensureColumnExists()` helper in `api/db.php`.
- Hardened `api` directory with basic `.htaccess` protections and added an application `logs/` directory.
- Added environment-aware error logging in `api/config.php` (use `APP_ENV=development` locally).
- Removed local test artifacts and debugging responses.

If you want, I can also create a deploy script or provide step-by-step hostinger/AWS shared-host instructions.

The dashboard is currently demo data. To make it production-ready, create a Supabase project, run `database/schema.sql`, add the Supabase client, and replace the demo records with authenticated queries. Stripe and the admin extension workflow can then be connected to the `enrollments` and `access_events` tables.
