from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
import os
from dotenv import load_dotenv
from models import User, Role, RoleEnum, Base
from routes.auth import hash_password

load_dotenv()  # Carica le variabili dal file .env

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@inventory-db/inventory")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    print("ℹ️ Creazione delle tabelle...")
    print("ℹ️ Modelli registrati:", Base.metadata.tables.keys())
    Base.metadata.create_all(bind=engine)
    print("✅ Tabelle create con successo!")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_roles_and_admin(db: Session):
    role_objects = {}
    admin_username = "admin"

    # 1️⃣ Creiamo i ruoli senza user_ins
    for role_enum in RoleEnum:
        role_name = role_enum.value  # 👈 Otteniamo il valore della Enum
        existing_role = db.query(Role).filter(Role.name == role_name).first()
        if not existing_role:
            new_role = Role(name=role_name)  # 👈 Non assegniamo subito user_ins
            db.add(new_role)
            db.flush()  # 👈 Necessario per ottenere l'ID subito senza commit
            role_objects[role_name] = new_role

    db.commit()

    # 2️⃣ Creiamo l'utente ADMIN
    admin_password = os.getenv("ADMIN_PASSWORD")  # La password viene letta da un ENV

    admin_user = db.query(User).filter(User.username == admin_username).first()
    if not admin_user:
        admin_user = User(
            username=admin_username,
            hashed_password=hash_password(admin_password),
            role_id=role_objects[RoleEnum.admin.value].id  # 👈 Assegniamo subito il ruolo admin
        )
        db.add(admin_user)
        db.commit()

    # 3️⃣ Aggiorniamo i ruoli con `user_ins`
    for role in role_objects.values():
        role.user_ins = admin_user.id  # 👈 Ora assegniamo l'utente
    db.commit()