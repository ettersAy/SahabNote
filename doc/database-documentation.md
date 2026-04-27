# SahabNote Database Documentation

## Overview

SahabNote currently uses **SQLite** as its database. This documentation covers the database schema, how to access and query it, the admin interface, and considerations for data persistence, especially when deployed on Render's free tier.

## Database Schema

The database consists of the following tables:

### `users`
Stores user account information.

| Column | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | `INTEGER` | PRIMARY KEY, AUTOINCREMENT | Unique user ID |
| `username` | `TEXT` | UNIQUE, NOT NULL | User's chosen username |
| `password_hash` | `TEXT` | NOT NULL | Hashed user password (using bcrypt) |
| `sync_key` | `TEXT` | UNIQUE, NOT NULL | Unique key for client synchronization |
| `is_admin` | `INTEGER` | NOT NULL, DEFAULT 0 | Admin flag (1 for admin, 0 for regular user) |
| `created_at` | `TEXT` | NOT NULL, DEFAULT (datetime('now')) | Account creation timestamp |

### `notes`
Stores user notes.

| Column | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | `INTEGER` | PRIMARY KEY, AUTOINCREMENT | Unique note ID |
| `user_id` | `INTEGER` | NOT NULL, FOREIGN Key (users.id) | ID of the user who owns the note |
| `client_id` | `TEXT` | NOT NULL | Identifier from the client device |
| `title` | `TEXT` | NOT NULL, DEFAULT '' | Note title |
| `content` | `TEXT` | NOT NULL, DEFAULT '' | Note content |
| `version` | `INTEGER` | NOT NULL, DEFAULT 1 | Note version for synchronization |
| `device_id` | `TEXT` | NOT NULL, DEFAULT '' | ID of the device that created the note |
| `created_at` | `TEXT` | NOT NULL, DEFAULT (datetime('now')) | Note creation timestamp |
| `updated_at` | `TEXT` | NOT NULL, DEFAULT (datetime('now')) | Note last update timestamp |
| `deleted_at` | `TEXT` | | Soft delete timestamp (NULL if not deleted) |

### `admin_audit_log`
Logs actions performed by administrators.

| Column | Type | Constraints | Description |
|-------|------|------------|-------------|
| `id` | `INTEGER` | PRIMARY KEY, AUTOINCREMENT | Log entry ID |
| `admin_user_id` | `INTEGER` | NOT NULL, Foreign Key (users.id) | ID of the admin who performed the action |
| `action` | `TEXT` | NOT NULL | Description of the action performed |
| `target_user_id` | `INTEGER` | | ID of the user targeted by the action (if applicable) |
| `target_note_id` | `INTEGER` | | ID of the note targeted by the action (if applicable) |
| `details` | `TEXT` | | Additional details about the action |
| `created_at` | `TEXT` | NOT NULL, DEFAULT (datetime('now')) | Timestamp of the action |

### Indexes
- `CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_user_client ON notes(user_id, client_id);`

## Database Access and Querying

### Direct Database Access (via Render Shell)

Since the database is SQLite, you can access it directly using the `sqlite3` command-line tool within the Render container's shell.

**Steps to Access:**
1. Go to your Render service dashboard.
2. Navigate to the **Shell** tab.
3. Use the following commands to interact with the database.

### Common Queries

#### View All Users
```bash
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
db.row_factory = sqlite3.Row
cursor = db.execute('SELECT id, username, is_admin, created_at FROM users')
for row in cursor:
    print(dict(row))
db.close()
"
```

#### View All Notes (with User Info)
```bash
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
db.row_factory = sqlite3.Row
cursor = db.execute('''
    SELECT n.id, n.title, n.content, n.created_at, n.updated_at, u.username
    FROM notes n
    JOIN users u ON n.user_id = u.id
    WHERE n.deleted_at IS NULL
    ORDER BY n.updated_at DESC
''')
for row in cursor:
    print(dict(row))
db.close()
"
```

#### View Deleted Notes (Soft-deleted)
```bash
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
db.row_factory = sqlite3.Row
cursor = db.execute('''
    SELECT n.id, n.title, n.deleted_at, u.username
    FROM notes n
    JOIN users u ON n.user_id = u.id
    WHERE n.deleted_at IS NOT NULL
    ORDER BY n.deleted_at DESC
''')
for row in cursor:
    print(dict(row))
db.close()
"
```

