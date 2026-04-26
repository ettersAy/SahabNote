"""Authentication utilities using sync keys and JWT tokens."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import secrets
import os

SECRET_KEY = os.environ.get("SAHABNOTE_SECRET", "change-me-in-production-sahabnote-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def generate_sync_key() -> str:
    """Generate a unique sync key."""
    return "sn_" + secrets.token_hex(24)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> int:
    """Extract user_id from JWT token or sync_key."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    token = credentials.credentials

    # Try as JWT first
    payload = decode_token(token)
    if payload and "user_id" in payload:
        return payload["user_id"]

    # Try as sync_key
    from database import get_db
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM users WHERE sync_key = ?",
            (token,)
        )
        row = await cursor.fetchone()
        if row:
            return row["id"]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    finally:
        await db.close()


async def get_current_admin_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> int:
    """Extract user_id from JWT token or sync_key and verify admin status."""
    user_id = await get_current_user_id(credentials)

    from database import get_db
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT is_admin FROM users WHERE id = ?",
            (user_id,)
        )
        row = await cursor.fetchone()
        if not row or not row["is_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        return user_id
    finally:
        await db.close()
