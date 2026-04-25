"""Sync routes for push/pull synchronization."""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from typing import Optional

from database import get_db
from models import (
    SyncPushRequest, SyncPullResponse, NoteResponse,
    SyncConflictResolution, ApiResponse,
)
from auth import get_current_user_id

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


def row_to_note(row) -> dict:
    return {
        "id": row["id"],
        "client_id": row["client_id"],
        "title": row["title"],
        "content": row["content"],
        "version": row["version"],
        "device_id": row["device_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "deleted_at": row["deleted_at"],
    }


@router.post("/push", response_model=ApiResponse)
async def push_changes(
    push_data: SyncPushRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Push local note changes to the server."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db = await get_db()
    synced = []
    conflicts = []
    try:
        for item in push_data.notes:
            # Check if note exists by client_id
            cursor = await db.execute(
                "SELECT * FROM notes WHERE user_id = ? AND client_id = ?",
                (user_id, item.client_id)
            )
            existing = await cursor.fetchone()

            if existing:
                if item.deleted:
                    # Mark as deleted
                    await db.execute(
                        "UPDATE notes SET deleted_at=?, version=version+1, updated_at=? WHERE id=?",
                        (now, now, existing["id"])
                    )
                    synced.append({"client_id": item.client_id, "status": "deleted"})
                elif item.version < existing["version"]:
                    # Conflict: server has a newer version
                    conflicts.append({
                        "client_id": item.client_id,
                        "server_version": existing["version"],
                        "local_version": item.version,
                        "server_note": row_to_note(existing),
                    })
                else:
                    # Update the note (last-write-wins if same version)
                    new_version = existing["version"] + 1
                    await db.execute(
                        """UPDATE notes SET title=?, content=?, version=?, device_id=?, updated_at=?
                           WHERE id=?""",
                        (item.title, item.content, new_version, item.device_id, now, existing["id"])
                    )
                    synced.append({"client_id": item.client_id, "status": "updated", "version": new_version})
            else:
                if item.deleted:
                    synced.append({"client_id": item.client_id, "status": "skipped"})
                    continue
                # Create new note
                cursor = await db.execute(
                    """INSERT INTO notes (user_id, client_id, title, content, version, device_id, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (user_id, item.client_id, item.title, item.content, item.version, item.device_id, now, now)
                )
                synced.append({"client_id": item.client_id, "status": "created"})

        await db.commit()

        result = {
            "synced": synced,
            "conflicts": conflicts,
        }
        message = f"Pushed {len(synced)} notes, {len(conflicts)} conflicts"
        return ApiResponse(success=len(conflicts) == 0, data=result, message=message)
    finally:
        await db.close()


@router.get("/pull", response_model=ApiResponse)
async def pull_changes(
    since: Optional[str] = None,
    user_id: int = Depends(get_current_user_id),
):
    """Pull changes from server since a given timestamp."""
    db = await get_db()
    try:
        if since:
            cursor = await db.execute(
                """SELECT * FROM notes
                   WHERE user_id = ? AND updated_at > ?
                   ORDER BY updated_at ASC""",
                (user_id, since)
            )
        else:
            cursor = await db.execute(
                """SELECT * FROM notes
                   WHERE user_id = ?
                   ORDER BY updated_at ASC""",
                (user_id,)
            )
        rows = await cursor.fetchall()
        notes = [row_to_note(row) for row in rows]

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        return ApiResponse(
            success=True,
            data={"notes": notes, "server_time": now}
        )
    finally:
        await db.close()


@router.post("/resolve-conflict", response_model=ApiResponse)
async def resolve_conflict(
    resolution: SyncConflictResolution,
    user_id: int = Depends(get_current_user_id),
):
    """Resolve a sync conflict by choosing which version to keep."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM notes WHERE user_id = ? AND client_id = ?",
            (user_id, resolution.client_id)
        )
        existing = await cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Note not found")

        if not resolution.keep_local:
            # Keep server version - just acknowledge
            return ApiResponse(
                success=True,
                data={"note": row_to_note(existing)},
                message="Keeping server version"
            )
        else:
            # Keep local version - version already incremented
            await db.execute(
                "UPDATE notes SET version = version + 1 WHERE id = ?",
                (existing["id"],)
            )
            await db.commit()
            cursor = await db.execute(
                "SELECT * FROM notes WHERE id = ?", (existing["id"],)
            )
            updated = await cursor.fetchone()
            return ApiResponse(
                success=True,
                data={"note": row_to_note(updated)},
                message="Keeping local version"
            )
    finally:
        await db.close()
