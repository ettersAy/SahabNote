#!/usr/bin/env python3
"""
SahabNote Pre-Deployment Validation Script.

Usage:
    python3 backend/scripts/pre_deploy_check.py [--live] [--port PORT]

Validates the backend is ready for deployment by running automated checks
against the codebase and optionally a live server instance.

Exit code: 0 if all checks pass, 1 if any check fails.
"""

import argparse
import importlib
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path


# -- Paths -------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
WEB_DIR = PROJECT_ROOT / "web"
DEPLOY_DOCS = BACKEND_DIR / "deploy_instructions.md"


# -- Utilities ---------------------------------------------------------------

class CheckResult:
    """Represents the result of a single validation check."""

    def __init__(self, name: str):
        self.name = name
        self.passed = True
        self.details: dict = {}
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def fail(self, message: str):
        self.passed = False
        self.errors.append(message)

    def warn(self, message: str):
        self.warnings.append(message)

    def to_dict(self) -> dict:
        result = {"passed": self.passed}
        if self.details:
            result.update(self.details)
        if self.warnings:
            result["warnings"] = self.warnings
        if self.errors:
            result["errors"] = self.errors
        return result

    def __str__(self) -> str:
        status = "✅ PASS" if self.passed else "❌ FAIL"
        lines = [f"  {status}  {self.name}"]
        for w in self.warnings:
            lines.append(f"       ⚠️  {w}")
        for e in self.errors:
            lines.append(f"       ❌  {e}")
        return "\n".join(lines)


def print_header(text: str):
    """Print a section header."""
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}")


def print_summary(results: list[CheckResult]):
    """Print the final summary of all checks."""
    print_header("Summary")
    all_passed = all(r.passed for r in results)
    passed_count = sum(1 for r in results if r.passed)
    total_count = len(results)
    print(f"  {passed_count}/{total_count} checks passed")
    for r in results:
        print(f"  {'✅' if r.passed else '❌'} {r.name}")
    print()
    if all_passed:
        print("  🎉 All checks passed! Ready to deploy.")
    else:
        print("  ❌ Some checks failed. Review the errors above before deploying.")
    print()


# -- Check 1: Module Import Check -------------------------------------------

def check_imports() -> CheckResult:
    """Verify that main:app can be imported without errors."""
    result = CheckResult("Module Import Check")

    try:
        # Change to backend directory so relative imports work
        orig_cwd = os.getcwd()
        os.chdir(str(BACKEND_DIR))

        # Add backend to sys.path
        sys.path.insert(0, str(BACKEND_DIR))

        # Try importing the main app
        from main import app
        result.passed = True
        result.details["import"] = "main:app imported successfully"
        print(f"  ℹ️  FastAPI app title: {app.title}")
        print(f"  ℹ️  FastAPI app version: {app.version}")

        # Check routes are registered
        routes = [r.path for r in app.routes]
        expected_prefixes = ["/api/health", "/api/auth", "/api/v1", "/api/admin", "/api/v1/sync"]
        missing = [p for p in expected_prefixes if not any(r.startswith(p) for r in routes)]
        if missing:
            result.warn(f"Expected route prefixes not found: {missing}")
        else:
            result.details["routes_registered"] = len(routes)

        os.chdir(orig_cwd)
    except Exception as e:
        result.fail(f"Import failed: {e}\n{traceback.format_exc()}")
    finally:
        # Clean up sys.path modification
        if str(BACKEND_DIR) in sys.path:
            sys.path.remove(str(BACKEND_DIR))

    return result


# -- Check 2: Pytest Suite ---------------------------------------------------

