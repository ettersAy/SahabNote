# Task: Create Render Environment Variable Reference

## Objective
Create a centralized `doc/render-env.md` file that documents every environment variable the backend respects, with its purpose, expected format, whether it's required or optional, and default value.

## Problem It Solves
Currently, environment variables are scattered across:
- `backend/main.py` — (nothing read from env here directly)
- `backend/auth.py` — reads `SAHABNOTE_SECRET`
- `backend/database.py` — reads `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- `backend/deploy_instructions.md` — documents some but not all

There is no single source of truth. When a new env var is added (like `ADMIN_USERNAME` in this mission), it's easy to forget to document it everywhere it should be. Additionally, Render free tier limitations are not documented anywhere.

## Recommended Implementation Details

### File Location
`doc/render-env.md`

### Required Content

1. **Render Free Tier Limitations**
   - No Shell access — alternative methods must be provided (env vars, API endpoints)
   - Ephemeral filesystem — SQLite data is lost on restart/redeploy
   - Auto-sleep after 15 min of inactivity
   - 512 MB RAM, 0.1 CPU
   - First request after sleep takes 30-60s to wake up

2. **Complete Environment Variable Table**

| Variable | Required | Default | Description | Set Where |
|----------|----------|---------|-------------|-----------|
| `SAHABNOTE_SECRET` | Yes | `change-me-in-production-sahabnote-2024` | JWT signing secret. Generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` | Render Env tab |
| `ADMIN_USERNAME` | No | (empty) | Username for auto-created admin on startup | Render Env tab |
| `ADMIN_PASSWORD` | No | (empty) | Password for auto-created admin | Render Env tab |
| `DATABASE_URL` | No | (none, uses SQLite) | PostgreSQL connection string (not yet implemented) | Future |

3. **How to Set Each Variable**
   - Screenshot-like instructions (text-based steps with exact button labels)
   - Links to Render dashboard sections

4. **Verification Steps**
   - How to confirm each variable is set correctly
   - API calls or health checks to verify

### Cross-Reference in Deploy Instructions
Add a note in `backend/deploy_instructions.md` pointing to this file:
> For a complete list of all environment variables, see [Render Environment Reference](../doc/render-env.md)

### Auto-Detection Script (Bonus)
A small Python script that:
- Scans `backend/*.py` for `os.environ.get()` and `os.getenv()` calls
- Compares against the documented vars in `doc/render-env.md`
- Reports undocumented env vars so they can be added

## Expected Benefits
- Single source of truth for all config
- New team members (or AI sessions) can immediately see what needs to be configured
- Reduces the "I forgot to tell you about the env var" problem
- Documents Render free tier limitations once, not in every deploy guide

## Documentation Updates Required
- Update `.clinerules` to reference `doc/render-env.md` when discussing deployment
- Add a link from `backend/deploy_instructions.md` to this file

## Dependencies
- None (pure documentation)

## Future Improvements
- Could generate the env var table automatically by scanning `os.environ.get` calls
- Could add a GitHub Actions check that the doc is in sync with the code
