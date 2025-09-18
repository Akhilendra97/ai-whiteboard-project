from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import os

from database import SessionLocal, engine, Base
from models import User, Diagram

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # for production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------------------
# AUTH ENDPOINTS
# ----------------------------

@app.post("/register")
def register(user: dict = Body(...), db: Session = Depends(get_db)):
    username = user.get("username")
    password = user.get("password")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed_pw = pwd_context.hash(password)
    new_user = User(username=username, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered", "username": new_user.username}


@app.post("/login")
def login(user: dict = Body(...), db: Session = Depends(get_db)):
    username = user.get("username")
    password = user.get("password")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    db_user = db.query(User).filter(User.username == username).first()
    if not db_user or not pwd_context.verify(password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"message": "Login successful", "username": db_user.username}

# ----------------------------
# DIAGRAM ENDPOINTS
# ----------------------------

@app.post("/save_diagram")
def save_diagram(payload: dict = Body(...), db: Session = Depends(get_db)):
    username = payload.get("username")
    content = payload.get("content")
    diagram_id = payload.get("id")

    if not username or not content:
        raise HTTPException(status_code=400, detail="Username and content required")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if diagram_id:
        diagram = db.query(Diagram).filter(Diagram.id == diagram_id, Diagram.owner_id == user.id).first()
        if not diagram:
            raise HTTPException(status_code=404, detail="Diagram not found")
        diagram.content = content
        db.commit()
        return {"message": "Diagram updated", "id": diagram.id}
    else:
        new_diagram = Diagram(content=content, owner_id=user.id)
        db.add(new_diagram)
        db.commit()
        db.refresh(new_diagram)
        return {"message": "Diagram saved", "id": new_diagram.id}


@app.get("/get_diagrams/{username}")
def get_diagrams(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    diagrams = db.query(Diagram).filter(Diagram.owner_id == user.id).all()
    return [{"id": d.id, "content": d.content} for d in diagrams]


@app.delete("/delete_diagram/{diagram_id}")
def delete_diagram(diagram_id: int, db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    db.delete(diagram)
    db.commit()
    return {"message": "Diagram deleted"}

# ----------------------------
# SERVE FRONTEND (React dist/)
# ----------------------------

frontend_path = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
