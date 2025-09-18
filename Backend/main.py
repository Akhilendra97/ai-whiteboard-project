from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import engine, SessionLocal
from models import Base, User, Diagram
import os

Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, set to your domain
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

# --- API Routes ---
@app.post("/register")
def register(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    new_user = User(username=username, password=password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

@app.post("/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username, User.password == password).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return {"message": "Login successful"}

@app.post("/save_diagram")
def save_diagram(user_id: int, content: str, db: Session = Depends(get_db)):
    new_diagram = Diagram(user_id=user_id, content=content)
    db.add(new_diagram)
    db.commit()
    db.refresh(new_diagram)
    return {"message": "Diagram saved", "id": new_diagram.id}

@app.get("/diagrams/{user_id}")
def get_diagrams(user_id: int, db: Session = Depends(get_db)):
    diagrams = db.query(Diagram).filter(Diagram.user_id == user_id).all()
    return diagrams

# --- Frontend Serving ---
frontend_path = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        return FileResponse(os.path.join(frontend_path, "index.html"))
