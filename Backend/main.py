from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import os

from models import SessionLocal, init_db, User, Diagram

# -------------------------------------------------
# App Setup
# -------------------------------------------------
app = FastAPI()

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Initialize DB (creates tables if not exist)
init_db()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------------------------------
# Authentication Routes
# -------------------------------------------------
@app.post("/register")
def register(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed_pw = pwd_context.hash(password)
    new_user = User(username=username, password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}


@app.post("/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not pwd_context.verify(password, user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return {"message": "Login successful"}

# -------------------------------------------------
# Diagram Routes
# -------------------------------------------------
@app.post("/save_diagram")
def save_diagram(username: str, content: str, db: Session = Depends(get_db)):
    diagram = Diagram(owner=username, content=content)
    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    return {"message": "Diagram saved"}


@app.get("/diagrams/{username}")
def get_diagrams(username: str, db: Session = Depends(get_db)):
    diagrams = db.query(Diagram).filter(Diagram.owner == username).all()
    return diagrams

# -------------------------------------------------
# WebSocket (for real-time drawing)
# -------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # For now: echo data back to client
            await websocket.send_text(data)
    except WebSocketDisconnect:
        pass

# -------------------------------------------------
# Serve Frontend (React build)
# -------------------------------------------------
frontend_path = os.path.join(os.path.dirname(__file__), "dist")

if os.path.exists(frontend_path):
    # Serve entire dist folder (fixes blank screen issue)
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
