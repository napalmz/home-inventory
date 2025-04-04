from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import User, RoleEnum, Role
from schemas import UserCreate, Token
from passlib.context import CryptContext
from jose import jwt
import datetime
import os
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, SecurityScopes
from dotenv import load_dotenv
from dependencies import get_db, get_current_user

load_dotenv()

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
ENABLE_REGISTRATION = os.getenv("ENABLE_REGISTRATION", "true").lower() == "true"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: int = ACCESS_TOKEN_EXPIRE_MINUTES):
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=expires_delta)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

#############################################################################
# Registrazione utente
@router.post("/register/", response_model=dict)
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    if not ENABLE_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registrazione disabilitata")
    
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username già in uso")
    hashed_password = hash_password(user.password)

    viewer_role = db.query(Role).filter(Role.name == RoleEnum.viewer).first()
    if not viewer_role:
        raise HTTPException(status_code=500, detail="Ruolo viewer non trovato nel database")

    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role_id=viewer_role.id
    )
    db.add(new_user)
    db.commit()
    return {"message": "Utente registrato con successo"}

#############################################################################
# Login utente
@router.post("/login/", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    #print(f"🔍 DEBUG: db ricevuto in login -> {db}")  # ✅ Debug

    if db is None:  # ✅ Debug: Controlla se db è None
        raise HTTPException(status_code=500, detail="Errore interno: database non disponibile")

    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")
    
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

#############################################################################
# Info sull'utente loggato
@router.get("/me", response_model=dict)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    def mask_email(email: str) -> str:
        if not email or "@" not in email:
            return ""
        name, domain = email.split("@", 1)
        if len(name) <= 2:
            masked = name[0] + "*" + "@" + domain
        else:
            masked = name[0] + "*" * (len(name) - 2) + name[-1] + "@" + domain
        return masked

    return {
        "username": current_user.username,
        "role": current_user.role.name if current_user.role else None,
        "is_blocked": current_user.is_blocked,
        "email": mask_email(current_user.email)
    }

#############################################################################
# Debug DB
@router.get("/debug/db")
def debug_db(db: Session = Depends(get_db)):
    print(f"🔍 DEBUG: db ricevuto in endpoint -> {db}")  # ✅ Debug
    return {"message": "DB ricevuto", "db_type": str(type(db))}