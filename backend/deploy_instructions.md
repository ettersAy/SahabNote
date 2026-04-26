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

Add the following environment variable in the **Environment** section:

| Key | Value | Description |
|-----|-------|-------------|
| `SAHABNOTE_SECRET` | `<random-secret-string>` | Used for JWT token signing. Generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` |

### 5. Deploy

Click **Create Web Service**. Render will build and deploy your app. The first deployment may take a few minutes.

### 6. Get Your Server URL

Once deployed, Render will give you a URL like `https://sahabnote-backend.onrender.com`. Use this URL in the Chrome extension and Android app settings.

## Updating the Clients

| Client | Setting | Value |
|--------|---------|-------|
| **Chrome Extension** | Server URL | `https://sahabnote-backend.onrender.com` (or your actual URL) |
| **Android App** | Server URL | Hardcoded to `https://sahabnote.onrender.com` in `android/src/App.js` (change `DEFAULT_SERVER_URL` constant) |
| **Desktop App** | Server URL | In settings dialog |

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

## Notes

- The free tier spins down after 15 minutes of inactivity. The first request after inactivity may take 30-60 seconds to wake up.
- Render provides a free PostgreSQL database if you need it (optional).
- For production use, consider upgrading to a paid plan.
- The backend uses SQLite by default, which stores data in `backend/data/sahabnote.db`. This is fine for development but for production you should switch to PostgreSQL.
- **Environment variable `SAHABNOTE_SECRET`**: Must be set for JWT token signing. If not set, the backend falls back to a hardcoded default (`change-me-in-production-sahabnote-2024`) which is insecure for production.
