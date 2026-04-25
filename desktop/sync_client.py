"""Sync client for the desktop app - handles API communication."""

import json
import urllib.request
import urllib.error
import ssl
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone


class SyncClient:
    """Handles HTTP communication with the SahabNote backend."""

    def __init__(self, server_url: str = "", auth_token: str = ""):
        self.server_url = server_url.rstrip("/")
        self.auth_token = auth_token

    def set_server(self, url: str):
        self.server_url = url.rstrip("/")

    def set_auth_token(self, token: str):
        self.auth_token = token

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    def _request(self, method: str, path: str, body: Optional[dict] = None) -> dict:
        if not self.server_url:
            raise ValueError("Server URL not set")
        url = f"{self.server_url}{path}"

        data = json.dumps(body).encode("utf-8") if body else None

        # Create SSL context that doesn't verify (for self-signed certs)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(
            url,
            data=data,
            headers=self._headers(),
            method=method,
        )

        try:
            with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else "{}"
            try:
                return json.loads(error_body)
            except json.JSONDecodeError:
                return {"success": False, "message": f"HTTP {e.code}: {error_body}"}
        except urllib.error.URLError as e:
            return {"success": False, "message": f"Connection error: {e.reason}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def health_check(self) -> dict:
        return self._request("GET", "/api/health")

    def register(self, username: str, password: str) -> dict:
        return self._request("POST", "/api/auth/register", {
            "username": username,
            "password": password
        })

    def login(self, username: str, password: str) -> dict:
        return self._request("POST", "/api/auth/login", {
            "username": username,
            "password": password
        })

    def sync_key_login(self, sync_key: str) -> dict:
        return self._request("POST", "/api/auth/sync-key-login", {
            "sync_key": sync_key
        })

    def list_notes(self) -> dict:
        return self._request("GET", "/api/v1/notes")

    def create_note(self, client_id: str, title: str, content: str, device_id: str) -> dict:
        return self._request("POST", "/api/v1/notes", {
            "client_id": client_id,
            "title": title,
            "content": content,
            "device_id": device_id
        })

    def update_note(self, note_id: int, title: str, content: str, version: int, device_id: str) -> dict:
        return self._request("PUT", f"/api/v1/notes/{note_id}", {
            "title": title,
            "content": content,
            "version": version,
            "device_id": device_id
        })

    def delete_note(self, note_id: int) -> dict:
        return self._request("DELETE", f"/api/v1/notes/{note_id}")

    def sync_push(self, notes: List[Dict]) -> dict:
        return self._request("POST", "/api/v1/sync/push", {"notes": notes})

    def sync_pull(self, since: Optional[str] = None) -> dict:
        path = "/api/v1/sync/pull"
        if since:
            path += f"?since={since}"
        return self._request("GET", path)
