# Task: Create Pre-Deployment Checklist Script

## Objective
Create a `scripts/pre_deploy_check.sh` (or `.py`) that validates the backend is ready for deployment by running automated checks against the codebase and a live server instance.

## Problem It Solves
Currently, every change is manually verified. There is no automated way to answer "is the server ready to deploy?" This has caused:
- Static file serving broken in production despite passing pytest (TestClient doesn't simulate uvicorn mounts accurately)
- Missing documentation after code changes
- No validation that environment variables are documented

## Recommended Implementation Details

### Script Location
`backend/scripts/pre_deploy_check.py` (Python, to reuse existing imports)

### Checks to Perform

1. **Module Import Check**
   - Can `main:app` be imported without errors?
   - Catch import-time exceptions (missing deps, syntax errors)

2. **Pytest Suite**
   - Run `python3 -m pytest tests/` and verify all tests pass
   - Report which tests failed if any

3. **Live Server Static File Check**
   - Start uvicorn on a random port
   - Verify `/admin.html` returns 200 with expected content
   - Verify `/index.html` returns 200
   - Verify `/static/admin.html` returns 200 (if mount exists)
   - Verify API routes like `/api/health` still work and prioritize over catch-all

4. **Documentation Freshness Check**
   - If a new file exists in `web/`, verify it's mentioned in `backend/deploy_instructions.md`
   - If a new environment variable exists (scan `os.environ.get` calls), verify it's documented
   - If a new route exists, verify it's documented or has tests

5. **Environment Variable Validation**
   - Check if `SAHABNOTE_SECRET` is using the default value (`change-me-in-production-sahabnote-2024`)
   - Warn if default is detected
   - List all expected env vars vs what's defined

6. **Health Endpoint Check**
   - Start server, hit `/api/health`
   - Verify `status: ok` and expected fields exist

### Output Format
```json
{
  "passed": true/false,
  "checks": {
    "imports": {"passed": true},
    "tests": {"passed": true, "count": 26, "failed": 0},
    "static_files": {"passed": true, "files_checked": ["admin.html", "index.html"]},
    "docs_freshness": {"passed": true, "warnings": []},
    "env_vars": {"passed": true, "warnings": ["SAHABNOTE_SECRET uses default value"]},
    "health": {"passed": true}
  }
}
```

### Integration
- Should be callable as: `python3 backend/scripts/pre_deploy_check.py`
- Return exit code 0 if all checks pass, 1 otherwise
- Can be added as a GitHub Actions step or Render deploy hook

## Expected Benefits
- Catches static file serving issues before deploy (the #1 failure in this mission)
- Ensures documentation stays in sync with code
- Provides a single command to validate deployment readiness
- Reduces manual verification time

## Documentation Updates Required
- Add to `backend/deploy_instructions.md` — a "Pre-Deploy Validation" section
- Add to `scripts/README.md` — mention the script exists and how to use it
- Add to `.clinerules` — so future AI sessions run this before any deploy-related PR

## Dependencies
- Python 3.10+
- `requests` (or use `urllib` from stdlib to keep it dependency-free)
- Access to the backend directory
