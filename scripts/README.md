# SahabNote Scripts

This directory contains lightweight utility scripts for monitoring and interacting with the SahabNote backend.

## Files

### `health_tray.py`
A system tray indicator for Linux (Cinnamon/GNOME/KDE) that periodically checks the health endpoint and shows a green/red icon.

**Dependencies:**
```bash
pip install pystray Pillow
```

**Usage:**
```bash
python3 scripts/health_tray.py
```

Right-click the tray icon to check now or quit.

### `health-widget.html`
A standalone HTML page that displays a green/red circle indicating server health. Opens in any browser.

**Usage:**
Open the file in a browser:
```bash
xdg-open scripts/health-widget.html
```

The widget auto-refreshes every 30 seconds.

### `pre_deploy_check.py` (Backend Script)

Located at `backend/scripts/pre_deploy_check.py`, this is a pre-deployment validation script that checks:
- Module imports work correctly
- All pytest tests pass
- Static files serve correctly (with `--live`)
- Documentation is up to date
- Environment variables are properly configured
- Health endpoint responds correctly (with `--live`)

**Usage:**
```bash
python3 backend/scripts/pre_deploy_check.py        # Quick check
python3 backend/scripts/pre_deploy_check.py --live  # Full check with server
python3 backend/scripts/pre_deploy_check.py --json  # JSON output for CI
```

See the [deploy instructions](../backend/deploy_instructions.md) for more details.

## Adding New Scripts

Place any new utility scripts in this directory (or under `backend/scripts/` for backend-related scripts) and update this README accordingly.