def check_tests() -> CheckResult:
    """Run the pytest suite and verify all tests pass."""
    result = CheckResult("Pytest Suite")

    test_dir = BACKEND_DIR / "tests"
    if not test_dir.exists():
        result.fail(f"Test directory not found: {test_dir}")
        return result

    print(f"  ℹ️  Running pytest in {BACKEND_DIR}...")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short"],
            cwd=str(BACKEND_DIR),
            capture_output=True,
            text=True,
            timeout=120,
        )
        result.details["output"] = proc.stdout
        result.details["return_code"] = proc.returncode

        if proc.returncode == 0:
            result.passed = True
            # Extract test count from output
            match = re.search(r"=+ ([\d]+) passed", proc.stdout)
            count = int(match.group(1)) if match else 0
            result.details["count"] = count
            result.details["failed"] = 0
            print(f"  ℹ️  All {count} tests passed.")
        else:
            result.fail("Some tests failed")
            result.details["failed"] = proc.stdout.count("FAILED")
            # Show failed test names
            for line in proc.stdout.splitlines():
                if "FAILED" in line:
                    print(f"  ❌  {line.strip()}")
    except subprocess.TimeoutExpired:
        result.fail("Tests timed out (120s)")
    except FileNotFoundError as e:
        result.fail(f"Could not run pytest: {e}")

    return result


# -- Check 3: Live Server Static File Check ----------------------------------

