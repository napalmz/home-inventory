from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from routes.auth import hash_password
from dependencies import get_db, role_required
from models import User, RoleEnum, Role, Group
import crud, schemas

router = APIRouter(dependencies=[Depends(role_required(RoleEnum.admin))])

#############################################################################
# Creazione utente
@router.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    hashed_password = hash_password(user.password)
    return crud.create_user(db, user, hashed_password)

# Elenco utenti
@router.get("/users/", response_model=list[schemas.UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()

# Modifica utente
@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, update: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    #if update.username is not None:
    #    user.username = update.username
    if update.password is not None:
        user.hashed_password = hash_password(update.password)
    if update.email is not None:
        user.email = update.email
    if update.is_blocked is not None:
        user.is_blocked = update.is_blocked
    if update.role_id is not None:
        role = db.query(Role).filter(Role.id == update.role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Ruolo non trovato")
        user.role_id = update.role_id

    db.commit()
    db.refresh(user)
    return user

# Eliminazione utente
@router.delete("/users/{user_id}", response_model=dict)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if user.username == "ADMIN":
        raise HTTPException(status_code=403, detail="Non puoi eliminare l'utente ADMIN")
    if user.role and user.role.name == "admin":
        active_admins = db.query(User).join(User.role).filter(User.is_blocked == False, Role.name == "admin", User.id != user.id).count()
        if active_admins == 0:
            raise HTTPException(status_code=403, detail="Impossibile eliminare l'ultimo utente ADMIN abilitato")

    db.delete(user)
    db.commit()
    return {"detail": "Utente eliminato"}

#############################################################################
# Creazione ruolo
@router.post("/roles/", response_model=schemas.RoleResponse)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    return crud.create_role(db, role.name)

# Elenco ruoli
@router.get("/roles/", response_model=list[schemas.RoleResponse])
def list_roles(db: Session = Depends(get_db)):
    return db.query(Role).all()

# Modifica ruolo
@router.put("/roles/{role_id}", response_model=schemas.RoleResponse)
def update_role(role_id: int, update: schemas.RoleCreate, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    role.name = update.name
    db.commit()
    db.refresh(role)
    return role

# Eliminazione ruolo
@router.delete("/roles/{role_id}", response_model=dict)
def delete_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    db.delete(role)
    db.commit()
    return {"detail": "Ruolo eliminato"}

#############################################################################
# Creazione gruppo
@router.post("/groups/", response_model=schemas.GroupResponse)
def create_group(group: schemas.GroupCreate, db: Session = Depends(get_db)):
    return crud.create_group(db, group.name, group.role_id)

# Elenco gruppi
@router.get("/groups/", response_model=list[schemas.GroupResponse])
def list_groups(db: Session = Depends(get_db)):
    return db.query(Group).all()

# Modifica gruppo
@router.put("/groups/{group_id}", response_model=schemas.GroupResponse)
def update_group(group_id: int, update: schemas.GroupCreate, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    group.name = update.name
    group.role_id = update.role_id
    db.commit()
    db.refresh(group)
    return group

# Eliminazione gruppo
@router.delete("/groups/{group_id}", response_model=dict)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    db.delete(group)
    db.commit()
    return {"detail": "Gruppo eliminato"}

#############################################################################
# Assegnazione ruolo a utente
@router.post("/users/{user_id}/role/{role_id}")
def assign_role(user_id: int, role_id: int, db: Session = Depends(get_db)):
    user = crud.assign_role_to_user(db, user_id, role_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return schemas.UserResponse.model_validate(user)  # ✅ Converti SQLAlchemy → Pydantic

# Blocco/sblocco utente
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