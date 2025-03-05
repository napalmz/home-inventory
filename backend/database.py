from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
import os
from dotenv import load_dotenv
from models import Role
from base import Base  # IMPORTA DA base.py

load_dotenv()  # Carica le variabili dal file .env

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@inventory-db/inventory")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Crea le tabelle se non esistono
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