from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, User, Diagram
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt
import os

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Whiteboard Backend (SQLite)")

# Allow all origins (fine for dev/deploy via same host)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth helpers
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "please_change_this_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ---------- AUTH ----------
@app.post("/register")
def register(payload: dict, db: Session = Depends(get_db)):
    username = payload.get("username")
    password = payload.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed = pwd_context.hash(password)
    user = User(username=username, hashed_password=hashed)
    db.add(user)
    db.commit()
    return {"msg": "User registered"}

@app.post("/login")
def login(payload: dict, db: Session = Depends(get_db)):
    username = payload.get("username")
    password = payload.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")
    user = db.query(User).filter(User.username == username).first()
    if not user or not pwd_context.verify(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    token = create_access_token({"sub": user.username})
    return {"token": token, "username": user.username}

# ---------- DIAGRAMS ----------
@app.post("/save_diagram")
def save_diagram(payload: dict, db: Session = Depends(get_db)):
    username = payload.get("username")
    title = payload.get("title", "Untitled")
    content = payload.get("content")
    if not username or not content:
        raise HTTPException(status_code=400, detail="username and content required")
    # If client sent id (overwrite), update
    diagram_id = payload.get("id")
    if diagram_id:
        d = db.query(Diagram).filter(Diagram.id == diagram_id, Diagram.owner == username).first()
        if d:
            d.title = title
            d.content = content
            db.commit()
            return {"msg": "Updated", "id": d.id}
    # create new
    d = Diagram(title=title, content=content, owner=username)
    db.add(d)
    db.commit()
    db.refresh(d)
    return {"msg": "Saved", "id": d.id}

@app.get("/get_diagrams/{username}")
def get_diagrams(username: str, db: Session = Depends(get_db)):
    items = db.query(Diagram).filter(Diagram.owner == username).order_by(Diagram.id.desc()).all()
    return [{"id": i.id, "title": i.title, "content": i.content} for i in items]

@app.delete("/delete_diagram/{diagram_id}")
def delete_diagram(diagram_id: int, db: Session = Depends(get_db)):
    d = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Diagram not found")
    db.delete(d)
    db.commit()
    return {"msg": "Deleted"}

@app.put("/rename_diagram/{diagram_id}")
def rename_diagram(diagram_id: int, payload: dict, db: Session = Depends(get_db)):
    title = payload.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="title required")
    d = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Diagram not found")
    d.title = title
    db.commit()
    return {"msg": "Renamed", "title": d.title}

# ---------- SERVE FRONTEND (if dist exists) ----------
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse("dist/index.html")
