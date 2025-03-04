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

def role_required(required_role: RoleEnum):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Non hai i permessi per eseguire questa azione"
            )
        return current_user
    return role_checker