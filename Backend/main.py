from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models
import os
from fastapi.responses import FileResponse

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change later to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Example API ---
@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# --- User register/login & diagrams API would be here ---
# (already in your previous models + auth setup)


# --- Serve React frontend ---
frontend_path = os.path.join(os.path.dirname(__file__), "dist")

# Mount static files
if os.path.exists(frontend_path):
    app.mount(
        "/static",
        StaticFiles(directory=os.path.join(frontend_path, "assets")),
        name="static",
    )

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        index_path = os.path.join(frontend_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Page not found")
