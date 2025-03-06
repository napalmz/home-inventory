from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
import os
from dotenv import load_dotenv
from models import User, Role, RoleEnum
from base import Base  # IMPORTA DA base.py
from routes.auth import router as hash_password

load_dotenv()  # Carica le variabili dal file .env

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@inventory-db/inventory")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

"""Crea le tabelle nel database"""
print("Creating database tables...")
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_roles(db: Session):
    role_names = ["admin", "moderator", "viewer"]
    for role_name in role_names:
        existing_role = db.query(Role).filter(Role.name == role_name).first()
        if not existing_role:
            new_role = Role(name=role_name)
            db.add(new_role)
    db.commit()

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