#### Count Notes per User
```bash
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
db.row_factory = sqlite3.Row
cursor = db.execute('''
    SELECT u.id, u.username, COUNT(n.id) as note_count
    FROM users u
    LEFT JOIN notes n ON n.user_id = u.id AND n.deleted_at IS NULL
    GROUP BY u.id, u.username
''')
for row in cursor:
    print(dict(row))
db.close()
"
```

#### View Recent Admin Audit Logs
```bash
python3 -c "
import sqlite3
db = sqlite3.connect('backend/data/sahabnote.db')
db.row_factory = sqlite3.Row
cursor = db.execute('''
    SELECT aal.id, aal.action, aal.details, aal.created_at,
           u_admin.username as admin_username,
           u_target.username as target_username
    FROM admin_audit_log aal
    LEFT JOIN users u_admin ON aal.admin_user_id = u_admin.id
    LEFT JOIN users u_target ON aal.target_user_id = u_target.id
    ORDER BY aal.created_at DESC
    LIMIT 20
''')
for row in cursor:
    print(dict(row))
db.close()
"
```

#### Reset a User's Password
```bash
python3 -c "
from passlib.context import CryptContext
import sqlite3

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
new_password = 'new-password-here'
username_to_update = 'username-here'

password_hash = pwd_context.hash(new_password)

db = sqlite3.connect('backend/data/sahabnote.db')
cursor = db.execute('UPDATE users SET password_hash = ? WHERE username = ?', (password_hash, username_to_update))
db.commit()
db.close()
print(f'Password updated for user: {username_to_update}')
"
```

#### Promote User to Admin (Alternative method)
```bash
python3 -c "
import sqlite3
username_to_promote = 'username-here'

db = sqlite3.connect('backend/data/sahabnote.db')
cursor = db.execute('UPDATE users SET is_admin = 1 WHERE username = ?', (username_to_promote,))
db.commit()
db.close()
print(f'User {username_to_promote} promoted to admin.')
"
```

#### Export All Users (JSON format)
```bash
python3 -c "
import sqlite3, json
db = sqlite3.connect('backend/data/sahabnote.db')
db.row_factory = sqlite3.Row
users = [dict(row) for row in db.execute('SELECT id, username, is_admin, created_at FROM users')]
print(json.dumps(users, indent=2, default=str))
db.close()
"
```

#### Export All Notes (JSON format)
```bash
python3 -c "
import sqlite3, json
db = sqlite3.connect('backend/data/sahabnote.db')
db.row_factory = sqlite3.Row
notes = [dict(row) for row in db.execute('''
    SELECT n.id, n.title, n.content, n.created_at, n.updated_at, n.deleted_at, u.username
    FROM notes n
    JOIN users u ON n.user_id = u.id
''')]
print(json.dumps(notes, indent=2, default=str))
db.close()
"
```

## Admin Interface

The admin interface provides a web-based way to manage users and notes.

### Accessing the Admin Panel

1.  **URL**: `https://your-server-url.onrender.com/admin.html`
    *   Example: `https://sahabnote.onrender.com/admin.html`
2.  **Login**: Use the username and password of a user account that has `is_admin = 1`.
3.  **Server URL**: You may need to enter the backend server URL if not auto-detected.

### Admin Panel Features

*   **Dashboard Stats**: Overview of total users, total notes, active notes, average notes per user, and number of admins.
*   **User Management**:
    *   List all users with their ID, username, role (admin/user), number of notes, masked sync key, and creation date.
    *   View all notes for a specific user (with content preview).
    *   View the full content of any note in a modal.
    *   Soft-delete or hard-delete a note.
    *   Reset a user's sync key (invalidates existing sessions).
    *   Copy a user's sync key (copies the masked version for security).
*   **Audit Log**: View a log of actions performed by administrators.

### Admin API Endpoints

These endpoints require a valid JWT token from an admin user.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Dashboard statistics (total users, notes, etc.). |
| `GET` | `/api/admin/users` | List all users (sync keys are masked). |
| `GET` | `/api/admin/users/{id}/notes` | List notes for a specific user. |
| `GET` | `/api/admin/users/{id}/notes/{nid}` | Get full content of a specific note. |
| `DELETE` | `/api/admin/users/{id}/notes/{nid}` | Delete a note (soft delete by default, add `?hard_delete=true` for permanent). |
| `POST` | `/api/admin/users/{id}/reset-sync-key` | Reset a user's sync key. |
| `GET` | `/api/admin/audit-log` | View the admin action audit log. |

### Creating an Admin User

There is no default admin account. You must promote an existing user:

