# AI Instructions for SahabNote

When creating new utility scripts or sub‑applications for SahabNote, place them in the `scripts/` directory (or a subfolder within it). This keeps the project root clean and makes it easy for future developers to find all auxiliary tools.

## Guidelines

- **New scripts** → `scripts/`
- **New sub‑applications** (e.g., a CLI tool, a desktop widget) → `scripts/<app-name>/`
- **Documentation** → Update `scripts/README.md` and the main `README.md` to mention the new tool.
- **Dependencies** → List them in the script's docstring and in `scripts/README.md`.

## Existing Scripts

- `scripts/health_tray.py` – Linux system tray health indicator.
- `scripts/health-widget.html` – Browser‑based health widget.

## Future Work

If you are asked to create a health indicator or any other small utility, place it under `scripts/` and update the documentation accordingly.
