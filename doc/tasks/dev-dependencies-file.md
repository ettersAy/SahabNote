# Task: Create a Dev Dependencies File

## Objective
Create `backend/requirements-dev.txt` that separates production dependencies from development/test dependencies.

## Problem It Solves
Currently:
- `backend/requirements.txt` includes `pytest`, `pytest-asyncio`, and `httpx` which are test-only dependencies
- The `health_tray.py` script requires `pystray` and `Pillow` but these aren't listed anywhere
- The `pre_deploy_check.py` script needs `pytest`, `uvicorn`, and backend deps to run fully
- No single place to install "everything needed for development"

A separate dev requirements file makes it clear what's needed for production vs development.

## Recommended Implementation

### Create `backend/requirements-dev.txt`

```
# Dev/test dependencies for SahabNote backend
# Install with: pip install -r backend/requirements-dev.txt

-r requirements.txt

# Testing
pytest==8.3.4
pytest-asyncio==0.25.0
httpx==0.28.1

# Script dependencies
pystray>=0.19.0
Pillow>=10.0.0
```

### Update `backend/requirements.txt`

Remove the dev-only dependencies (`pytest`, `pytest-asyncio`, `httpx`) from `requirements.txt` so production deployments install only what's needed.

### Optional: Create `scripts/requirements.txt`

```
# Dependencies for scripts/ utility scripts
# Install with: pip install -r scripts/requirements.txt

pystray>=0.19.0
Pillow>=10.0.0
```

## Documentation Updates Required

1. **`backend/deploy_instructions.md`** — Update the build command section:
   - "Build Command": Change from `pip install -r backend/requirements.txt` to clarify that dev deps are separate
   - Add a "Local Development Setup" section that mentions `requirements-dev.txt`

2. **`scripts/README.md`** — Add a note about the dev requirements file and how to install script dependencies

3. **`.clinerules`** — Add a note about which requirements file to use for what purpose

4. **`start_backend.sh`** — Update to install dev dependencies

## Dependencies
- Standard Python pip
- No code changes needed, just file changes
