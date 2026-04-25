"""Local storage for notes using JSON file."""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict
from pathlib import Path

DATA_DIR = Path.home() / ".sahabnote"
DATA_FILE = DATA_DIR / "notes.json"
DEVICE_FILE = DATA_DIR / "device.json"
SETTINGS_FILE = DATA_DIR / "settings.json"

SYNC_STATUS = {
    "SYNCED": "synced",
    "LOCAL_ONLY": "local_only",
    "PENDING_SYNC": "pending_sync",
    "CONFLICT": "sync_conflict",
    "DELETED_PENDING": "deleted_pending_sync",
}


def ensure_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_device_id() -> str:
    """Get or create a persistent device ID."""
    ensure_dir()
    if DEVICE_FILE.exists():
        with open(DEVICE_FILE, "r") as f:
            data = json.load(f)
            return data.get("device_id", str(uuid.uuid4()))
    device_id = str(uuid.uuid4())
    with open(DEVICE_FILE, "w") as f:
        json.dump({"device_id": device_id}, f)
    return device_id


def get_settings() -> dict:
    """Get saved settings."""
    ensure_dir()
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    return {}


def save_settings(settings: dict):
    """Save settings."""
    ensure_dir()
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)


def load_notes() -> List[Dict]:
    """Load notes from local storage."""
    ensure_dir()
    if DATA_FILE.exists():
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return []


def save_notes(notes: List[Dict]):
    """Save notes to local storage."""
    ensure_dir()
    with open(DATA_FILE, "w") as f:
        json.dump(notes, f, indent=2)


def create_note(client_id: Optional[str] = None, title: str = "", content: str = "") -> Dict:
    """Create a new note locally."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    note = {
        "id": client_id or str(uuid.uuid4()),
        "server_id": None,
        "client_id": client_id or str(uuid.uuid4()),
        "title": title,
        "content": content,
        "version": 1,
        "device_id": get_device_id(),
        "sync_status": SYNC_STATUS["LOCAL_ONLY"],
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    return note


def add_note(note: Dict) -> List[Dict]:
    """Add a note to local storage."""
    notes = load_notes()
    notes.insert(0, note)
    save_notes(notes)
    return notes


def update_note(client_id: str, title: str, content: str, version: Optional[int] = None) -> Optional[Dict]:
    """Update a note in local storage."""
    notes = load_notes()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    for i, n in enumerate(notes):
        if n.get("client_id") == client_id or n.get("id") == client_id:
            notes[i]["title"] = title
            notes[i]["content"] = content
            notes[i]["updated_at"] = now
            if version is not None:
                notes[i]["version"] = version
            else:
                notes[i]["version"] = notes[i].get("version", 1) + 1
            if notes[i]["sync_status"] not in [SYNC_STATUS["CONFLICT"]]:
                notes[i]["sync_status"] = SYNC_STATUS["PENDING_SYNC"]
            save_notes(notes)
            return notes[i]
    return None


def delete_note(client_id: str) -> bool:
    """Mark a note as deleted locally (soft delete)."""
    notes = load_notes()
    for n in notes:
        if n.get("client_id") == client_id or n.get("id") == client_id:
            n["deleted_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            n["sync_status"] = SYNC_STATUS["DELETED_PENDING"]
            save_notes(notes)
            return True
    return False


def get_note(client_id: str) -> Optional[Dict]:
    """Get a single note by client_id."""
    notes = load_notes()
    for n in notes:
        if n.get("client_id") == client_id or n.get("id") == client_id:
            return n
    return None


def get_pending_sync_notes() -> List[Dict]:
    """Get notes that need to be synced."""
    notes = load_notes()
    return [
        n for n in notes
        if n.get("sync_status") in [
            SYNC_STATUS["LOCAL_ONLY"],
            SYNC_STATUS["PENDING_SYNC"],
            SYNC_STATUS["DELETED_PENDING"],
        ]
    ]


def mark_synced(client_id: str, server_id: int, server_version: int):
    """Mark a note as synced."""
    notes = load_notes()
    for n in notes:
        if n.get("client_id") == client_id:
            n["sync_status"] = SYNC_STATUS["SYNCED"]
            n["server_id"] = server_id
            if server_version:
                n["version"] = server_version
            save_notes(notes)
            return


def mark_conflict(client_id: str, server_note: Dict):
    """Mark a note as having a sync conflict."""
    notes = load_notes()
    for n in notes:
        if n.get("client_id") == client_id:
            n["sync_status"] = SYNC_STATUS["CONFLICT"]
            n["server_version"] = server_note.get("version")
            n["server_title"] = server_note.get("title")
            n["server_content"] = server_note.get("content")
            save_notes(notes)
            return


def merge_pulled_notes(pulled_notes: List[Dict]):
    """Merge notes pulled from server into local storage."""
    notes = load_notes()
    local_by_client = {n.get("client_id"): n for n in notes}

    for server_note in pulled_notes:
        client_id = server_note.get("client_id")
        if client_id in local_by_client:
            local = local_by_client[client_id]
            # Only update if server version is newer and local didn't change
            if server_note.get("version", 0) > local.get("version", 0):
                if local.get("sync_status") not in [
                    SYNC_STATUS["LOCAL_ONLY"],
                    SYNC_STATUS["PENDING_SYNC"],
                    SYNC_STATUS["DELETED_PENDING"],
                ]:
                    local["title"] = server_note.get("title", "")
                    local["content"] = server_note.get("content", "")
                    local["version"] = server_note.get("version", local["version"])
                    local["updated_at"] = server_note.get("updated_at", local["updated_at"])
                    local["deleted_at"] = server_note.get("deleted_at")
                    local["sync_status"] = SYNC_STATUS["SYNCED"]
                    local["server_id"] = server_note.get("id")
                # else: local has pending changes, keep local
            # If same version, it's already synced
        else:
            # New note from server
            if not server_note.get("deleted_at"):
                notes.append({
                    "id": client_id,
                    "server_id": server_note.get("id"),
                    "client_id": client_id,
                    "title": server_note.get("title", ""),
                    "content": server_note.get("content", ""),
                    "version": server_note.get("version", 1),
                    "device_id": server_note.get("device_id", ""),
                    "sync_status": SYNC_STATUS["SYNCED"],
                    "created_at": server_note.get("created_at"),
                    "updated_at": server_note.get("updated_at"),
                    "deleted_at": server_note.get("deleted_at"),
                })

    save_notes(notes)
