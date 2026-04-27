# Render Environment Variable Reference

> **Single source of truth** for every environment variable the SahabNote backend respects.

## Render Free Tier Limitations

The backend is designed to run on Render's free tier. Be aware of these constraints:

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **No Shell access** | The free tier does NOT include a Shell tab. You cannot run `python3 run.py --seed-admin` interactively. | Use environment variables (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) to auto-create admins on startup, or use the admin API endpoints. |
| **Ephemeral filesystem** | SQLite data (`backend/data/sahabnote.db`) is **lost** on restart, redeploy, or sleep wake-up. | Switch to PostgreSQL (set `DATABASE_URL`) for persistent data. SQLite is suitable only for development/testing. |
| **Auto-sleep after 15 min** | The service spins down after 15 minutes of inactivity. | The first request after sleep takes **30–60 seconds** to wake up. Health check services (e.g., UptimeRobot) can keep it warm. |
| **512 MB RAM / 0.1 CPU** | Limited resources for concurrent requests. | The backend is lightweight (FastAPI + SQLite) and fits within these limits for small-scale usage (< 50 concurrent users). |
| **No persistent disk** | Any file written to the container's filesystem (logs, uploads) is lost on restart. | Store all persistent state in the database (SQLite or PostgreSQL). Use external logging services if needed. |

If you need Shell access, persistent storage, or higher resource limits, upgrade to Render's **Starter** (from $7/month) or **Pro** plan.

---

## Environment Variable Reference

| Variable | Required | Default | Description | Set Where |
|----------|----------|---------|-------------|-----------|
| `SAHABNOTE_SECRET` | **Yes** | `change-me-in-production-sahabnote-2024` | JWT signing secret. Used to sign and verify authentication tokens. Must be a strong random string in production. | Render Dashboard → Web Service → Environment tab |
| `ADMIN_USERNAME` | No | *(empty string)* | Username for auto-created admin on startup. If the user already exists, they are promoted to admin. If not set, no admin is created automatically. | Render Dashboard → Web Service → Environment tab |
| `ADMIN_PASSWORD` | No | *(empty string)* | Password for the auto-created admin user. Required together with `ADMIN_USERNAME`. The password is hashed with bcrypt before storage. | Render Dashboard → Web Service → Environment tab |
| `DATABASE_URL` | No | *(not set — uses SQLite)* | PostgreSQL connection string (not yet implemented in code). Reserved for future use when switching from SQLite to PostgreSQL for persistent data. | Render Dashboard → PostgreSQL → Connection string |

### Variable Details

#### `SAHABNOTE_SECRET`
- **Used in**: `backend/auth.py` (line 12)
- **Purpose**: Signing and verifying JWT tokens for authentication.
- **Expected format**: A hex string, 64 characters (32 bytes). Generate with:
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(32))"
  ```
- **⚠️ Production requirement**: MUST be changed from the default value. The default (`change-me-in-production-sahabnote-2024`) is publicly known and would allow anyone to forge authentication tokens.

#### `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- **Used in**: `backend/database.py` (lines 60–61)
- **Purpose**: Auto-create (or promote) an admin user on every server startup. This is the primary way to get admin access on Render's free tier (since there is no Shell access).
- **Expected format**: `ADMIN_USERNAME` is any valid username string. `ADMIN_PASSWORD` is any password string (min 6 characters recommended).
- **Behavior**:
  - If the username does **not** exist → a new user is created with admin privileges.
  - If the username **already exists** but is not an admin → they are promoted to admin.
  - If the username already exists and is already an admin → no action is taken (logged as informational).
  - If either variable is empty or not set → the auto-seeding is skipped entirely.
- **Security note**: Remove or clear these variables after the admin is created if you don't need the auto-promotion on every deploy.

#### `DATABASE_URL`
- **Used in**: Not yet used in code (placeholder for future PostgreSQL support).
- **Purpose**: PostgreSQL connection string for production deployments requiring persistent data.
- **Expected format**: `postgresql://user:password@host:port/database`
- **When available**: Render provides a free PostgreSQL database (1 GB storage) — create one from the Render Dashboard and copy its Internal Connection String.

