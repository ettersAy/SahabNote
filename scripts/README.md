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

## Adding New Scripts

Place any new utility scripts in this directory and update this README accordingly.
