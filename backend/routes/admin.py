from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import User, RoleEnum
from dependencies import get_db, role_required

router = APIRouter()

@router.put("/users/{user_id}/role/")
def update_user_role(
    user_id: int,
    new_role: str,  # Cambiato da RoleEnum a str
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utente non trovato")
    
    if user.role == RoleEnum.admin.value and new_role != RoleEnum.admin.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Non puoi rimuovere un amministratore")

    # Converte il ruolo stringa in enum
    try:
        user.role = RoleEnum(new_role)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ruolo non valido")

    db.commit()

    return {"message": f"Ruolo di {user.username} aggiornato a {user.role.value}"}
