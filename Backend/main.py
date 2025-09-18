from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import os

from database import SessionLocal, engine, Base
from models import User, Diagram

# Create DB tables if not exist
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # you can restrict to your domain later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Dependency to get DB session
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
# FRONTEND (React build)
# ----------------------------

# Serve built React frontend from dist/
frontend_path = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
# Add these imports near top if not present
from fastapi import Path

# Update diagram endpoint: expects JSON { "id": <int>, "content": "<dataurl>" }
@app.post("/update_diagram")
def update_diagram(payload: dict, db: Session = Depends(get_db)):
    diagram_id = payload.get("id")
    content = payload.get("content")
    if not diagram_id or not content:
        raise HTTPException(status_code=400, detail="id and content required")
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    diagram.content = content
    db.commit()
    return {"message": "Updated"}

# Delete endpoint
@app.delete("/diagram/{id}")
def delete_diagram(id: int = Path(...), db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(diagram)
    db.commit()
    return {"message": "Deleted"}
# POST /save_diagram
from fastapi import Body

@app.post("/save_diagram")
def save_diagram(payload: dict = Body(...), db: Session = Depends(get_db)):
    # payload: { username, content, id? }
    username = payload.get("username")
    content = payload.get("content")
    diagram_id = payload.get("id", None)

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    if diagram_id:
        # update existing
        diagram = db.query(Diagram).filter(Diagram.id == diagram_id, Diagram.owner_id == user.id).first()
        if not diagram:
            raise HTTPException(status_code=404, detail="Diagram not found")
        diagram.content = content
        db.commit()
        return {"message": "updated", "id": diagram.id}
    else:
        # create new
        d = Diagram(content=content, owner_id=user.id)
        db.add(d)
        db.commit()
        db.refresh(d)
        return {"message": "created", "id": d.id}
@app.delete("/delete_diagram/{diagram_id}")
def delete_diagram(diagram_id: int, db: Session = Depends(get_db)):
    d = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(d)
    db.commit()
    return {"message": "deleted"}
