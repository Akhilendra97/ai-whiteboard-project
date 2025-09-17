from fastapi import FastAPI, WebSocket, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import json
import models, auth

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve React frontend
app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")


# -------------------
# Auth Routes
# -------------------

@app.post("/register")
def register(username: str, password: str, db: Session = Depends(auth.get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already taken")
    hashed = auth.hash_password(password)
    new_user = models.User(username=username, hashed_password=hashed)
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(auth.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/save_diagram")
def save_diagram(content: str, user=Depends(auth.get_current_user), db: Session = Depends(auth.get_db)):
    new_diag = models.Diagram(user_id=user.id, content=content)
    db.add(new_diag)
    db.commit()
    return {"message": "Diagram saved"}


@app.get("/my_diagrams")
def get_diagrams(user=Depends(auth.get_current_user), db: Session = Depends(auth.get_db)):
    diags = db.query(models.Diagram).filter(models.Diagram.user_id == user.id).all()
    return [{"id": d.id, "content": d.content} for d in diags]


# -------------------
# Whiteboard WebSocket
# -------------------

clients = []

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        while True:
            data = await ws.receive_text()
            for client in clients:
                if client != ws:
                    await client.send_text(data)
    except:
        clients.remove(ws)
