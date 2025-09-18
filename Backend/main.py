from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, User, Diagram
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import os

# Initialize DB
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth config
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Token creation
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ========= AUTH ROUTES =========

@app.post("/register")
def register(user: dict, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user["username"]).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed_pw = pwd_context.hash(user["password"])
    new_user = User(username=user["username"], hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"msg": "Registered successfully"}

@app.post("/login")
def login(user: dict, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user["username"]).first()
    if not db_user or not pwd_context.verify(user["password"], db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    token = create_access_token({"sub": db_user.username})
    return {"token": token}


# ========= DIAGRAM ROUTES =========

@app.post("/save_diagram")
def save_diagram(payload: dict, db: Session = Depends(get_db)):
    diagram = Diagram(title=payload["title"], content=payload["content"], owner=payload["username"])
    db.add(diagram)
    db.commit()
    return {"msg": "Diagram saved"}

@app.get("/get_diagrams/{username}")
def get_diagrams(username: str, db: Session = Depends(get_db)):
    return db.query(Diagram).filter(Diagram.owner == username).all()

@app.delete("/delete_diagram/{diagram_id}")
def delete_diagram(diagram_id: int, db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    db.delete(diagram)
    db.commit()
    return {"msg": "Diagram deleted"}


# ========= FRONTEND =========

if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse("dist/index.html")
