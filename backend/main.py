"""SahabNote Backend - FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routes.auth_routes import router as auth_router
from routes.note_routes import router as note_router
from routes.sync_routes import router as sync_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
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

# Include routers
app.include_router(auth_router)
app.include_router(note_router)
app.include_router(sync_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "sahabnote-api", "version": "1.0.0"}
