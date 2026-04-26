"""SahabNote Backend - FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
from database import init_db, migrate_db, get_db
from routes.auth_routes import router as auth_router
from routes.note_routes import router as note_router
from routes.sync_routes import router as sync_router
from routes.admin_routes import router as admin_router


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

# Include routers (must be before static mount to take priority)
app.include_router(auth_router)
app.include_router(note_router)
app.include_router(sync_router)
app.include_router(admin_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "sahabnote-api", "version": "1.0.0"}


# Serve static files from the web/ directory (catch-all after API routes)
web_dir = Path(__file__).parent.parent / "web"
if web_dir.exists():
    app.mount("/", StaticFiles(directory=str(web_dir), html=True), name="web")
