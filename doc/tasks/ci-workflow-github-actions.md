# Task: Add GitHub Actions CI Workflow for Pre-Deploy Validation

## Objective
Create a `.github/workflows/pre-deploy-check.yml` workflow that runs the pre-deployment validation script automatically on every PR targeting the `feat/admin-interface` or `main` branch.

## Problem It Solves
The `pre_deploy_check.py` script exists but must be run manually. Adding a CI workflow ensures:
- Every PR is automatically validated before review
- Static file serving issues are caught early (the #1 deployment failure)
- Documentation drift is detected before it reaches production
- The team has a single "gate" for deployment readiness

## Recommended Implementation

### Workflow File: `.github/workflows/pre-deploy-check.yml`

```yaml
name: Pre-Deploy Validation

on:
  push:
    branches: [main, feat/admin-interface]
  pull_request:
    branches: [main, feat/admin-interface]

jobs:
  validate:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio httpx

      - name: Run pre-deploy validation
        run: |
          python3 scripts/pre_deploy_check.py --skip-tests --json
        # Note: --skip-tests is used because tests are run separately below
        # to provide clearer failure output

      - name: Run test suite
        run: |
          python3 -m pytest tests/ -v --tb=short
```

### Optional: Separate Test Job
For cleaner output, split into two jobs:

```yaml
jobs:
  validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r backend/requirements.txt
      - run: python3 backend/scripts/pre_deploy_check.py --json

  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r backend/requirements.txt
      - run: python3 -m pytest backend/tests/ -v --tb=short
```

### Additional Considerations

1. **Cache pip**: Use `actions/setup-python` caching to speed up installs
2. **Secrets**: The `SAHABNOTE_SECRET` env var should be set in GitHub Secrets for the test job
3. **Matrix testing**: Optionally test on Python 3.11 and 3.12
4. **Status badge**: Add a badge to `README.md` showing CI status

## Documentation Updates Required
- Add to `scripts/README.md` — mention the CI workflow exists
- Update `backend/deploy_instructions.md` — add a "CI Integration" note

## Dependencies
- GitHub repository (already configured)
- GitHub Actions enabled (default for public repos)
