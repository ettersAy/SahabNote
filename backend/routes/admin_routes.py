"""Admin routes for managing users and notes."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime, timezone
from typing import Optional

from database import get_db
from auth import get_current_admin_id, generate_sync_key
from models import ApiResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def log_admin_action(
    db,
    admin_user_id: int,
    action: str,
    target_user_id: Optional[int] = None,
    target_note_id: Optional[int] = None,
    details: Optional[str] = None,
):
    """Log an admin action to the audit log."""
    await db.execute(
        """INSERT INTO admin_audit_log (admin_user_id, action, target_user_id, target_note_id, details)
           VALUES (?, ?, ?, ?, ?)""",
        (admin_user_id, action, target_user_id, target_note_id, details),
    )
    await db.commit()


@router.get("/stats", response_model=ApiResponse)
async def admin_stats(admin_user_id: int = Depends(get_current_admin_id)):
    """Get dashboard statistics."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM users")
        total_users = (await cursor.fetchone())["cnt"]

        cursor = await db.execute("SELECT COUNT(*) as cnt FROM notes")
        total_notes = (await cursor.fetchone())["cnt"]

        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM notes WHERE deleted_at IS NULL"
        )
        active_notes = (await cursor.fetchone())["cnt"]

        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM users WHERE is_admin = 1"
        )
        admin_count = (await cursor.fetchone())["cnt"]

        notes_per_user_avg = round(total_notes / max(total_users, 1), 2)

        return ApiResponse(
            success=True,
            data={
                "total_users": total_users,
                "total_notes": total_notes,
                "active_notes": active_notes,
                "notes_per_user_avg": notes_per_user_avg,
                "admin_count": admin_count,
            },
        )
    finally:
        await db.close()


@router.get("/users", response_model=ApiResponse)
async def admin_list_users(admin_user_id: int = Depends(get_current_admin_id)):
    """List all users with note counts."""
    db = await get_db()
    try:
        cursor = await db.execute("""
            SELECT
                u.id,
                u.username,
                u.sync_key,
                u.is_admin,
                u.created_at,
                (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id) as note_count
            FROM users u
            ORDER BY u.created_at DESC
        """)
        rows = await cursor.fetchall()

        users = []
        for row in rows:
            sync_key = row["sync_key"]
            users.append({
                "id": row["id"],
                "username": row["username"],
                "sync_key_preview": sync_key[:12] + "..." + sync_key[-4:] if len(sync_key) > 16 else sync_key,
                "note_count": row["note_count"],
                "is_admin": bool(row["is_admin"]),
                "created_at": row["created_at"],
            })

        await log_admin_action(db, admin_user_id, "list_users")
        return ApiResponse(success=True, data={"users": users})
    finally:
        await db.close()


@router.get("/users/{user_id}/notes", response_model=ApiResponse)
async def admin_list_user_notes(
    user_id: int,
    include_deleted: bool = Query(False),
    admin_user_id: int = Depends(get_current_admin_id),
):
    """List all notes for a specific user."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username FROM users WHERE id = ?", (user_id,)
        )
        user_row = await cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")

        if include_deleted:
            cursor = await db.execute(
                "SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC",
                (user_id,),
            )
        rows = await cursor.fetchall()

        notes = []
        for row in rows:
            content = row["content"] or ""
            notes.append({
                "id": row["id"],
                "client_id": row["client_id"],
                "title": row["title"],
                "content_preview": content[:150] + ("..." if len(content) > 150 else ""),
                "version": row["version"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "deleted_at": row["deleted_at"],
            })

        await log_admin_action(
            db, admin_user_id, "list_user_notes",
            target_user_id=user_id,
            details=f"include_deleted={include_deleted}",
        )
        return ApiResponse(
            success=True,
            data={"notes": notes, "username": user_row["username"]},
        )
    finally:
        await db.close()


@router.get("/users/{user_id}/notes/{note_id}", response_model=ApiResponse)
async def admin_get_note(
    user_id: int,
    note_id: int,
    admin_user_id: int = Depends(get_current_admin_id),
):
    """Get full note content for a specific user's note."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")

        note = {
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

        await log_admin_action(
            db, admin_user_id, "read_note",
            target_user_id=user_id, target_note_id=note_id,
        )
        return ApiResponse(success=True, data={"note": note})
    finally:
        await db.close()


@router.delete("/users/{user_id}/notes/{note_id}", response_model=ApiResponse)
async def admin_delete_note(
    user_id: int,
    note_id: int,
    hard_delete: bool = Query(False),
    admin_user_id: int = Depends(get_current_admin_id),
):
    """Delete a note (soft-delete by default, or hard-delete with ?hard_delete=true)."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id),
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Note not found")

        if hard_delete:
            await db.execute(
                "DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id),
            )
            action_detail = "hard_delete"
        else:
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            await db.execute(
                "UPDATE notes SET deleted_at = ?, version = version + 1 WHERE id = ?",
                (now, note_id),
            )
            action_detail = "soft_delete"

        await db.commit()

        await log_admin_action(
            db, admin_user_id, f"delete_note_{action_detail}",
            target_user_id=user_id, target_note_id=note_id,
        )
        return ApiResponse(
            success=True,
            message=f"Note {action_detail.replace('_', ' ').title()}d successfully",
        )
    finally:
        await db.close()


@router.post("/users/{user_id}/reset-sync-key", response_model=ApiResponse)
async def admin_reset_sync_key(
    user_id: int,
    admin_user_id: int = Depends(get_current_admin_id),
):
    """Reset a user's sync key."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username FROM users WHERE id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        new_sync_key = generate_sync_key()
        await db.execute(
            "UPDATE users SET sync_key = ? WHERE id = ?", (new_sync_key, user_id),
        )
        await db.commit()

        await log_admin_action(
            db, admin_user_id, "reset_sync_key",
            target_user_id=user_id,
            details=f"Sync key reset for user '{row['username']}'",
        )
        return ApiResponse(
            success=True,
            data={"new_sync_key": new_sync_key, "username": row["username"]},
            message="Sync key reset successfully",
        )
    finally:
        await db.close()


@router.get("/audit-log", response_model=ApiResponse)
async def admin_audit_log(
    limit: int = Query(50, ge=1, le=200),
    admin_user_id: int = Depends(get_current_admin_id),
):
    """View the admin audit log."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT al.*, u.username as admin_username
               FROM admin_audit_log al
               LEFT JOIN users u ON al.admin_user_id = u.id
               ORDER BY al.created_at DESC
               LIMIT ?""",
            (limit,),
        )
        rows = await cursor.fetchall()

        logs = []
        for row in rows:
            logs.append({
                "id": row["id"],
                "admin_user_id": row["admin_user_id"],
                "admin_username": row["admin_username"],
                "action": row["action"],
                "target_user_id": row["target_user_id"],
                "target_note_id": row["target_note_id"],
                "details": row["details"],
                "created_at": row["created_at"],
            })

        return ApiResponse(success=True, data={"logs": logs})
    finally:
        await db.close()
