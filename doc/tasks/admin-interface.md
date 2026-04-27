# Admin Interface for SahabNote

**Objective**: Build an admin interface (web page) that allows an admin to view all registered users, their sync keys, and manage their notes (list, read, soft-delete).

**Background**: Currently there is no admin interface. Users and their data can only be managed by directly querying the SQLite database at `backend/data/sahabnote.db`. This task is to provide a simple, secure way to see and manage users and notes without shell access to the server.

---

## Requirements

### 1. Admin Authentication

- Add an `is_admin` boolean field to the `users` table (default: `false`)
- Create an admin seeding mechanism: either:
  - Set `is_admin=true` for the first registered user automatically, OR
  - Add a config environment variable `ADMIN_USER_ID` in backend, OR
  - Create a CLI command `python3 run.py --seed-admin <username>`
- Admin endpoints should require admin-level authentication (check `is_admin` flag in a new dependency)

### 2. Admin API Endpoints (in `backend/routes/`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List all users (id, username, sync_key preview, note count, created_at) |
| `GET` | `/api/admin/users/{user_id}/notes` | List all notes for a specific user (with content preview) |
| `GET` | `/api/admin/users/{user_id}/notes/{note_id}` | Get full note content |
| `DELETE` | `/api/admin/users/{user_id}/notes/{note_id}` | Hard-delete or soft-delete a note |
| `POST` | `/api/admin/users/{user_id}/reset-sync-key` | Reset a user's sync key |
| `GET` | `/api/admin/stats` | Dashboard stats (total users, total notes, notes per user avg) |

### 3. Admin Web UI (simple, under `web/admin.html`)

- A single HTML page with inline CSS/JS (or under `web/` folder)
- Should have:
  - Login form (username + password, same as regular auth)
  - Dashboard with stats cards (total users, notes, etc.)
  - Users table (click to expand/show notes)
  - Notes table per user (read, search, delete)
  - Sync key display with copy button
- **No build step** — plain HTML/CSS/JS (like the existing `web/index.html`)
- Use the existing SyncClient pattern (fetch with Bearer token)

### 4. Security Considerations

- Use a new dependency `fastapi.Depends(get_current_admin_id)` that checks:
  - User is authenticated (existing JWT/sync-key check)
  - User has `is_admin = true`
- Log all admin actions (create a simple `admin_audit` table or log to file)
- Rate-limit admin endpoints to prevent abuse
- Admin UI is only accessible at `/admin.html` — no link from the main app pages

### 5. Database Changes

- Add column `is_admin INTEGER NOT NULL DEFAULT 0` to `users` table
- Add column `notes_count` or compute on-the-fly via JOIN
- Optional: Add `admin_audit_log` table with columns: `id, admin_user_id, action, target_user_id, target_note_id, details, created_at`

---

## Files to Modify

```
backend/
├── main.py                     # Add admin router
├── database.py                 # Add admin_audit table
├── models.py                   # Add admin Pydantic models
├── auth.py                     # Add get_current_admin_id dependency
├── routes/
│   └── admin_routes.py         # NEW - Admin API routes
├── requirements.txt            # No changes needed
web/
└── admin.html                  # NEW - Admin web interface
```

---

## Acceptance Criteria

- [ ] Admin can log in with their regular credentials (auto-detected as admin)
- [ ] Admin sees a dashboard with stats (user count, note count)
- [ ] Admin can list all users with their sync keys (masked)
- [ ] Admin can view all notes for a specific user
- [ ] Admin can read full note content
- [ ] Admin can delete notes
- [ ] Admin can reset a user's sync key
- [ ] Non-admin users get 403 Forbidden on admin endpoints
- [ ] All admin actions are logged
- [ ] The admin page is responsive and usable on mobile

---

## Future Improvements (optional, not in scope)

- Pagination for users/notes lists
- Search/filter users by username
- Export all data as JSON
- Create/edit notes as admin
- Impersonate user (see their view)
