from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from models import User, RoleEnum, Role
from schemas import UserCreateSelf, Token, UserResponse, UserSelfUpdate
from passlib.context import CryptContext
from jose import jwt, JWTError
import datetime
import os
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.security.utils import get_authorization_scheme_param
from dotenv import load_dotenv
from dependencies import get_db, get_current_user
from crud import get_setting, set_setting

load_dotenv()

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

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
@router.post("/register", response_model=dict)
def register(
    user: UserCreateSelf,
    db: Session = Depends(get_db)
):
    if (get_setting(db, "ENABLE_REGISTRATION") or "true").lower() != "true":
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
@router.post("/login", response_model=Token)
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
# Logout utente
@router.post("/logout")
def logout(current_user=Depends(get_current_user)):
    # In un'app solo token, il logout è gestito sul client
    # Qui possiamo solo registrare l'evento, oppure implementare blacklist del token
    return {"message": f"Utente {current_user.username} disconnesso"}

#############################################################################
# Info sull'utente loggato
@router.get("/me", response_model=dict)
def get_current_user_info(request: Request, db: Session = Depends(get_db)):
    auth: str = request.headers.get("Authorization")
    scheme, token = get_authorization_scheme_param(auth)

    if not token or scheme.lower() != "bearer":
        token = None

    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if not username:
                raise JWTError()
        except JWTError:
            username = None
    else:
        username = None

    if not username:
        return {
            "id": None,
            "username": None,
            "email": "",
            "role": {
                "id": None,
                "name": None
            },
            "is_blocked": None,
            "data_ins": None,
            "data_mod": None
        }

    user = db.query(User).filter(User.username == username).first()

    if not user:
        return {
            "id": None,
            "username": None,
            "email": "",
            "role": {
                "id": None,
                "name": None
            },
            "is_blocked": None,
            "data_ins": None,
            "data_mod": None
        }

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
        "id": user.id,
        "username": user.username,
        "email": mask_email(user.email),
        "role": {
            "id": user.role.id if user.role else None,
            "name": user.role.name if user.role else None
        },
        "is_blocked": user.is_blocked,
        "data_ins": user.data_ins,
        "data_mod": user.data_mod
    }

#############################################################################
# Aggiornamento dati utente autenticato (anche se non ADMIN)
@router.put("/me", response_model=UserResponse, status_code=status.HTTP_200_OK, dependencies=[])
def update_own_user(update: UserSelfUpdate, 
                    db: Session = Depends(get_db), 
                    current_user: User = Depends(get_current_user)):

    user = db.query(User).filter(User.id == current_user.id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    if update.email:
        user.email = update.email
    if update.password:
        user.hashed_password = hash_password(update.password)

    db.commit()
    db.refresh(user)
    return user

#############################################################################
# Debug DB
@router.get("/debug/db")
def debug_db(db: Session = Depends(get_db)):
    print(f"🔍 DEBUG: db ricevuto in endpoint -> {db}")  # ✅ Debug
    return {"message": "DB ricevuto", "db_type": str(type(db))}