1.  **Register a User**: First, register a user via any client (web app, extension, etc.).
2.  **Promote to Admin**:
    *   **Via Render Shell (Recommended for production)**:
        ```bash
        # In Render Shell
        python3 run.py --seed-admin your-username
        ```
    *   **Direct SQLite Query**:
        ```bash
        # In Render Shell or locally
        python3 -c "
        import sqlite3
        db = sqlite3.connect('backend/data/sahabnote.db')
        db.execute('UPDATE users SET is_admin = 1 WHERE username = \"your-username\"')
        db.commit()
        print('User promoted to admin')
        db.close()
        "
        ```
    *   **Environment Variables (on first deploy)**: Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Render environment variables.

## Data Persistence and Render Free Tier

### Ephemeral Filesystem

*   Render's free tier uses an **ephemeral filesystem**.
*   The SQLite database file (`backend/data/sahabnote.db`) is stored locally within the container.
*   If the container sleeps (after 15 minutes of inactivity) or is redeployed, all data in the local filesystem is **lost**.

### Implications

*   **User accounts, notes, and admin settings will be erased** upon container restart or redeployment.
*   This is suitable for development or short-term testing but **not for production** with persistent data.

### Solutions for Persistent Data

1.  **Upgrade Render Plan**: Move to a paid Render plan that offers persistent storage.
2.  **Use Render PostgreSQL**: Render provides a free PostgreSQL database service.
    *   Create a PostgreSQL instance in your Render dashboard.
    *   Set the `DATABASE_URL` environment variable for your web service.
    *   Modify the backend code (`database.py`) to use `asyncpg` or another PostgreSQL adapter instead of `aiosqlite`.
    *   *Note: This migration is not yet implemented in the current codebase.*
3.  **Mount a Persistent Disk**: Render allows attaching persistent volumes to services. Store the SQLite database on this volume.
    *   Configure this in your service settings on Render.
4.  **External Database**: Use any external PostgreSQL or MySQL database and connect via `DATABASE_URL`.

### Health Check and Admin Interface Status

The `/api/health` endpoint includes information about the admin interface:
```bash
curl https://sahabnote.onrender.com/api/health
```
Look for `"admin_interface": true` in the JSON response to confirm the admin panel is accessible.

## Database Initialization and Migrations

### Initialization (`init_db` function in `database.py`)
*   Creates the `users`, `notes`, and `admin_audit_log` tables if they don't exist.
*   Sets up the unique index on `notes(user_id, client_id)`.

### Migrations (`migrate_db` function in `database.py`)
*   **`is_admin` column**: Adds the `is_admin` column to the `users` table if it doesn't exist (defaults to 0).
*   **`admin_audit_log` table**: Creates the `admin_audit_log` table if it doesn't exist.

### Seeding Admin from Environment (`seed_admin_from_env` function)
*   If `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables are set:
    *   Checks if the user exists. If so, promotes them to admin if not already.
    *   If the user doesn't exist, creates a new user with admin privileges.
*   This runs on every deploy if the environment variables are present.

## Security Considerations

*   **Password Hashing**: Uses `bcrypt` for secure password storage.
*   **Sync Key**: Unique per user, used for client synchronization. Masked in the admin interface for security.
*   **Admin Privileges**: Strictly controlled via the `is_admin` flag. Admin API endpoints require a valid JWT from an admin user.
*   **Soft Deletes**: Notes are soft-deleted by default (setting `deleted_at` timestamp), allowing potential restoration by an admin. Hard deletes are possible via the admin API with a query parameter.
*   **JWT Secret**: The `SAHABNOTE_SECRET` environment variable must be set for secure JWT signing. A default fallback exists but is insecure for production.

## Backup and Recovery

### Current SQLite on Render Free Tier
*   **Automatic Backups**: None on the free tier due to ephemeral storage.
*   **Manual Export**:
    *   Use the Python snippets in the "Common Queries" section to export data as JSON.
    *   You could write a script to periodically export data and store it elsewhere (e.g., cloud storage, email).
*   **Recovery**: Only possible from a manual export. Data lost due to container restart is gone without a backup.

### If Migrating to PostgreSQL
*   Render PostgreSQL instances include automated backups.
*   Point-in-time recovery would be possible.

## Future Considerations

*   **PostgreSQL Migration**: The primary recommendation for production is to migrate to PostgreSQL for better performance, concurrency, and reliability.
*   **Database Migrations**: A more robust migration system (e.g., Alembic) would be beneficial for schema changes in a production environment.
*   **Connection Pooling**: For a production database like PostgreSQL, implementing connection pooling would be important.