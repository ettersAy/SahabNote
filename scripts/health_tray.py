#!/usr/bin/env python3
"""
SahabNote Health Tray Indicator
Lightweight system tray icon that shows green/red based on server health.
"""

import json
import threading
import time
import urllib.request
import urllib.error

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install pystray Pillow")
    exit(1)

HEALTH_URL = "https://sahabnote.onrender.com/api/health"
CHECK_INTERVAL = 30  # seconds

# Create icon images (16x16)
def create_icon(color):
    """Create a 16x16 solid color icon."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([2, 2, 13, 13], fill=color)
    return img

ICON_GREEN = create_icon((34, 197, 94, 255))   # #22c55e
ICON_RED   = create_icon((239, 68, 68, 255))   # #ef4444
ICON_GRAY  = create_icon((107, 114, 128, 255)) # #6b7280

class HealthTray:
    def __init__(self):
        self.icon = None
        self.status = "unknown"
        self.running = True

    def check_health(self):
        """Perform health check and return (status_text, icon)."""
        try:
            req = urllib.request.Request(HEALTH_URL)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                if resp.status == 200 and data.get("status") == "ok":
                    return ("Online", ICON_GREEN)
                else:
                    return ("Error: " + str(data.get("detail", "Unexpected")), ICON_RED)
        except urllib.error.URLError as e:
            return ("Offline: " + str(e.reason), ICON_RED)
        except Exception as e:
            return ("Error: " + str(e), ICON_RED)

    def update_icon(self):
        """Update the tray icon based on health check."""
        status_text, icon_img = self.check_health()
        self.status = status_text
        if self.icon:
            self.icon.icon = icon_img
            self.icon.title = f"SahabNote: {status_text}"

    def periodic_check(self):
        """Run health checks in a background thread."""
        while self.running:
            self.update_icon()
            time.sleep(CHECK_INTERVAL)

    def on_quit(self, icon, item):
        self.running = False
        icon.stop()

    def run(self):
        # Create menu
        menu = pystray.Menu(
            pystray.MenuItem("Check Now", lambda: self.update_icon()),
            pystray.MenuItem("Quit", self.on_quit),
        )

        self.icon = pystray.Icon(
            "sahabnote-health",
            ICON_GRAY,
            "SahabNote: Checking...",
            menu,
        )

        # Start background checker
        checker = threading.Thread(target=self.periodic_check, daemon=True)
        checker.start()

        # Run the tray icon (blocks)
        self.icon.run()

if __name__ == "__main__":
    tray = HealthTray()
    tray.run()
