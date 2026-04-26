"""Database setup with SQLite and aiosqlite."""

import aiosqlite
import os
from pathlib import Path

DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "sahabnote.db"


async def get_db():
    """Get database connection."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def migrate_db(db):
    """Apply schema migrations safely."""
    # Check if is_admin column exists in users table
    cursor = await db.execute("PRAGMA table_info(users)")
    columns = {row[1] for row in await cursor.fetchall()}

    if "is_admin" not in columns:
        await db.execute(
            "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0"
        )

    # Check if admin_audit_log table exists
    cursor = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='admin_audit_log'"
    )
    if not await cursor.fetchone():
        await db.execute("""
            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                target_user_id INTEGER,
                target_note_id INTEGER,
                details TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (admin_user_id) REFERENCES users(id)
            )
        """)

    await db.commit()


async def seed_admin_from_env(db):
    """Create an admin user from environment variables if they don't exist.
    
    Set ADMIN_USERNAME and ADMIN_PASSWORD in Render environment variables.
    This only runs on first deploy — if the username already exists, it's
    promoted to admin. If not, a new user is created.
    """
    admin_username = os.environ.get("ADMIN_USERNAME", "").strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "").strip()
    
    if not admin_username or not admin_password:
        return  # No admin config in env vars, skip
    
    # Check if user already exists
    cursor = await db.execute(
        "SELECT id, is_admin FROM users WHERE username = ?",
        (admin_username,)
    )
    existing = await cursor.fetchone()
    
    if existing:
        if not existing["is_admin"]:
            await db.execute(
                "UPDATE users SET is_admin = 1 WHERE id = ?",
                (existing["id"],)
            )
            await db.commit()
            print(f"[seed_admin] User '{admin_username}' promoted to admin (ID: {existing['id']})")
        else:
            print(f"[seed_admin] User '{admin_username}' is already an admin")
    else:
        # Create new user as admin
        from auth import hash_password, generate_sync_key
        sync_key = generate_sync_key()
        password_hash = hash_password(admin_password)
        cursor = await db.execute(
            "INSERT INTO users (username, password_hash, sync_key, is_admin) VALUES (?, ?, ?, 1)",
            (admin_username, password_hash, sync_key)
        )
        await db.commit()
        user_id = cursor.lastrowid
        print(f"[seed_admin] Created admin user '{admin_username}' (ID: {user_id})")


async def init_db():
    """Create tables if they don't exist."""
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                sync_key TEXT UNIQUE NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                client_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                version INTEGER NOT NULL DEFAULT 1,
                device_id TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                deleted_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_user_client
                ON notes(user_id, client_id);

            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                target_user_id INTEGER,
                target_note_id INTEGER,
                details TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (admin_user_id) REFERENCES users(id)
            );
        """)
        await db.commit()
    finally:
        await db.close()
