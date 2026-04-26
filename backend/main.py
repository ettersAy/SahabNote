"""SahabNote Backend - FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from pathlib import Path
from database import init_db, migrate_db, get_db
from routes.auth_routes import router as auth_router
from routes.note_routes import router as note_router
from routes.sync_routes import router as sync_router
from routes.admin_routes import router as admin_router

# Path to web/ directory (relative to this file: backend/../web/)
WEB_DIR = Path(__file__).parent.parent / "web"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    # Apply migrations for existing databases
    db = await get_db()
    try:
        await migrate_db(db)
    finally:
        await db.close()
    yield
    # Shutdown


app = FastAPI(
    title="SahabNote API",
    description="A lightweight multi-platform note-taking sync server",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (API routes must be defined before the catch-all)
app.include_router(auth_router)
app.include_router(note_router)
app.include_router(sync_router)
app.include_router(admin_router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint with admin interface status."""
    return {
        "status": "ok",
        "service": "sahabnote-api",
        "version": "1.0.0",
        "admin_interface": WEB_DIR.exists() and (WEB_DIR / "admin.html").exists(),
    }


# Serve static files from the web/ directory
if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


    @app.get("/{full_path:path}")
    async def serve_web_files(full_path: str):
        """Serve files from web/ directory or return index.html for SPA-like routing."""
        if not full_path or full_path.endswith("/"):
            full_path = "index.html"

        file_path = WEB_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))

        # Fallback to index.html for SPA-like navigation (e.g., /admin.html works directly)
        index_path = WEB_DIR / full_path
        if not full_path.startswith("api/") and not full_path.startswith("docs") and not full_path.startswith("openapi"):
            index_fallback = WEB_DIR / "index.html"
            if index_fallback.exists():
                return FileResponse(str(index_fallback))

        return JSONResponse(status_code=404, content={"detail": "Not Found"})
else:
    @app.get("/{full_path:path}")
    async def not_found(full_path: str):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
