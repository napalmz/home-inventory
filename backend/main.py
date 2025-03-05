import os
from sqlalchemy.orm import Session
from fastapi import FastAPI
from database import engine, Base, SessionLocal, init_roles
from models import User, RoleEnum
from routes.auth import router as auth_router, hash_password
from routes.inventory import router as inventory_router
from routes.admin import router as admin_router
from routes.user import router as user_router

def create_admin_user():
    admin_username = "ADMIN"
    admin_password = os.getenv("ADMIN_PASSWORD")  # La password viene letta da un ENV
    if not admin_password:
        print("Errore: Variabile d'ambiente ADMIN_PASSWORD non impostata!")
        return

    db: Session = SessionLocal()
    admin_user = db.query(User).filter(User.username == admin_username).first()
    
    if not admin_user:
        hashed_password = hash_password(admin_password)
        new_admin = User(username=admin_username, hashed_password=hashed_password, role=RoleEnum.admin)
        db.add(new_admin)
        db.commit()
        print("✅ Utente ADMIN creato con successo")
    else:
        print("ℹ️ Utente ADMIN già esistente")

    db.close()

app = FastAPI()

Base.metadata.create_all(bind=engine)

db = SessionLocal()
init_roles(db)
db.close()

create_admin_user()

app.include_router(admin_router, prefix="/admin", tags=["Admin"])
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(inventory_router, prefix="/inventory", tags=["Inventory"])
app.include_router(user_router, prefix="/user", tags=["User"])

@app.get("/")
def home():
    return {"message": "API Inventory attiva!"}