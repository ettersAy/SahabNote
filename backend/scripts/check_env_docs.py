#!/usr/bin/env python3
"""
Check that all environment variables used in backend/*.py are documented in doc/render-env.md.

Usage:
    python3 backend/scripts/check_env_docs.py

Exit code: 0 if all env vars are documented, 1 if any are missing.
"""

import re
import sys
from pathlib import Path


# -- Paths ---------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
DOC_PATH = PROJECT_ROOT / "doc" / "render-env.md"


def scan_env_vars_in_code() -> set[str]:
    """Scan all backend/*.py files for os.environ.get() and os.getenv() calls."""
    env_vars = set()
    for py_file in sorted(BACKEND_DIR.rglob("*.py")):
        if "scripts" in py_file.parts:
            continue
        content = py_file.read_text()
        # Match os.environ.get("VAR") or os.environ.get('VAR')
        for match in re.finditer(r'os\.environ\.get\(\s*["\']([^"\']+)["\']', content):
            env_vars.add(match.group(1))
        # Match os.getenv("VAR") or os.getenv('VAR')
        for match in re.finditer(r'os\.getenv\(\s*["\']([^"\']+)["\']', content):
            env_vars.add(match.group(1))
    return env_vars


def scan_documented_vars_in_doc() -> set[str]:
    """Scan doc/render-env.md for documented environment variables.

    Looks for:
    1. Variables in the reference table: | `VAR_NAME` |
    2. Variables in headings or inline code: `VAR_NAME`
    """
    if not DOC_PATH.exists():
        print(f"❌ Documentation file not found: {DOC_PATH}")
        sys.exit(1)

    content = DOC_PATH.read_text()
    documented = set()

    # Match table entries: | `VAR_NAME` |
    for match in re.finditer(r'\|\s*`([A-Z_]+)`\s*\|', content):
        documented.add(match.group(1))

    # Match inline code mentions: `VAR_NAME` (for variables not in table)
    for match in re.finditer(r'`([A-Z_]+)`', content):
        documented.add(match.group(1))

    return documented


def main():
    print("=" * 60)
    print("  Environment Variable Documentation Check")
    print("=" * 60)

    # Scan code
    code_vars = scan_env_vars_in_code()
    print(f"\n📦 Found {len(code_vars)} env var(s) in backend/*.py:")
    for var in sorted(code_vars):
        print(f"   - {var}")

    # Scan docs
    doc_vars = scan_documented_vars_in_doc()
    print(f"\n📖 Found {len(doc_vars)} env var(s) documented in doc/render-env.md:")
    for var in sorted(doc_vars):
        print(f"   - {var}")

    # Compare
    undocumented = code_vars - doc_vars
    documented_but_not_in_code = doc_vars - code_vars

    print()
    if undocumented:
        print(f"❌ {len(undocumented)} undocumented env var(s) found in code:")
        for var in sorted(undocumented):
            print(f"   - {var}")
        print("\n   Add these to doc/render-env.md in the reference table.")
        sys.exit(1)
    else:
        print("✅ All env vars in code are documented in doc/render-env.md.")

    if documented_but_not_in_code:
        print(f"\n⚠️  {len(documented_but_not_in_code)} env var(s) documented but not found in code "
              "(may be planned for future use):")
        for var in sorted(documented_but_not_in_code):
            print(f"   - {var}")

    print(f"\n📁 Doc file: {DOC_PATH}")
    print("✅ Check complete.")
    sys.exit(0)


if __name__ == "__main__":
    main()
