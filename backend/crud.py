from sqlalchemy.orm import Session
from models import User, Role, Group
from schemas import UserCreate

def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def create_user(db: Session, user: UserCreate, hashed_password: str, role_id: int = None):
    db_user = User(username=user.username, hashed_password=hashed_password, role_id=role_id)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def assign_role_to_user(db: Session, user_id: int, role_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.role_id = role_id
        db.commit()
        return user
    return None

def create_group(db: Session, name: str, role_id: int):
    group = Group(name=name, role_id=role_id)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

def add_user_to_group(db: Session, user_id: int, group_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    group = db.query(Group).filter(Group.id == group_id).first()
    if user and group:
        group.users.append(user)
        db.commit()
        return group
    return None