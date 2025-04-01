from fastapi import Depends, HTTPException
import database
from models import User, RoleEnum, Role
from routes.auth import router as get_current_user, hash_password
import os

def role_required(required_role: RoleEnum):  # ✅ Accetta RoleEnum invece di str
    def dependency(user: User = Depends(get_current_user)):
        if user.role is None:
            raise HTTPException(status_code=403, detail="Accesso negato: ruolo non assegnato")
        
        if user.role != required_role:  # ✅ Confronto con RoleEnum
            raise HTTPException(status_code=403, detail="Accesso negato: permessi insufficienti")
        
        return user
    return dependency

def get_db():
    print("🔍 DEBUG: get_db() chiamato")  # ✅ Debug
    db = database.SessionLocal()
    
    if db is None:
        print("❌ ERRORE: La sessione DB è None!")  # ✅ Debug in caso di errore 
    else:
        print("✅ SUCCESSO: Sessione DB creata correttamente")  # ✅ Debug

    try:
        yield db
    finally:
        print("🔄 DEBUG: Chiusura sessione DB")  # ✅ Debug quando il DB viene chiuso
        db.close()

def init_roles_and_admin(db: database.Session):
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