# Roadmap: Automated Incident Report Generation

## Objective

Extend the existing `moudakkir` MCP server (the note taker) with an `incident_report.create` tool that automates the creation of standardized incident reports in `doc/incidents/`.

## Problem It Solves

Currently, the AI agent must manually:
1. Gather structured information (symptoms, root cause, fix, etc.)
2. Format it as Markdown
3. Write it to the correct file path
4. Optionally create a linking note

This is redundant because the agent already has all this information in its working memory during the debug/fix cycle. An automated tool would:
- Save 3-5 minutes per incident
- Ensure consistent formatting (using TEMPLATE.md)
- Eliminate file write permission issues (the MCP server handles this)
- Auto-link incidents to notes for cross-referencing

## Recommended Implementation

### Option A: Extend `moudakkir` with a new tool

Add a `incident_report.create` tool with these parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | yes | Short descriptive title |
| `component` | string | yes | Path to component (e.g., `chrome-extension/`) |
| `severity` | enum | yes | Low / Medium / High / Critical |
| `status` | enum | yes | Resolved / In Progress / Won't Fix |
| `symptoms` | string | yes | Error messages, stack traces observed |
| `root_causes` | array | yes | List of {title, cause, code_before, fix} objects |
| `actions` | array | yes | List of {action, file, description} objects |
| `lessons` | array | no | Prevention checklist items |
| `commands_used` | string | no | Investigation commands/snippets |
| `related_pr_number` | int | no | PR number for cross-reference |
| `related_branch` | string | no | Branch name |
| `create_note` | boolean | no | Whether to also create a linking note (default: true) |

**Behavior:**
1. Generate filename: `doc/incidents/YYYY-MM-DD_{slug}.md` (slug from title)
2. Fill the TEMPLATE.md structure with provided data
3. Write the file to the project (MCP server handles path permissions)
4. If `create_note: true`, also call `moudakkir.add_note` with a summary linking to the file
5. Return the file path and note ID

### Option B: Create a standalone Python script + MCP server

If modifying `moudakkir` is too invasive, create a new small MCP server (e.g., `incident-logger`) that:
- Accepts the same parameters via MCP tool calls
- Writes incident files using Python's `pathlib` (avoids shell escaping)
- Optionally integrates with `moudakkir` for note creation

## Expected Benefits

- **Zero-effort incident documentation** — agent calls one tool at end of fix
- **Consistent format** — every incident follows TEMPLATE.md
- **Searchable knowledge base** — `doc/incidents/` becomes a valuable debugging resource
- **Faster future diagnoses** — similar errors can be found by searching past incidents
- **Reduced manual overhead** — no redundant typing between PR description, commit message, and incident report

## Pre-requisites

- Python 3.10+ (for MCP SDK)
- Understanding of `moudakkir` server architecture (likely Python/ FastMCP)
- Write access to the `moudakkir` repository/codebase

## Documentation Updates Required

1. Update `doc/incidents/TEMPLATE.md` if structure changes
2. Add a README section in `doc/incidents/README.md` explaining:
   - What incidents are
   - How to create one (via agent or manually)
   - Naming convention: `YYYY-MM-DD_short-slug.md`
   - Convention: commit incident to the same branch as the fix

## Open Questions

1. Should the tool auto-detect the project root, or require it as a parameter?
2. Should it support multiple incident formats (e.g., security incidents vs. bug incidents)?
3. Should it integrate with the `gh` CLI to auto-fetch PR details?
