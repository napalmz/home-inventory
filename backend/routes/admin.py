from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import User, Role, RoleEnum
from dependencies import get_db, role_required

#router = APIRouter()
router = APIRouter(dependencies=[Depends(role_required(RoleEnum.admin))])

# Aggiorna il ruolo di un utente
@router.put("/users/{user_id}/role/")
def update_user_role(
    user_id: int,
    new_role: str,  # Cambiato da RoleEnum a str
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utente non trovato")
    
    #if user.role.name == RoleEnum.admin.value and new_role != RoleEnum.admin.value:
    #    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Non puoi rimuovere un amministratore")

    # Converte il ruolo stringa in enum
    new_role_obj = db.query(Role).filter(Role.name == new_role).first()
    if not new_role_obj:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")

    try:
        #user.role = RoleEnum(new_role)
        user.role = new_role_obj
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ruolo non valido")

    db.commit()

    return {
        "message": "Ruolo aggiornato con successo",
        "username": user.username,
        "new_role": user.role.name
    }