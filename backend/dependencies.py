from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, SecurityScopes
from database import SessionLocal, Session
from models import User, RoleEnum, Role
from jose import jwt
import os

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
ENABLE_REGISTRATION = os.getenv("ENABLE_REGISTRATION", "true").lower() == "true"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_db():
    db = SessionLocal()
    
    if db is None:
        print("❌ ERRORE: La sessione DB è None!")  # ✅ Debug in caso di errore 

    try:
        yield db
    finally:
        db.close()

def init_roles_and_admin(db: Session):
    from routes.auth import hash_password
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

def get_current_user(security_scopes: SecurityScopes,
                     token: str = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token non valido")
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utente non trovato")
        if user.role is None:
            raise HTTPException(status_code=403, detail="Accesso negato: ruolo non assegnato")
        if user.is_blocked:  # ✅ Blocca l'accesso agli utenti disabilitati
            raise HTTPException(status_code=403, detail="Utente bloccato. Accesso negato.")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token non valido")

def role_required(required_role: RoleEnum):  # ✅ Accetta RoleEnum invece di str
    def dependency(user: User = Depends(get_current_user)):
        if user.role is None:
            raise HTTPException(status_code=403, detail="Accesso negato: ruolo non assegnato")
        if user.role.name != required_role.value:  # ✅ Confronto con RoleEnum
            raise HTTPException(status_code=403, detail="Accesso negato: permessi insufficienti")
        return user
    return dependency