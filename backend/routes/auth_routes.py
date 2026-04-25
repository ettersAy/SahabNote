"""Authentication routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from database import get_db
from models import UserCreate, UserLogin, SyncKeyLogin, TokenResponse, ApiResponse
from auth import (
    hash_password, verify_password, generate_sync_key,
    create_access_token, get_current_user_id
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=ApiResponse)
async def register(user: UserCreate):
    """Register a new user."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM users WHERE username = ?",
            (user.username,)
        )
        if await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists"
            )

        sync_key = generate_sync_key()
        password_hash = hash_password(user.password)
        cursor = await db.execute(
            "INSERT INTO users (username, password_hash, sync_key) VALUES (?, ?, ?)",
            (user.username, password_hash, sync_key)
        )
        await db.commit()
        user_id = cursor.lastrowid

        token = create_access_token({"user_id": user_id, "username": user.username})
        return ApiResponse(
            success=True,
            data={
                "access_token": token,
                "sync_key": sync_key,
                "user_id": user_id,
            },
            message="User registered successfully"
        )
    finally:
        await db.close()


@router.post("/login", response_model=ApiResponse)
async def login(credentials: UserLogin):
    """Login with username and password."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username, password_hash, sync_key FROM users WHERE username = ?",
            (credentials.username,)
        )
        row = await cursor.fetchone()
        if not row or not verify_password(credentials.password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

        token = create_access_token({"user_id": row["id"], "username": row["username"]})
        return ApiResponse(
            success=True,
            data={
                "access_token": token,
                "sync_key": row["sync_key"],
                "user_id": row["id"],
            },
            message="Login successful"
        )
    finally:
        await db.close()


@router.post("/sync-key-login", response_model=ApiResponse)
async def sync_key_login(data: SyncKeyLogin):
    """Login using a sync key."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username, sync_key FROM users WHERE sync_key = ?",
            (data.sync_key,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid sync key"
            )

        token = create_access_token({"user_id": row["id"], "username": row["username"]})
        return ApiResponse(
            success=True,
            data={
                "access_token": token,
                "sync_key": row["sync_key"],
                "user_id": row["id"],
            },
            message="Sync key login successful"
        )
    finally:
        await db.close()


@router.post("/verify", response_model=ApiResponse)
async def verify_token(user_id: int = Depends(get_current_user_id)):
    """Verify that the current token/sync key is valid."""
    return ApiResponse(
        success=True,
        data={"user_id": user_id},
        message="Token is valid"
    )
