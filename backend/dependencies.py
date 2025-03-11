from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, RoleEnum
from routes.auth import router as get_current_user

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def role_required(required_role: RoleEnum):  # ✅ Accetta RoleEnum invece di str
    def dependency(user: User = Depends(get_current_user)):
        if user.role is None:
            raise HTTPException(status_code=403, detail="Accesso negato: ruolo non assegnato")
        
        if user.role != required_role:  # ✅ Confronto con RoleEnum
            raise HTTPException(status_code=403, detail="Accesso negato: permessi insufficienti")
        
        return user
    return dependency