def check_live_server(port: int) -> CheckResult:
    """Start uvicorn and verify static files and API routes."""
    result = CheckResult("Live Server Checks")

    # Check for a static file mount in the app
    sys.path.insert(0, str(BACKEND_DIR))
    try:
        from main import app
        routes = [r.path for r in app.routes]
        has_static_mount = any("static" in str(type(r)) or "/" == r.path for r in app.routes)
    except Exception:
        has_static_mount = False
    finally:
        if str(BACKEND_DIR) in sys.path:
            sys.path.remove(str(BACKEND_DIR))

    # Start uvicorn server in background
    import urllib.request
    import urllib.error

    server_proc = None
    try:
        print(f"  ℹ️  Starting uvicorn on port {port}...")
        server_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=str(BACKEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Wait for server to start
        base_url = f"http://127.0.0.1:{port}"
        for attempt in range(15):
            time.sleep(1)
            try:
                urllib.request.urlopen(f"{base_url}/api/health", timeout=2)
                break
            except urllib.error.URLError:
                if attempt == 14:
                    result.fail("Server failed to start within 15 seconds")
                    return result

        # Check health endpoint
        print(f"  ℹ️  Checking /api/health...")
        try:
            resp = urllib.request.urlopen(f"{base_url}/api/health", timeout=5)
            data = json.loads(resp.read().decode())
            if data.get("status") == "ok":
                result.details["health"] = "ok"
                print(f"  ℹ️  Health endpoint: {json.dumps(data)}")
            else:
                result.warn(f"Health endpoint returned unexpected data: {data}")
        except Exception as e:
            result.warn(f"Health endpoint check failed: {e}")

        # Check static files if they exist in web/
        static_files_checked = []
        if WEB_DIR.exists():
            for fname in ["admin.html", "index.html"]:
                fpath = WEB_DIR / fname
                if fpath.exists():
                    static_files_checked.append(fname)
                    try:
                        resp = urllib.request.urlopen(f"{base_url}/{fname}", timeout=5)
                        if resp.status == 200:
                            print(f"  ℹ️  /{fname} → 200 OK")
                        else:
                            result.warn(f"/{fname} returned status {resp.status}")
                    except urllib.error.HTTPError as e:
                        result.warn(f"/{fname} → {e.code} (static mount may not be configured)")
                    except Exception as e:
                        result.warn(f"/{fname} check failed: {e}")

            result.details["files_checked"] = static_files_checked
        else:
            result.warn(f"Web directory not found at {WEB_DIR}")

        # Check API route priority: /api/health should work, not be caught by catch-all
        try:
            resp = urllib.request.urlopen(f"{base_url}/api/health", timeout=5)
            if resp.status == 200:
                result.details["api_routes_working"] = True
        except Exception as e:
            result.warn(f"API route check failed: {e}")

    finally:
        if server_proc:
            server_proc.terminate()
            try:
                server_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_proc.kill()

    return result


# -- Check 4: Documentation Freshness Check ----------------------------------

def check_docs_freshness() -> CheckResult:
    """Verify documentation is up to date with code changes."""
    result = CheckResult("Documentation Freshness")

    warnings = []

    # 4a. Check if new files in web/ are mentioned in deploy_instructions.md
    if WEB_DIR.exists():
        web_files = sorted(f.name for f in WEB_DIR.iterdir() if f.is_file() and f.suffix in {".html"})
    else:
        web_files = []

    if DEPLOY_DOCS.exists():
        docs_content = DEPLOY_DOCS.read_text()
        for fname in web_files:
            if fname not in docs_content:
                result.warn(f"File 'web/{fname}' is not mentioned in deploy_instructions.md")
    elif web_files:
        result.warn(f"deploy_instructions.md not found, but web/ has files: {web_files}")

    # 4b. Scan for environment variables via os.environ.get calls
    env_vars_found = set()
    for py_file in BACKEND_DIR.rglob("*.py"):
        if "scripts" in py_file.parts:
            continue
        content = py_file.read_text()
        for match in re.finditer(r'os\.environ\.get\(["\\']([^"\\']+)["\\']', content):
            env_vars_found.add(match.group(1))

    # Check which env vars are documented
    if DEPLOY_DOCS.exists():
        docs_content = DEPLOY_DOCS.read_text()
        documented_vars = set(re.findall(r'\| `([A-Z_]+)` \|', docs_content))
        undocumented = env_vars_found - documented_vars
        if undocumented:
            for var in sorted(undocumented):
                result.warn(f"Environment variable '{var}' is used in code but not documented in deploy_instructions.md")
        else:
            result.details["env_vars_documented"] = list(env_vars_found)

    # 4c. Check if new routes have tests
    route_patterns = set()
    for py_file in sorted(BACKEND_DIR.rglob("*.py")):
        if "tests" in py_file.parts or "scripts" in py_file.parts or py_file.name == "__init__.py":
            continue
        content = py_file.read_text()
        for match in re.finditer(r'@router\.(get|post|put|delete|patch)\(["\\']([^"\\']+)["\\']', content):
            route_patterns.add(f"{match.group(1).upper()} {match.group(2)}")

    # Read test file to check which routes are tested
    test_file = BACKEND_DIR / "tests" / "test_api.py"
    if test_file.exists():
        test_content = test_file.read_text()
        untested_routes = []
        for route in sorted(route_patterns):
            # Normalize: e.g. "GET /api/health" -> look for "health" in test
            method, path = route.split(" ", 1)
            path_slug = path.rstrip("/").split("/")[-1] or "health"
            if path_slug not in test_content and path not in test_content:
                untested_routes.append(route)

        if untested_routes:
            for route in untested_routes:
                result.warn(f"Route {route} may not have tests")
        else:
            result.details["routes_tested_count"] = len(route_patterns)

    return result


# -- Check 5: Environment Variable Validation --------------------------------

def check_env_vars() -> CheckResult:
    """Validate environment variables are set correctly."""
    result = CheckResult("Environment Variable Validation")

    warnings = []

    # Check SAHABNOTE_SECRET
    secret = os.environ.get("SAHABNOTE_SECRET", "")
    default_secret = "change-me-in-production-sahabnote-2024"
    if not secret:
        result.warn("SAHABNOTE_SECRET is not set (will use fallback default)")
    elif secret == default_secret:
        result.warn("SAHABNOTE_SECRET is using the default value - CHANGE IT for production!")
    else:
        result.details["SAHABNOTE_SECRET"] = "set (custom value)"

    # List all expected env vars
    expected_vars = {
        "SAHABNOTE_SECRET": "JWT token signing key",
        "ADMIN_USERNAME": "(Optional) Auto-create admin user",
        "ADMIN_PASSWORD": "(Optional) Password for admin user",
        "DATABASE_URL": "(Optional) PostgreSQL connection string",
    }

    defined = {}
    undefined = {}
    for var, desc in expected_vars.items():
        if os.environ.get(var):
            defined[var] = desc
        else:
            undefined[var] = desc

    result.details["defined_vars"] = list(defined.keys()) if defined else []
    if undefined:
        for var, desc in undefined.items():
            if var in ("ADMIN_USERNAME", "ADMIN_PASSWORD"):
                continue  # These are genuinely optional
            result.warn(f"Environment variable '{var}' is not set ({desc})")

    return result


# -- Check 6: Health Endpoint Check (via live server) ------------------------

def check_health_endpoint(port: int, skip_live: bool = False) -> CheckResult:
    """Start server and verify the health endpoint returns expected data."""
    result = CheckResult("Health Endpoint")

    if skip_live:
        result.details["skipped"] = "Use --live to run live server checks"
        return result

    import urllib.request
    import urllib.error

    server_proc = None
    try:
        print(f"  ℹ️  Starting server on port {port}...")
        server_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=str(BACKEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        base_url = f"http://127.0.0.1:{port}"
        # Wait for server
        for attempt in range(10):
            time.sleep(1)
            try:
                urllib.request.urlopen(f"{base_url}/api/health", timeout=2)
                break
            except urllib.error.URLError:
                if attempt == 9:
                    result.fail("Server failed to start")
                    return result

        # Hit /api/health
        resp = urllib.request.urlopen(f"{base_url}/api/health", timeout=5)
        data = json.loads(resp.read().decode())
        print(f"  ℹ️  Response: {json.dumps(data, indent=2)}")

        expected_fields = {"status": "ok", "service": "sahabnote-api", "version": "1.0.0"}
        for key, expected in expected_fields.items():
            if key not in data:
                result.warn(f"Missing expected field '{key}' in health response")
            elif data[key] != expected:
                result.warn(f"Field '{key}' expected '{expected}', got '{data[key]}'")

        if data.get("status") == "ok":
            result.passed = True
            result.details["health_status"] = data

    except Exception as e:
        result.fail(f"Health endpoint check failed: {e}")
    finally:
        if server_proc:
            server_proc.terminate()
            try:
                server_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_proc.kill()

    return result


# -- Main --------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="SahabNote Pre-Deployment Validation Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Run live server checks (starts uvicorn on a random port)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=0,
        help="Port for live server checks (default: random available port)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON (useful for CI integration)",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip pytest execution (useful when tests take long)",
    )
    return parser.parse_args()


def find_free_port() -> int:
    """Find a free TCP port."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    args = parse_args()

    port = args.port or find_free_port()
    print(f"\n🔍 SahabNote Pre-Deployment Validation")
    print(f"   Backend: {BACKEND_DIR}")
    print(f"   Project: {PROJECT_ROOT}")
    if args.live:
        print(f"   Live server port: {port}")
    print()

    results: list[CheckResult] = []

    # Check 1: Module Import
    print_header("1/6  Module Import Check")
    r1 = check_imports()
    print(r1)
    results.append(r1)

    # Check 2: Pytest Suite
    print_header("2/6  Pytest Suite")
    if args.skip_tests:
        r2 = CheckResult("Pytest Suite")
        r2.details["skipped"] = "Skipped via --skip-tests"
        print(r2)
    else:
        r2 = check_tests()
        print(r2)
    results.append(r2)

    # Check 3: Live Server Static File Check
    print_header("3/6  Live Server Static File Check")
    if args.live:
        r3 = check_live_server(port)
        print(r3)
    else:
        r3 = CheckResult("Live Server Static File Check")
        r3.details["skipped"] = "Use --live to run live server checks"
        print(f"  ⏭️   Skipped (use --live flag)")
    results.append(r3)

    # Check 4: Documentation Freshness
    print_header("4/6  Documentation Freshness")
    r4 = check_docs_freshness()
    print(r4)
    results.append(r4)

    # Check 5: Environment Variables
    print_header("5/6  Environment Variable Validation")
    r5 = check_env_vars()
    print(r5)
    results.append(r5)

    # Check 6: Health Endpoint
    print_header("6/6  Health Endpoint Check")
    if args.live:
        r6 = check_health_endpoint(port)
        print(r6)
    else:
        r6 = CheckResult("Health Endpoint")
        r6.details["skipped"] = "Use --live to run live server checks"
        print(f"  ⏭️   Skipped (use --live flag)")
    results.append(r6)

    # Summary
    print_summary(results)

    if args.json:
        output = {
            "passed": all(r.passed for r in results),
            "checks": {r.name: r.to_dict() for r in results},
        }
        print(json.dumps(output, indent=2))

    sys.exit(0 if all(r.passed for r in results) else 1)


if __name__ == "__main__":
    main()
