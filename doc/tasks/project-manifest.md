# Task: Create a Project Manifest File

## Objective
Create a `.project-index.json` file at the project root that lists all key source files, their purpose, and their relationships. This allows AI agents to quickly understand the project structure without reading many files individually.

## Problem It Solves
Every mission starts with a "scatter-read" pattern: the AI agent reads 10-20 files to understand the project before it can start working. A manifest file would:
- Reduce setup time in future missions
- Provide a single source of truth for file locations and purposes
- Prevent confusion about where things live (e.g., `scripts/` vs `backend/scripts/`)

## Recommended Structure

```json
{
  "project": "SahabNote",
  "version": "1.0.0",
  "files": {
    "backend": {
      "main.py": { "purpose": "FastAPI application entry point", "routes": ["/api/health"], "imports": ["database", "routes/*"] },
      "auth.py": { "purpose": "JWT token creation/validation, password hashing", "depends_on": ["jose", "passlib"] },
      "database.py": { "purpose": "SQLite setup with aiosqlite, schema migrations", "produces": "backend/data/sahabnote.db" },
      "models.py": { "purpose": "Pydantic models for request/response validation" },
      "run.py": { "purpose": "CLI runner with --seed-admin flag" },
      "deploy_instructions.md": { "purpose": "Deployment guide for Render" },
      "requirements.txt": { "purpose": "Python dependencies for production" },
      "scripts/": { "purpose": "Backend-specific utility scripts" },
      "routes/": {
        "auth_routes.py": { "purpose": "POST /api/auth/register, /login, /sync-key-login, /verify" },
        "note_routes.py": { "purpose": "CRUD /api/v1/notes" },
        "sync_routes.py": { "purpose": "POST /api/v1/sync/push, GET /pull, POST /resolve-conflict" },
        "admin_routes.py": { "purpose": "Admin API /api/admin/*" }
      },
      "tests/": {
        "test_api.py": { "purpose": "26 integration tests covering auth, notes, sync, admin" }
      }
    },
    "scripts/": {
      "health_tray.py": { "purpose": "Linux system tray health indicator" },
      "health-widget.html": { "purpose": "Browser-based health widget" },
      "upgrade-expo.sh": { "purpose": "Expo SDK upgrade helper" }
    },
    "clients": {
      "android": { "purpose": "Expo React Native app (Expo SDK 54)" },
      "chrome-extension": { "purpose": "MV3 Chrome extension for quick note capture" },
      "desktop": { "purpose": "Python Tkinter desktop app" },
      "web": { "purpose": "Thin HTML/JS web client" }
    }
  },
  "environment_variables": {
    "SAHABNOTE_SECRET": { "required": true, "default": "change-me-in-production-sahabnote-2024", "purpose": "JWT signing key" },
    "ADMIN_USERNAME": { "required": false, "purpose": "Auto-create admin on deploy" },
    "ADMIN_PASSWORD": { "required": false, "purpose": "Admin user password" }
  }
}
```

## Requirements

- **Location**: `/.project-index.json` (project root)
- **Maintained manually** or updated by AI agents when they create/modify files
- **Include docstring**: A comment at the top explaining how to update it
- **Keep it concise**: Only list key files, not every line of code

## Documentation Updates Required
- Add a note in `.clinerules`: "Before starting work, read `.project-index.json` for a map of the project"
- Add to `README.md` if desired

## Effort Estimate
- Small: 15-30 minutes to create the initial manifest
- Ongoing: Update when new files/directories are added
