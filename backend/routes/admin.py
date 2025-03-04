from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import User, RoleEnum
from database import SessionLocal
from dependencies import role_required, get_db

router = APIRouter()

@router.put("/users/{user_id}/role/")
def update_user_role(
    user_id: int,
    new_role: RoleEnum,
    db: Session = Depends(get_db),
    admin=Depends(role_required(RoleEnum.admin))
):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utente non trovato")
    
    if user.role == RoleEnum.admin and new_role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Non puoi rimuovere un amministratore")

    user.role = new_role
    db.commit()
    return {"message": f"Ruolo di {user.username} aggiornato a {user.role}"}