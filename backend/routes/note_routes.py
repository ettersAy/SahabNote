"""CRUD routes for notes."""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime, timezone

from database import get_db
from models import (
    NoteCreate, NoteUpdate, NoteResponse, ApiResponse,
)
from auth import get_current_user_id

router = APIRouter(prefix="/api/v1", tags=["notes"])


def row_to_note(row) -> dict:
    """Convert a database row to a note dict."""
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


@router.get("/notes", response_model=ApiResponse)
async def list_notes(
    include_deleted: bool = False,
    user_id: int = Depends(get_current_user_id),
):
    """List all notes for the authenticated user."""
    db = await get_db()
    try:
        if include_deleted:
            cursor = await db.execute(
                "SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,)
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC",
                (user_id,)
            )
        rows = await cursor.fetchall()
        notes = [row_to_note(row) for row in rows]
        return ApiResponse(success=True, data={"notes": notes})
    finally:
        await db.close()


@router.get("/notes/{note_id}", response_model=ApiResponse)
async def get_note(
    note_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Get a single note by ID."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        return ApiResponse(success=True, data={"note": row_to_note(row)})
    finally:
        await db.close()


@router.post("/notes", response_model=ApiResponse)
async def create_note(
    note: NoteCreate,
    user_id: int = Depends(get_current_user_id),
):
    """Create a new note. Uses client_id as unique identifier per user."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db = await get_db()
    try:
        # Check if client_id already exists for this user (upsert behavior)
        cursor = await db.execute(
            "SELECT id FROM notes WHERE user_id = ? AND client_id = ?",
            (user_id, note.client_id)
        )
        existing = await cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Note with client_id '{note.client_id}' already exists. Use PUT to update."
            )

        cursor = await db.execute(
            """INSERT INTO notes (user_id, client_id, title, content, version, device_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, 1, ?, ?, ?)""",
            (user_id, note.client_id, note.title, note.content, note.device_id, now, now)
        )
        await db.commit()
        note_id = cursor.lastrowid

        return ApiResponse(
            success=True,
            data={"note": {
                "id": note_id,
                "client_id": note.client_id,
                "title": note.title,
                "content": note.content,
                "version": 1,
                "device_id": note.device_id,
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
            }},
            message="Note created"
        )
    finally:
        await db.close()


@router.put("/notes/{note_id}", response_model=ApiResponse)
async def update_note(
    note_id: int,
    note_update: NoteUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """Update an existing note with version conflict detection."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id)
        )
        existing = await cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Note not found")

        # Version conflict detection
        if note_update.version < existing["version"]:
            return ApiResponse(
                success=False,
                data={"server_note": row_to_note(existing)},
                message="Version conflict: server has a newer version",
                errors={"conflict": "server_version_newer"}
            )

        new_version = existing["version"] + 1
        new_title = note_update.title if note_update.title is not None else existing["title"]
        new_content = note_update.content if note_update.content is not None else existing["content"]
        new_device_id = note_update.device_id if note_update.device_id is not None else existing["device_id"]

        await db.execute(
            """UPDATE notes SET title=?, content=?, version=?, device_id=?, updated_at=?
               WHERE id=?""",
            (new_title, new_content, new_version, new_device_id, now, note_id)
        )
        await db.commit()

        return ApiResponse(
            success=True,
            data={"note": {
                "id": existing["id"],
                "client_id": existing["client_id"],
                "title": new_title,
                "content": new_content,
                "version": new_version,
                "device_id": new_device_id,
                "created_at": existing["created_at"],
                "updated_at": now,
                "deleted_at": existing["deleted_at"],
            }},
            message="Note updated"
        )
    finally:
        await db.close()


@router.delete("/notes/{note_id}", response_model=ApiResponse)
async def delete_note(
    note_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Soft-delete a note."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Note not found")

        await db.execute(
            "UPDATE notes SET deleted_at=?, version=version+1 WHERE id=?",
            (now, note_id)
        )
        await db.commit()
        return ApiResponse(success=True, message="Note deleted")
    finally:
        await db.close()