---

## How to Set Environment Variables on Render

### Step-by-step Instructions

1. **Log in** to [render.com](https://dashboard.render.com)
2. **Navigate** to your web service (e.g., `sahabnote-backend`)
3. Click on the **Environment** tab in the left sidebar
4. Scroll to the **Environment Variables** section
5. Click **Add Environment Variable**
6. For each variable you want to set:
   - Enter the **Key** (e.g., `SAHABNOTE_SECRET`)
   - Enter the **Value** (e.g., the output of `secrets.token_hex(32)`)
   - Click **Save**
7. After adding all variables, click **Manual Deploy** → **Clear build cache & deploy** (or a regular deploy) at the top of the Dashboard to apply the changes.

> 💡 **Tip**: For sensitive values like `SAHABNOTE_SECRET`, you can use Render's "secret file" feature which encrypts the value at rest. However, regular environment variables are sufficient for most use cases.

### Setting Variables via Render API

You can also set environment variables programmatically using the Render API:

```bash
# Requires a Render API key (create one in Account Settings)
curl -X PATCH "https://api.render.com/v1/services/<service-id>/env-vars" \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "envVars": [
      {"key": "SAHABNOTE_SECRET", "value": "<generated-secret>"},
      {"key": "ADMIN_USERNAME", "value": "admin"},
      {"key": "ADMIN_PASSWORD", "value": "<your-password>"}
    ]
  }'
```

> ⚠️ **Note**: The service ID can be found in the URL when viewing your service on Render Dashboard (`https://dashboard.render.com/web/srv-xxxxx`).

---

## Verification Steps

### Verify `SAHABNOTE_SECRET`

The health endpoint indicates whether the server is running, but does **not** expose the secret value. To verify it's set correctly:

1. **Check if the default is still in use** by running the pre-deploy validation script:
   ```bash
   python3 backend/scripts/pre_deploy_check.py
   ```
   The Environment Variable Validation check will warn if `SAHABNOTE_SECRET` is using the default value.

2. **Test authentication still works** after changing the secret:
   ```bash
   # Register a user
   curl -X POST https://sahabnote.onrender.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username": "test-user", "password": "test-pass"}'

   # Login with the same user
   curl -X POST https://sahabnote.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "test-user", "password": "test-pass"}'
   ```
   If both succeed, the secret is working correctly. If the old default was used before the change, existing JWT tokens will be invalidated — users need to log in again.

### Verify `ADMIN_USERNAME` / `ADMIN_PASSWORD`

1. **Check server logs** for startup messages:
   - `[seed_admin] Created admin user '<username>' (ID: <id>)` — admin was created
   - `[seed_admin] User '<username>' promoted to admin (ID: <id>)` — existing user promoted
   - `[seed_admin] User '<username>' is already an admin` — already set up

2. **Check via admin API** (requires admin token):
   ```bash
   # Login as admin
   TOKEN=$(curl -s -X POST https://sahabnote.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "<admin-username>", "password": "<admin-password>"}' \
     | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

   # Check admin stats
   curl -s -H "Authorization: Bearer $TOKEN" \
     https://sahabnote.onrender.com/api/admin/stats
   ```

3. **Access the admin panel**: Open `https://sahabnote.onrender.com/admin.html` in a browser and log in with the admin credentials.

### Verify `DATABASE_URL`

Not implemented yet — no verification needed at this time.

---

## Auto-Detection Script

A helper script `backend/scripts/check_env_docs.py` is available to scan the codebase for undocumented environment variables.

```bash
python3 backend/scripts/check_env_docs.py
```

This script:
- Scans all `backend/*.py` files for `os.environ.get()` and `os.getenv()` calls
- Compares the found variables against those documented in this file (`doc/render-env.md`)
- Reports any undocumented variables so they can be added
- Exits with code 0 if all vars are documented, or code 1 if any are missing
