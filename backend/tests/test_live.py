"""Live integration tests: starts a real uvicorn server and tests it via HTTP.

This catches issues that pytest TestClient doesn't surface, such as:
- Static file serving (app.mount behavior differs with uvicorn)
- Catch-all route behavior
- Middleware ordering
- Production-like request handling

Usage:
    python3 -m pytest backend/tests/test_live.py -v
    
    # Or run standalone:
    python3 backend/tests/test_live.py
"""
import subprocess, sys, time, os, json, urllib.request, urllib.error
from pathlib import Path

# Paths
BACKEND_DIR = Path(__file__).parent.parent.resolve()
DB_PATH = BACKEND_DIR / "data" / "sahabnote.db"
PORT = 19999  # Use a high port to avoid conflicts
BASE = f"http://127.0.0.1:{PORT}"

# Ensure we're in the backend directory
os.chdir(str(BACKEND_DIR))


def start_server():
    """Start uvicorn and wait for it to be ready."""
    # Clean DB for fresh test
    if DB_PATH.exists():
        DB_PATH.unlink()

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--host", "127.0.0.1", "--port", str(PORT), "--log-level", "warning"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )

    # Wait for server to be ready (up to 10 seconds)
    for _ in range(20):
        time.sleep(0.5)
        try:
            r = urllib.request.urlopen(f"{BASE}/api/health", timeout=2)
            if r.status == 200:
                return proc
        except (urllib.error.URLError, ConnectionRefusedError):
            continue

    proc.terminate()
    raise RuntimeError("Server failed to start")


def stop_server(proc):
    """Stop the server gracefully."""
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def request(method, path, data=None, headers=None):
    """Make an HTTP request and return (status_code, body_dict_or_raw_string)."""
    url = f"{BASE}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(
        url, data=json.dumps(data).encode() if data else None,
        headers=req_headers, method=method
    )
    try:
        r = urllib.request.urlopen(req, timeout=10)
        body = r.read().decode()
        try:
            return r.status, json.loads(body)
        except json.JSONDecodeError:
            return r.status, body  # Return raw string for HTML responses
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body


class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def check(self, name, condition, detail=""):
        if condition:
            self.passed += 1
            print(f"  [PASS] {name}")
        else:
            self.failed += 1
            msg = f"[FAIL] {name}: {detail}"
            self.errors.append(msg)
            print(f"  {msg}")

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*50}")
        print(f"Results: {self.passed}/{total} passed", end="")
        if self.failed:
            print(f", {self.failed} failed")
            for e in self.errors:
                print(f"  - {e}")
        else:
            print()
        print(f"{'='*50}")
        return self.failed == 0


def run_all_tests():
    """Run all live integration tests."""
    t = TestResult()

    print(f"Starting server on port {PORT}...")
    proc = start_server()
    print("Server ready.\n")

    try:
        # === Static Files ===
        print("[Static Files]")
        status, _ = request("GET", "/admin.html")
        t.check("admin.html serves 200", status == 200, f"Got {status}")

        status2, _ = request("GET", "/index.html")
        t.check("index.html serves 200", status2 == 200, f"Got {status2}")

        status3, _ = request("GET", "/static/admin.html")
        t.check("/static/admin.html serves 200", status3 == 200, f"Got {status3}")

        # === API Routes take priority ===
        print("\n[API Routes]")
        status4, body = request("GET", "/api/health")
        t.check("/api/health serves 200", status4 == 200, f"Got {status4}")
        t.check("health has admin_interface field", "admin_interface" in body, str(body))

        status5, _ = request("GET", "/api/admin/stats")
        t.check("admin/stats without auth returns 401", status5 == 401, f"Got {status5}")

        # === Registration + Auth ===
        print("\n[Auth]")
        status6, body = request("POST", "/api/auth/register",
                                 {"username": "livetest", "password": "testpass"})
        t.check("registration works", status6 == 200, str(body))
        token = body.get("data", {}).get("access_token", "")

        status7, body = request("GET", "/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        t.check("non-admin gets 403", status7 == 403, f"Got {status7}")

        # === Admin promotion via SQLite ===
        import sqlite3
        db = sqlite3.connect(str(DB_PATH))
        db.execute("UPDATE users SET is_admin = 1 WHERE username = ?", ("livetest",))
        db.commit()
        db.close()

        # Login again to get fresh token
        _, body = request("POST", "/api/auth/login",
                          {"username": "livetest", "password": "testpass"})
        admin_token = body.get("data", {}).get("access_token", "")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # === Admin API ===
        print("\n[Admin API]")
        status8, body = request("GET", "/api/admin/stats", headers=admin_headers)
        t.check("admin stats works", status8 == 200, str(body))
        t.check("admin count is 1", body.get("data", {}).get("admin_count") == 1,
                str(body.get("data")))

        status9, body = request("GET", "/api/admin/users", headers=admin_headers)
        t.check("list users works", status9 == 200, str(body))
        users = body.get("data", {}).get("users", [])
        t.check("has at least 1 user", len(users) >= 1, str(len(users)))
        t.check("sync key is masked", "..." in users[0].get("sync_key_preview", ""),
                users[0].get("sync_key_preview", ""))

        # === Notes CRUD ===
        print("\n[Notes CRUD]")
        status10, body = request("POST", "/api/v1/notes",
                                  {"client_id": "live-test-note", "title": "Live Test",
                                   "content": "Hello from live test"},
                                  headers=admin_headers)
        t.check("create note works", status10 == 200, str(body))
        note_id = body.get("data", {}).get("note", {}).get("id")

        # Get user ID
        user_id = users[0]["id"]

        status11, body = request("GET", f"/api/admin/users/{user_id}/notes", headers=admin_headers)
        t.check("list user notes works", status11 == 200, str(body))
        t.check("has 1 note", len(body.get("data", {}).get("notes", [])) == 1, str(body.get("data")))

        status12, body = request("GET", f"/api/admin/users/{user_id}/notes/{note_id}",
                                  headers=admin_headers)
        t.check("read full note works", status12 == 200, str(body))
        t.check("content matches", body.get("data", {}).get("note", {}).get("content") == "Hello from live test",
                str(body.get("data")))

        status13, _ = request("DELETE", f"/api/admin/users/{user_id}/notes/{note_id}",
                               headers=admin_headers)
        t.check("delete note works", status13 == 200, f"Got {status13}")

        status14, body = request("GET", f"/api/admin/users/{user_id}/notes/{note_id}",
                                  headers=admin_headers)
        t.check("note is soft-deleted (has deleted_at)",
                body.get("data", {}).get("note", {}).get("deleted_at") is not None,
                str(body.get("data")))

        # === Reset sync key ===
        print("\n[Admin Actions]")
        status15, body = request("POST", f"/api/admin/users/{user_id}/reset-sync-key",
                                  headers=admin_headers)
        t.check("reset sync key works", status15 == 200, str(body))
        t.check("new key returned", "new_sync_key" in body.get("data", {}),
                str(body.get("data")))

        # === Audit log ===
        status16, body = request("GET", "/api/admin/audit-log", headers=admin_headers)
        t.check("audit log works", status16 == 200, str(body))
        t.check("has log entries", len(body.get("data", {}).get("logs", [])) >= 4,
                str(len(body.get("data", {}).get("logs", []))))

        return t.summary()

    finally:
        stop_server(proc)


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
