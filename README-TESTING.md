UEM Labs — Quick local testing

1) Start PHP built-in server from project root (in a terminal):

```bash
php -S 127.0.0.1:8000
```

2) In another terminal run the smoke tests:

```bash
php tests/test_api_smoke.php
```

Notes:
- The tests are lightweight and non-destructive — they check authentication gating and the forgot-password flow.
- To fully test uploads/list/delete you must log in via the UI (XAMPP) to create a session cookie, or extend the test script to authenticate.
- Ensure `uploads/` directory is writable by PHP and `.htaccess` is respected on Apache.

Full end-to-end test (requires tutor credentials):

```bash
php -S 127.0.0.1:8000
php tests/test_api_full.php --host=http://127.0.0.1:8000 --email=tutor@uemlabs.com --password=tutor123
```

To use a custom file for upload add `--file=path/to/file.json`.
