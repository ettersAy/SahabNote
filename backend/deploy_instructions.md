# Deploying SahabNote Backend to Render (Free Tier)

> **Current production deployment**: https://sahabnote.onrender.com
> This is already deployed and running. The instructions below are for creating a new instance or redeploying.

## Prerequisites

- A GitHub account
- Your code pushed to a GitHub repository

## Steps

### 1. Create a Render Account

Go to [render.com](https://render.com) and sign up using your GitHub account.

### 2. Create a New Web Service

- Click **New +** → **Web Service**
- Connect your GitHub repository
- Select the repository containing the backend code

### 3. Configure the Service

- **Name**: `sahabnote-backend` (or any name)
- **Region**: Choose the closest to you
- **Branch**: `main` (or your default branch)
- **Runtime**: `Python 3.12` (select "Python 3" and then choose version 3.12 in the dropdown)
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free

> ⚠️ **Do NOT use `--only-binary :all:`** in the build command. Some dependencies like `bcrypt` and `pydantic-core` require binary wheels that may not match the platform. The build command should be simply `pip install -r backend/requirements.txt`.

### 4. Set Environment Variables (Required)

Add the following environment variables in the **Environment** section:

| Key | Value | Description |
|-----|-------|-------------|
| `SAHABNOTE_SECRET` | `<random-secret-string>` | Used for JWT token signing. Generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `ADMIN_USERNAME` | `admin` | (Optional) Auto-create an admin user on first deploy |
| `ADMIN_PASSWORD` | `<your-admin-password>` | (Optional) Password for the admin user above |

> 💡 **Tip**: If you set both `ADMIN_USERNAME` and `ADMIN_PASSWORD`, the server will automatically create that user as an admin on every deploy (or promote them if they already exist). This is the easiest way to get admin access on Render's free tier — no Shell needed.

### 5. Deploy

Click **Create Web Service**. Render will build and deploy your app. The first deployment may take a few minutes.

### 6. Get Your Server URL

Once deployed, Render will give you a URL like `https://sahabnote-backend.onrender.com`. Use this URL in the Chrome extension and Android app settings.

## Admin Panel

The admin panel is a web interface at `/admin.html` — e.g. `https://sahabnote.onrender.com/admin.html`

> **Important**: There is NO default admin account. You must create one yourself (see below).

### How to Access the Admin Panel

1. Open `https://sahabnote.onrender.com/admin.html` in your browser
2. You will see a login form asking for **Server URL**, **Username**, and **Password**
3. Enter the server URL (if not pre-filled), then your regular user credentials
4. If your account has admin privileges, you will see the dashboard. If not, you'll get a "not an admin" error.

### Creating an Admin User

Since there is no registration form on the admin page, you need to:

**Step 1 — Register a regular user first** via any client:
- Open the main web app at `https://sahabnote.onrender.com/index.html` and register
- Or register via the API: `POST /api/auth/register` with `{"username": "yourname", "password": "yourpass"}`

**Step 2 — Promote the user to admin** using one of these methods:

#### Option A: Run the seed command locally (if you have the code)
```bash
# From your local project directory
cd backend && python3 run.py --seed-admin your-username
```

#### Option B: Use Render's Shell Console (recommended for production)
1. Go to [render.com](https://dashboard.render.com) and log in
2. Click on your web service (`sahabnote-backend` or similar)
3. Go to the **Shell** tab (in the top navigation bar)
4. A terminal will open inside your running container. Run:
```bash
python3 run.py --seed-admin your-username
```
5. You should see: `User 'your-username' (ID: 1) is now an admin.`

#### Option C: Direct SQLite (if you have database access)
```bash
# Inside Render Shell or locally
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
db.execute('UPDATE users SET is_admin = 1 WHERE username = \"your-username\"')
db.commit()
print('User promoted to admin')
db.close()
"
```

**Step 3 — Log in at `/admin.html`** with the same username and password you used to register.

> 💡 **Tip**: The health endpoint (`/api/health`) now reports whether the admin interface is available. Check with:
> ```bash
> curl https://sahabnote.onrender.com/api/health
> ```
> If `"admin_interface": true` is shown, the admin page is accessible.

### What You Can Do in the Admin Panel

| Feature | How |
|---------|-----|
| **Dashboard stats** | Cards at the top show total users, notes, active notes, avg per user, admin count |
| **List users** | The users table shows ID, username, role, note count, masked sync key, created date |
| **View user notes** | Click on any user row to expand their notes (with content preview) |
| **Read full note** | Click "View" on any note to see the full content in a modal |
| **Delete a note** | Click "Delete" on any active note (soft-delete — restorable by an admin) |
| **Reset sync key** | Click "Reset Key" on any user — this invalidates all their existing sync sessions |
| **Copy sync key** | Click "Copy" (note: only the masked preview is copied for security) |

### Admin API Endpoints (for developers)

All admin endpoints require a valid JWT token from a user with `is_admin = true`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Dashboard stats (total users, notes, avg) |
| `GET` | `/api/admin/users` | List all users (masked sync keys) |
| `GET` | `/api/admin/users/{id}/notes` | List notes for a user |
| `GET` | `/api/admin/users/{id}/notes/{nid}` | Full note content |
| `DELETE` | `/api/admin/users/{id}/notes/{nid}` | Soft-delete (or `?hard_delete=true` for hard-delete) |
| `POST` | `/api/admin/users/{id}/reset-sync-key` | Reset a user's sync key |
| `GET` | `/api/admin/audit-log` | View admin action audit log |

## Updating the Clients

| Client | Setting | Value |
|--------|---------|-------|
| **Chrome Extension** | Server URL | `https://sahabnote-backend.onrender.com` (or your actual URL) |
| **Android App** | Server URL | Hardcoded to `https://sahabnote.onrender.com` in `android/src/App.js` (change `DEFAULT_SERVER_URL` constant) |
| **Desktop App** | Server URL | In settings dialog |

## Database Management on Render

Render does NOT provide a phpMyAdmin-like interface. The backend uses **SQLite**, which is a single file stored at `backend/data/sahabnote.db` inside the running container.

### How to Access the Database

1. Go to [render.com dashboard](https://dashboard.render.com)
2. Click on your web service
3. Go to the **Shell** tab
4. Once in the shell terminal, you can:

#### View all users
```bash
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
for row in db.execute('SELECT id, username, is_admin, created_at FROM users'):
    print(row)
db.close()
"
```

#### Count notes per user
```bash
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
for row in db.execute('SELECT u.id, u.username, COUNT(n.id) as notes FROM users u LEFT JOIN notes n ON n.user_id = u.id GROUP BY u.id'):
    print(row)
db.close()
"
```

#### View recent admin audit logs
```bash
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
for row in db.execute('SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 10'):
    print(row)
db.close()
"
```

#### Reset a user's password (if needed)
```bash
python3 -c "
from passlib.context import CryptContext
import sqlite3
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
hash = pwd.hash('new-password-here')
db = sqlite3.connect('backend/data/sahabnote.db')
db.execute('UPDATE users SET password_hash = ? WHERE username = ?', (hash, 'username-here'))
db.commit()
db.close()
print('Password updated')
"
```

### Download the Database File (for backup/inspection)

Render's shell doesn't allow direct file download, but you can:

1. Go to the **Shell** tab
2. Copy the database to a temporary HTTP-accessible location (not recommended for production with sensitive data), or:
3. Use the admin API to export data:
```bash
# List all users with their note counts (JSON output)
python3 -c "
import sqlite3, json
db = sqlite3.connect('backend/data/sahabnote.db')
db.row_factory = sqlite3.Row
users = [dict(row) for row in db.execute('SELECT id, username, is_admin, created_at FROM users')]
print(json.dumps(users, indent=2, default=str))
db.close()
"
```

> **Note**: Render's free tier uses an **ephemeral filesystem**. This means the database file can be lost if the service restarts or is redeployed. For production with persistent data, you MUST switch to PostgreSQL (see below).

### Switching to PostgreSQL (for persistent data)

Render provides a free PostgreSQL database. To use it:

1. Create a PostgreSQL database from the Render dashboard
2. Set the `DATABASE_URL` environment variable in your web service
3. Modify `database.py` to use `aiosqlite` for SQLite or a PostgreSQL adapter

> This migration is not yet implemented. The current codebase only supports SQLite.

## Pre-Deploy Validation

Before deploying to production, run the pre-deployment validation script to catch common issues:

```bash
python3 backend/scripts/pre_deploy_check.py
```

This script performs the following checks:

| # | Check | Description |
|---|-------|-------------|
| 1 | **Module Import** | Verifies `main:app` imports without errors |
| 2 | **Pytest Suite** | Runs all tests and reports failures |
| 3 | **Live Server** | (requires `--live`) Starts uvicorn, verifies static files and API routes |
| 4 | **Docs Freshness** | Scans for undocumented env vars, web files, and routes |
| 5 | **Env Vars** | Checks `SAHABNOTE_SECRET` is not default, lists expected vars |
| 6 | **Health Check** | (requires `--live`) Hits `/api/health` and validates response |

### Usage

```bash
# Quick check (offline, no server needed)
python3 backend/scripts/pre_deploy_check.py

# Full check with live server validation
python3 backend/scripts/pre_deploy_check.py --live

# JSON output (useful for CI integration)
python3 backend/scripts/pre_deploy_check.py --json

# Skip slow tests
python3 backend/scripts/pre_deploy_check.py --skip-tests --live
```

> The script returns **exit code 0** if all checks pass, or **exit code 1** if any check fails.

## Troubleshooting

### Build fails with "Could not find a version that satisfies pydantic-core==X.Y.Z"

**Cause**: The `pydantic` version pinned in `requirements.txt` requires a `pydantic-core` version that has been yanked from PyPI.

**Fix**: Update `pydantic` to a newer version in `requirements.txt`:
```bash
# Check available versions
curl -s https://pypi.org/pypi/pydantic/json | python3 -c "import json,sys;d=json.load(sys.stdin);[print(v) for v in sorted([v for v in d['releases'] if v.replace('.','').isdigit()], key=lambda v:[int(x) for x in v.split('.')])[-10:] if not any(f.get('yanked') for f in d['releases'][v])]"
```

Then update `requirements.txt` with the new version and redeploy.

### Build fails with "bcrypt: No matching distribution found"

**Cause**: The `--only-binary :all:` flag prevents building from source, and no pre-built wheel matches the platform.

**Fix**: Remove `--only-binary :all:` from the build command. Use just `pip install -r backend/requirements.txt`.

## Pre-Deploy Validation

Before deploying to production, run the pre-deployment validation script to catch common issues:

```bash
python3 backend/scripts/pre_deploy_check.py
```

This script performs the following checks:

| # | Check | Description |
|---|-------|-------------|
| 1 | **Module Import** | Verifies `main:app` imports without errors |
| 2 | **Pytest Suite** | Runs all tests and reports failures |
| 3 | **Live Server** | (requires `--live`) Starts uvicorn, verifies static files and API routes |
| 4 | **Docs Freshness** | Scans for undocumented env vars, web files, and routes |
| 5 | **Env Vars** | Checks `SAHABNOTE_SECRET` is not default, lists expected vars |
| 6 | **Health Check** | (requires `--live`) Hits `/api/health` and validates response |

### Usage

```bash
# Quick check (offline, no server needed)
python3 backend/scripts/pre_deploy_check.py

# Full check with live server validation
python3 backend/scripts/pre_deploy_check.py --live

# JSON output (useful for CI integration)
python3 backend/scripts/pre_deploy_check.py --json

# Skip slow tests
python3 backend/scripts/pre_deploy_check.py --skip-tests --live
```

> The script returns **exit code 0** if all checks pass, or **exit code 1** if any check fails.

## Notes

- The free tier spins down after 15 minutes of inactivity. The first request after inactivity may take 30-60 seconds to wake up.
- Render provides a free PostgreSQL database if you need it (optional).
- For production use, consider upgrading to a paid plan.
- The backend uses SQLite by default, which stores data in `backend/data/sahabnote.db`. This is fine for development but for production you should switch to PostgreSQL.
- **Environment variable `SAHABNOTE_SECRET`**: Must be set for JWT token signing. If not set, the backend falls back to a hardcoded default (`change-me-in-production-sahabnote-2024`) which is insecure for production.
