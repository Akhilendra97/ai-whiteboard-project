from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, User, Diagram
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os

from fastapi.middleware.cors import CORSMiddleware

# ========================================
# Setup
# ========================================
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev. In prod, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "mysecret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# ========================================
# DB Dependency
# ========================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ========================================
# Auth Helpers
# ========================================
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


# ========================================
# Auth Routes
# ========================================
@app.post("/register")
def register(data: dict, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data["username"]).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    new_user = User(username=data["username"], password=data["password"])
    db.add(new_user)
    db.commit()
    return {"message": "User registered"}


@app.post("/login")
def login(data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data["username"], User.password == data["password"]).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    token = create_access_token({"sub": user.username}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"token": token}


# ========================================
# Diagram Routes (with Title support)
# ========================================
@app.post("/save_diagram")
def save_diagram(data: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    new_diagram = Diagram(user_id=user.id, title=data.get("title", "Untitled"), image=data["image"])
    db.add(new_diagram)
    db.commit()
    db.refresh(new_diagram)
    return {"id": new_diagram.id, "title": new_diagram.title}


@app.get("/get_diagrams")
def get_diagrams(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    diagrams = db.query(Diagram).filter(Diagram.user_id == user.id).all()
    return [{"id": d.id, "title": d.title, "image": d.image} for d in diagrams]


@app.put("/rename_diagram/{diagram_id}")
def rename_diagram(diagram_id: int, data: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id, Diagram.user_id == user.id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    diagram.title = data["title"]
    db.commit()
    return {"message": "Renamed", "title": diagram.title}


@app.delete("/delete_diagram/{diagram_id}")
def delete_diagram(diagram_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id, Diagram.user_id == user.id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    db.delete(diagram)
    db.commit()
    return {"message": "Deleted"}
