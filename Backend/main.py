import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------ Auth APIs ------------------

@app.post("/register")
def register(user: dict, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == user["username"]).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed_pw = bcrypt.hash(user["password"])
    new_user = models.User(username=user["username"], password=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}

@app.post("/login")
def login(user: dict, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user["username"]).first()
    if not db_user or not bcrypt.verify(user["password"], db_user.password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    return {"username": db_user.username}

# ------------------ Diagrams ------------------

@app.post("/save_diagram")
def save_diagram(data: dict, db: Session = Depends(get_db)):
    owner = db.query(models.User).filter(models.User.username == data["username"]).first()
    if not owner:
        raise HTTPException(status_code=400, detail="User not found")
    diagram = models.Diagram(content=data["content"], owner_id=owner.id)
    db.add(diagram)
    db.commit()
    return {"message": "Diagram saved"}

@app.get("/get_diagrams/{username}")
def get_diagrams(username: str, db: Session = Depends(get_db)):
    owner = db.query(models.User).filter(models.User.username == username).first()
    if not owner:
        raise HTTPException(status_code=400, detail="User not found")
    return [{"id": d.id, "content": d.content} for d in owner.diagrams]

# ------------------ Serve React ------------------

frontend_path = os.path.join(os.path.dirname(__file__), "dist")

if os.path.exists(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        index_file = os.path.join(frontend_path, "index.html")
        return FileResponse(index_file)
