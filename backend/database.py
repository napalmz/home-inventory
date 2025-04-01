from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv
from models import User, Role, RoleEnum, Base
import os

load_dotenv()  # Carica le variabili dal file .env

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@inventory-db/inventory")

engine = create_engine(DATABASE_URL)  # ✅ `echo=True` per vedere le query SQL
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    print("ℹ️ Creazione delle tabelle...")
    print("ℹ️ Modelli registrati:", Base.metadata.tables.keys())
    Base.metadata.create_all(bind=engine)
    print("✅ Tabelle create con successo!")