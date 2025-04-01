from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from dependencies import get_db
from models import User, RoleEnum
import crud, schemas

def role_required(required_role: RoleEnum):  # ✅ Accetta RoleEnum invece di str
    def dependency(user: User = Depends(get_current_user)):
        if user.role is None:
            raise HTTPException(status_code=403, detail="Accesso negato: ruolo non assegnato")
        
        if user.role != required_role:  # ✅ Confronto con RoleEnum
            raise HTTPException(status_code=403, detail="Accesso negato: permessi insufficienti")
        
        return user
    return dependency

router = APIRouter()

@router.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    hashed_password = user.password  # Qui andrebbe la funzione di hashing
    return crud.create_user(db, user, hashed_password)

@router.post("/roles/", response_model=schemas.RoleResponse)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    return crud.create_role(db, role.name)

@router.post("/groups/", response_model=schemas.GroupResponse)
def create_group(group: schemas.GroupCreate, db: Session = Depends(get_db)):
    return crud.create_group(db, group.name, group.role_id)

@router.post("/users/{user_id}/role/{role_id}")
def assign_role(user_id: int, role_id: int, db: Session = Depends(get_db)):
    user = crud.assign_role_to_user(db, user_id, role_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return schemas.UserResponse.model_validate(user)  # ✅ Converti SQLAlchemy → Pydantic

@router.patch("/users/{user_id}/block", response_model=schemas.UserResponse)
def block_user(user_id: int,
               db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # ✅ Previene auto-blocco
    admin = role_required(RoleEnum.admin)
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Non puoi bloccare te stesso!")

    user.is_blocked = not user.is_blocked  # ✅ Inverte lo stato
    db.commit()
    db.refresh(user)
    
    status_text = "bloccato" if user.is_blocked else "sbloccato"
    return {"message": f"Utente {user.username} {status_text}", "user": user}