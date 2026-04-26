"""Integration tests for the SahabNote API using TestClient (sync)."""

import pytest
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set test environment
os.environ["SAHABNOTE_SECRET"] = "test-secret-key-for-testing-only"

from main import app
from database import init_db, DB_PATH
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def setup_db():
    """Reset database before each test."""
    if DB_PATH.exists():
        DB_PATH.unlink()

    import asyncio
    asyncio.run(init_db())
    yield
    if DB_PATH.exists():
        DB_PATH.unlink()


@pytest.fixture
def client():
    """Create FastAPI test client."""
    return TestClient(app)


def _register(client, username="testuser", password="testpass123"):
    """Register a test user and return token + sync_key."""
    resp = client.post("/api/auth/register", json={
        "username": username,
        "password": password
    })
    assert resp.status_code == 200
    data = resp.json()
    return data["data"]["access_token"], data["data"]["sync_key"]


def test_health_check(client):
    """Test health endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_user(client):
    """Test user registration."""
    response = client.post("/api/auth/register", json={
        "username": "newuser",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert "sync_key" in data["data"]
    assert data["data"]["sync_key"].startswith("sn_")


def test_register_duplicate_user(client):
    """Test duplicate username registration."""
    _register(client)
    response = client.post("/api/auth/register", json={
        "username": "testuser",
        "password": "anotherpass"
    })
    assert response.status_code == 409


def test_login(client):
    """Test login with correct credentials."""
    _register(client)
    response = client.post("/api/auth/login", json={
        "username": "testuser",
        "password": "testpass123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]


def test_login_wrong_password(client):
    """Test login with wrong password."""
    _register(client)
    response = client.post("/api/auth/login", json={
        "username": "testuser",
        "password": "wrongpassword"
    })
    assert response.status_code == 401


def test_sync_key_login(client):
    """Test login with sync key."""
    token, sync_key = _register(client)
    response = client.post("/api/auth/sync-key-login", json={
        "sync_key": sync_key
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]


def test_create_note(client):
    """Test creating a note."""
    token, _ = _register(client)
    response = client.post(
        "/api/v1/notes",
        json={
            "client_id": "note-001",
            "title": "Test Note",
            "content": "Hello, world!",
            "device_id": "device-1"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["note"]["title"] == "Test Note"
    assert data["data"]["note"]["client_id"] == "note-001"


def test_create_duplicate_client_id(client):
    """Test creating note with duplicate client_id."""
    token, _ = _register(client)
    client.post(
        "/api/v1/notes",
        json={"client_id": "note-001", "title": "First", "content": ""},
        headers={"Authorization": f"Bearer {token}"}
    )
    response = client.post(
        "/api/v1/notes",
        json={"client_id": "note-001", "title": "Second", "content": ""},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 409


def test_list_notes(client):
    """Test listing notes."""
    token, _ = _register(client)
    client.post(
        "/api/v1/notes",
        json={"client_id": "n1", "title": "Note 1", "content": "Content 1"},
        headers={"Authorization": f"Bearer {token}"}
    )
    client.post(
        "/api/v1/notes",
        json={"client_id": "n2", "title": "Note 2", "content": "Content 2"},
        headers={"Authorization": f"Bearer {token}"}
    )

    response = client.get("/api/v1/notes", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]["notes"]) == 2


def test_update_note(client):
    """Test updating a note."""
    token, _ = _register(client)
    create_resp = client.post(
        "/api/v1/notes",
        json={"client_id": "n1", "title": "Original", "content": "Original content"},
        headers={"Authorization": f"Bearer {token}"}
    )
    note_id = create_resp.json()["data"]["note"]["id"]

    response = client.put(
        f"/api/v1/notes/{note_id}",
        json={"title": "Updated", "content": "Updated content", "version": 1},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["note"]["title"] == "Updated"
    assert data["data"]["note"]["version"] == 2


def test_version_conflict(client):
    """Test version conflict detection."""
    token, _ = _register(client)
    create_resp = client.post(
        "/api/v1/notes",
        json={"client_id": "n1", "title": "Original", "content": ""},
        headers={"Authorization": f"Bearer {token}"}
    )
    note_id = create_resp.json()["data"]["note"]["id"]

    client.put(
        f"/api/v1/notes/{note_id}",
        json={"title": "Updated", "version": 1},
        headers={"Authorization": f"Bearer {token}"}
    )

    response = client.put(
        f"/api/v1/notes/{note_id}",
        json={"title": "Old update", "version": 1},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "conflict" in str(data.get("errors", {}))


def test_delete_note(client):
    """Test soft-deleting a note."""
    token, _ = _register(client)
    create_resp = client.post(
        "/api/v1/notes",
        json={"client_id": "n1", "title": "To Delete", "content": ""},
        headers={"Authorization": f"Bearer {token}"}
    )
    note_id = create_resp.json()["data"]["note"]["id"]

    response = client.delete(f"/api/v1/notes/{note_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    list_resp = client.get("/api/v1/notes", headers={"Authorization": f"Bearer {token}"})
    assert len(list_resp.json()["data"]["notes"]) == 0


def test_sync_push(client):
    """Test pushing sync changes."""
    token, _ = _register(client)
    response = client.post(
        "/api/v1/sync/push",
        json={
            "notes": [{
                "client_id": "sync-1",
                "title": "Sync Note",
                "content": "Pushed from client",
                "version": 1,
                "device_id": "device-1",
                "deleted": False
            }]
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["synced"][0]["status"] == "created"


def test_sync_pull(client):
    """Test pulling sync changes."""
    token, _ = _register(client)
    client.post(
        "/api/v1/notes",
        json={"client_id": "pull-1", "title": "Pull Test", "content": "Will be pulled"},
        headers={"Authorization": f"Bearer {token}"}
    )

    response = client.get("/api/v1/sync/pull", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]["notes"]) == 1
    assert data["data"]["notes"][0]["title"] == "Pull Test"


def test_sync_push_delete(client):
    """Test pushing a delete sync."""
    token, _ = _register(client)
    client.post(
        "/api/v1/sync/push",
        json={
            "notes": [{
                "client_id": "del-1",
                "title": "Delete Me",
                "content": "",
                "version": 1,
                "device_id": "d1",
                "deleted": False
            }]
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    response = client.post(
        "/api/v1/sync/push",
        json={
            "notes": [{
                "client_id": "del-1",
                "title": "",
                "content": "",
                "version": 2,
                "device_id": "d1",
                "deleted": True
            }]
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["synced"][0]["status"] == "deleted"


def test_unauthorized_access(client):
    """Test accessing without auth."""
    response = client.get("/api/v1/notes")
    assert response.status_code == 401


def test_invalid_sync_key(client):
    """Test with invalid sync key."""
    response = client.get("/api/v1/notes", headers={"Authorization": "Bearer invalid_key_here"})
    assert response.status_code == 401


# --- Admin Tests ---

def _make_admin(user_id):
    """Helper to make a user admin (direct DB manipulation)."""
    import asyncio
    from database import get_db

    async def _set_admin():
        db = await get_db()
        try:
            await db.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (user_id,))
            await db.commit()
        finally:
            await db.close()

    asyncio.run(_set_admin())


def test_admin_non_admin_gets_403(client):
    """Non-admin user gets 403 on admin endpoints."""
    token, _ = _register(client)
    resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_admin_stats(client):
    """Admin can view stats."""
    token, _ = _register(client, "statsadmin", "pass123")
    login = client.post("/api/auth/login", json={"username": "statsadmin", "password": "pass123"})
    admin_token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user_id"]
    _make_admin(admin_id)

    # Create some notes for context
    for i in range(3):
        client.post("/api/v1/notes", json={"client_id": f"sn-{i}", "title": f"N{i}", "content": "x"},
                     headers={"Authorization": f"Bearer {admin_token}"})

    resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["total_users"] >= 1
    assert data["data"]["total_notes"] >= 3
    assert data["data"]["admin_count"] >= 1


def test_admin_list_users(client):
    """Admin can list users with masked sync keys."""
    _register(client, "regular_user", "pass123")
    token, _ = _register(client, "the_admin", "admin123")
    login = client.post("/api/auth/login", json={"username": "the_admin", "password": "admin123"})
    admin_token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user_id"]
    _make_admin(admin_id)

    resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["users"]) >= 2
    user = [u for u in data["data"]["users"] if u["username"] == "regular_user"][0]
    assert "..." in user["sync_key_preview"]
    assert user["is_admin"] is False


def test_admin_list_user_notes(client):
    """Admin can list notes for a specific user."""
    user_token, _ = _register(client, "note_user", "pass123")
    token, _ = _register(client, "admin2", "admin123")
    login = client.post("/api/auth/login", json={"username": "admin2", "password": "admin123"})
    admin_token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user_id"]
    _make_admin(admin_id)

    client.post("/api/v1/notes", json={"client_id": "n1", "title": "Secret Note", "content": "secret"},
                headers={"Authorization": f"Bearer {user_token}"})

    login2 = client.post("/api/auth/login", json={"username": "note_user", "password": "pass123"})
    user_id = login2.json()["data"]["user_id"]

    resp = client.get(f"/api/admin/users/{user_id}/notes",
                      headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["notes"]) == 1
    assert data["data"]["notes"][0]["title"] == "Secret Note"
    assert data["data"]["username"] == "note_user"


def test_admin_read_full_note(client):
    """Admin can read full note content."""
    user_token, _ = _register(client, "reader", "pass123")
    token, _ = _register(client, "admin3", "admin123")
    login = client.post("/api/auth/login", json={"username": "admin3", "password": "admin123"})
    admin_token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user_id"]
    _make_admin(admin_id)

    cr = client.post("/api/v1/notes", json={"client_id": "fn", "title": "Full", "content": "Full content here"},
                     headers={"Authorization": f"Bearer {user_token}"})
    note_id = cr.json()["data"]["note"]["id"]

    login2 = client.post("/api/auth/login", json={"username": "reader", "password": "pass123"})
    user_id = login2.json()["data"]["user_id"]

    resp = client.get(f"/api/admin/users/{user_id}/notes/{note_id}",
                      headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert resp.json()["data"]["note"]["content"] == "Full content here"


def test_admin_soft_delete_note(client):
    """Admin can soft-delete a note."""
    user_token, _ = _register(client, "deluser", "pass123")
    token, _ = _register(client, "admin4", "admin123")
    login = client.post("/api/auth/login", json={"username": "admin4", "password": "admin123"})
    admin_token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user_id"]
    _make_admin(admin_id)

    cr = client.post("/api/v1/notes", json={"client_id": "del", "title": "Delete", "content": "bye"},
                     headers={"Authorization": f"Bearer {user_token}"})
    note_id = cr.json()["data"]["note"]["id"]

    login2 = client.post("/api/auth/login", json={"username": "deluser", "password": "pass123"})
    user_id = login2.json()["data"]["user_id"]

    resp = client.delete(f"/api/admin/users/{user_id}/notes/{note_id}",
                         headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    get_resp = client.get(f"/api/admin/users/{user_id}/notes/{note_id}",
                          headers={"Authorization": f"Bearer {admin_token}"})
    assert get_resp.json()["data"]["note"]["deleted_at"] is not None


def test_admin_hard_delete_note(client):
    """Admin can hard-delete a note."""
    user_token, _ = _register(client, "harduser", "pass123")
    token, _ = _register(client, "admin5", "admin123")
    login = client.post("/api/auth/login", json={"username": "admin5", "password": "admin123"})
    admin_token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user_id"]
    _make_admin(admin_id)

    cr = client.post("/api/v1/notes", json={"client_id": "hd", "title": "HardDel", "content": "x"},
                     headers={"Authorization": f"Bearer {user_token}"})
    note_id = cr.json()["data"]["note"]["id"]

    login2 = client.post("/api/auth/login", json={"username": "harduser", "password": "pass123"})
    user_id = login2.json()["data"]["user_id"]

    resp = client.delete(f"/api/admin/users/{user_id}/notes/{note_id}?hard_delete=true",
                         headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200

    get_resp = client.get(f"/api/admin/users/{user_id}/notes/{note_id}",
                          headers={"Authorization": f"Bearer {admin_token}"})
    assert get_resp.status_code == 404


def test_admin_reset_sync_key(client):
    """Admin can reset a user's sync key."""
    user_token, orig_sync = _register(client, "synckeyuser", "pass123")
    token, _ = _register(client, "admin6", "admin123")
    login = client.post("/api/auth/login", json={"username": "admin6", "password": "admin123"})
    admin_token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user_id"]
    _make_admin(admin_id)

    login2 = client.post("/api/auth/login", json={"username": "synckeyuser", "password": "pass123"})
    user_id = login2.json()["data"]["user_id"]

    resp = client.post(f"/api/admin/users/{user_id}/reset-sync-key",
                       headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["new_sync_key"] != orig_sync
    assert data["data"]["new_sync_key"].startswith("sn_")


def test_admin_audit_log(client):
    """Admin audit log records actions."""
    token, _ = _register(client, "auditadmin", "admin123")
    login = client.post("/api/auth/login", json={"username": "auditadmin", "password": "admin123"})
    admin_token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user_id"]
    _make_admin(admin_id)

    client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})

    resp = client.get("/api/admin/audit-log", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["logs"]) >= 2
