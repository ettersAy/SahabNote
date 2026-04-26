# SahabNote - Multi-Platform Note-Taking App

A lightweight, offline-first, multi-platform note-taking application with server synchronization.

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Backend | FastAPI + SQLite (aiosqlite) | Fast, async, auto-docs, Python, easy to host anywhere |
| Desktop (Linux/macOS) | Python Tkinter | Built-in, no dependencies, works everywhere |
| Android | React Native + Expo | Cross-platform mobile, hot reload, easy dev |
| Chrome Extension | Plain JS/HTML/CSS (MV3) | No framework needed, lightweight |
| Web Client | Plain HTML/JS | Debugging and quick access |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Clients                           │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌──────────┐   │
│  │ Desktop   │ │ Android   │ │Chrome│ │  Web     │   │
│  │ (Tkinter) │ │ (Expo)    │ │Ext.  │ │ (HTML)   │   │
│  └─────┬────┘ └─────┬────┘ └──┬───┘ └─────┬────┘   │
│        │            │         │            │        │
│        └────────────┴─────────┴────────────┘        │
│                      │ HTTP/REST                     │
│                      ▼                               │
│              ┌───────────────┐                       │
│              │  FastAPI      │                       │
│              │  + SQLite     │                       │
│              └───────────────┘                       │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start the Backend Server

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Server runs on `http://localhost:8000`
API docs available at `http://localhost:8000/docs`

### 2. Run the Desktop App

```bash
cd desktop
python app.py
```

### 3. Run the Android App (Expo)

```bash
cd sahabnote  # or current root
npx expo start           # Standard (uses port 8081)
npm run start:worktree   # Worktree-safe (uses port 8082, auto-clears cache)
```

**Dev Utilities:**
```bash
npm run versions   # Print all key package versions (expo, RN, react, etc.)
npm run doctor     # Run Expo config validation (expo-doctor)
npm run validate   # Full validation: versions + config + doctor
```

### 4. Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

### 5. Open the Web Client

Open `web/index.html` in any browser.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with username/password |
| POST | `/api/auth/sync-key-login` | Login with sync key |
| POST | `/api/auth/verify` | Verify token |
| GET | `/api/v1/notes` | List notes |
| POST | `/api/v1/notes` | Create note |
| GET | `/api/v1/notes/:id` | Get note |
| PUT | `/api/v1/notes/:id` | Update note |
| DELETE | `/api/v1/notes/:id` | Soft-delete note |
| POST | `/api/v1/sync/push` | Push local changes |
| GET | `/api/v1/sync/pull` | Pull server changes |
| POST | `/api/v1/sync/resolve-conflict` | Resolve sync conflict |

## Sync Design

### Strategy: Last-Write-Wins with Version Detection

1. Each note has a `version` number that increments on every update.
2. Clients push pending changes to `/api/v1/sync/push`.
3. Clients pull server changes from `/api/v1/sync/pull`.
4. If a conflict is detected (server version > client version), the client is notified.
5. Conflict resolution: **last-write-wins** by default. The server version is kept if the client pushes an older version.

### Sync Statuses

- `synced` - Note is in sync with server
- `local_only` - Note only exists locally (not yet pushed)
- `pending_sync` - Note has local changes not yet pushed
- `sync_conflict` - Conflict detected between local and server versions
- `deleted_pending_sync` - Note deleted locally, pending server deletion

## Offline-First Behavior

All clients store notes locally:
- **Desktop**: `~/.sahabnote/notes.json`
- **Android**: AsyncStorage
- **Chrome Extension**: `chrome.storage.local`

Notes are always editable offline. Changes are queued with `pending_sync` or `local_only` status. When the connection is restored, the "Sync Now" button pushes all pending changes to the server.

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

## Settings

Each client allows configuration of:
- **Server URL**: The backend API URL (e.g., `http://localhost:8000`)
- **Auth Token**: JWT token or sync key for authentication
- **Device ID**: Auto-generated unique device identifier

## Manual Testing Guide

