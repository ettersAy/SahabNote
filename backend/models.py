"""Pydantic models for request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class SyncKeyLogin(BaseModel):
    sync_key: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    sync_key: str


class NoteCreate(BaseModel):
    client_id: str = Field(..., max_length=100)
    title: str = Field(default="", max_length=500)
    content: str = Field(default="")
    device_id: str = Field(default="", max_length=200)


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)
    content: Optional[str] = Field(default=None)
    version: int = Field(..., ge=1)
    device_id: Optional[str] = Field(default=None, max_length=200)


class NoteResponse(BaseModel):
    id: int
    client_id: str
    title: str
    content: str
    version: int
    device_id: str
    created_at: str
    updated_at: str
    deleted_at: Optional[str] = None


class SyncPushItem(BaseModel):
    client_id: str
    title: str = ""
    content: str = ""
    version: int = 1
    device_id: str = ""
    deleted: bool = False


class SyncPushRequest(BaseModel):
    notes: List[SyncPushItem]


class SyncPullResponse(BaseModel):
    notes: List[NoteResponse]
    server_time: str


class SyncConflictResolution(BaseModel):
    client_id: str
    keep_local: bool = True  # True = keep local version, False = keep server version


class ApiResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: str = "OK"
    errors: Optional[dict] = None


# --- Admin Models ---

class AdminUserResponse(BaseModel):
    id: int
    username: str
    sync_key_preview: str
    note_count: int
    is_admin: bool
    created_at: str


class AdminNotePreview(BaseModel):
    id: int
    client_id: str
    title: str
    content_preview: str
    version: int
    created_at: str
    updated_at: str
    deleted_at: Optional[str] = None


class AdminStats(BaseModel):
    total_users: int
    total_notes: int
    active_notes: int
    notes_per_user_avg: float
    admin_count: int


class AdminAuditLog(BaseModel):
    id: int
    admin_user_id: int
    action: str
    target_user_id: Optional[int] = None
    target_note_id: Optional[int] = None
    details: Optional[str] = None
    created_at: str
