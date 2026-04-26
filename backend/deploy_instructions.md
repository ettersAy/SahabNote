# Deploying SahabNote Backend to Render (Free Tier)

This guide explains how to deploy the FastAPI backend to Render's free tier so your Chrome extension can sync notes over the internet.

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
- **Build Command**: `pip install --only-binary :all: -r backend/requirements.txt`
- **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free

### 4. Set Environment Variables (Optional)

If you need to set environment variables (like `DATABASE_URL`), add them in the **Environment** section.

### 5. Deploy

Click **Create Web Service**. Render will build and deploy your app. The first deployment may take a few minutes.

### 6. Get Your Server URL

Once deployed, Render will give you a URL like `https://sahabnote-backend.onrender.com`. Use this URL in the Chrome extension settings.

## Admin Panel

The admin panel is accessible at `/admin.html` (e.g., `https://sahabnote-backend.onrender.com/admin.html`).

### Making a User Admin

After deployment, promote a user to admin via the CLI:

```bash
cd backend && python3 run.py --seed-admin <username>
```

This sets `is_admin = 1` in the `users` table. The user can then log in at `/admin.html` with their regular credentials.

### Admin API Endpoints

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

### Database Migrations

On startup, the server automatically applies schema migrations:
- Adds `is_admin` column to existing `users` table
- Creates `admin_audit_log` table if it doesn't exist

No manual migration steps are needed.

## Updating the Chrome Extension

1. Open the extension options page
2. Set **Server URL** to `https://sahabnote-backend.onrender.com`
3. Register or login to get your sync key
4. Start syncing!

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