1. **Start backend**: `cd backend && python run.py`
2. **Register a user**: Open any client, go to Settings, enter username/password, click Register
3. **Create a note**: Click "+ New Note" and type content. Note is saved locally.
4. **Sync to server**: Click "Sync Now" - note appears on server.
5. **Open another client**: Configure same server URL, login with same credentials, click Sync Now.
6. **Edit offline**: Disconnect internet, edit a note. Changes saved locally with "pending_sync".
7. **Reconnect and sync**: Reconnect, click Sync Now. Changes pushed to server.
8. **Delete**: Delete a note. It's soft-deleted locally, then synced as deleted.
9. **Copy/Clear**: Copy copies content to clipboard. Clear empties the current note.

## Known Limitations

1. **No real-time sync**: Uses manual "Sync Now" button or periodic sync (Chrome extension: every 5 min).
2. **Last-write-wins**: Conflict resolution is basic. No merge UI yet.
3. **Single user focus**: Authentication exists but UX is basic.
4. **No encryption**: Data is not encrypted at rest. Use HTTPS in production.
5. **Token expiration**: JWT tokens expire after 30 days. No refresh token flow.

## Future Improvements

1. WebSocket real-time sync
2. Rich text / Markdown editor
3. Note categories and tags
4. Attachments and file uploads
5. End-to-end encryption
6. Multiple user collaboration
7. iOS support (via Expo)
8. PWA support
9. CI/CD pipelines
10. Docker deployment

## Project Structure

```
sahabnote/
├── backend/              # FastAPI server
│   ├── main.py           # App entry point
│   ├── database.py       # DB init and connection
│   ├── models.py         # Pydantic models
│   ├── auth.py           # Auth utilities
│   ├── routes/
│   │   ├── auth_routes.py   # Authentication endpoints
│   │   ├── note_routes.py   # CRUD endpoints
│   │   └── sync_routes.py   # Sync endpoints
│   ├── tests/
│   │   └── test_api.py      # Integration tests (17 tests)
│   ├── requirements.txt
│   └── run.py
├── desktop/              # Python Tkinter app
│   ├── app.py            # Main Tkinter application
│   ├── local_store.py    # Local JSON storage
│   └── sync_client.py    # HTTP sync client
├── android/              # React Native / Expo
│   └── src/
│       ├── App.js        # Main React Native app
│       └── utils/
│           ├── storage.js    # AsyncStorage wrapper
│           └── sync.js       # Sync client
├── chrome-extension/     # Manifest V3
│   ├── manifest.json
│   ├── background.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── options/
│       ├── options.html
│       └── options.js
├── web/                  # Simple web client
│   └── index.html
├── scripts/              # Utility scripts
│   ├── README.md         # Documentation for scripts
│   ├── health_tray.py    # Linux system tray health indicator
│   └── health-widget.html # Browser-based health widget
├── App.js                # Expo root (delegates to android/)
├── app.json              # Expo config
└── package.json          # Expo packages
```

## Health Indicators

The `scripts/` directory contains lightweight tools to monitor the backend health:

- **`health_tray.py`** – Linux system tray icon that shows green/red based on the `/api/health` endpoint. Requires `pystray` and `Pillow`. Run with `python3 scripts/health_tray.py`.
- **`health-widget.html`** – Standalone HTML page that displays a green/red circle. Open in any browser with `xdg-open scripts/health-widget.html`.

See `scripts/README.md` for detailed usage.

## AI Reflection & Automation Ideas

1. **MCP servers used**: `filesystem` for file operations, `run_commands` for running tests/setup.
2. **Missing MCP servers**: A `database` MCP to directly query the SQLite backend during testing. A `chrome-extension` MCP to validate extension loading.
3. **Repetitive tasks**: Setting up test databases before each test run could be automated with a `make test` script.
4. **Useful CLI commands**: `sahabnote-cli` tool to create/read/update/delete notes from terminal.
5. **Custom MCP idea**: A `multi-platform-deploy` MCP that can install/test all clients from one command.
6. **Future agent docs**: Add `.ai-guide.md` with architecture decisions and design patterns for AI agents.
7. **Technical debt**: The async fixture issue with pytest-asyncio required switching to `TestClient`. Need to upgrade test infrastructure.
8. **Next tasks (priority order)**:
   - Add WebSocket real-time sync
   - Add Markdown rendering in editor
   - Add Docker Compose for easy backend deployment
   - Add CI pipeline with GitHub Actions
   - Add notification badges for Chrome extension
   - Add iOS support via Expo
