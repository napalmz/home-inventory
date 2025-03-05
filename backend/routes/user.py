from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import crud, schemas

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
    return user