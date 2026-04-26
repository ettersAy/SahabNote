#!/usr/bin/env python3
"""Run the SahabNote backend server."""

import argparse
import asyncio
import sys


async def seed_admin(username: str):
    """Set a user as admin by username."""
    from database import get_db, migrate_db
    db = await get_db()
    try:
        await migrate_db(db)
        cursor = await db.execute(
            "SELECT id, username, is_admin FROM users WHERE username = ?",
            (username,)
        )
        row = await cursor.fetchone()
        if not row:
            print(f"Error: User '{username}' not found.")
            sys.exit(1)

        if row["is_admin"]:
            print(f"User '{username}' is already an admin.")
        else:
            await db.execute(
                "UPDATE users SET is_admin = 1 WHERE id = ?",
                (row["id"],)
            )
            await db.commit()
            print(f"User '{username}' (ID: {row['id']}) is now an admin.")
    finally:
        await db.close()


def main():
    parser = argparse.ArgumentParser(description="SahabNote Backend Server")
    parser.add_argument(
        "--seed-admin",
        type=str,
        help="Set a user as admin by username (run once then start server)",
        default=None,
    )
    args = parser.parse_args()

    if args.seed_admin:
        asyncio.run(seed_admin(args.seed_admin))
        return

    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
