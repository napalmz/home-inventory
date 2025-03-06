from sqlalchemy import Column, Integer, String, ForeignKey, Table
from sqlalchemy.orm import relationship, sessionmaker, declarative_base, Session
#from base import Base  # IMPORTA DA base.py
from enum import Enum

Base = declarative_base()

class RoleEnum(str, Enum):
    admin = "admin"
    moderator = "moderator"
    viewer = "viewer"

# Definizione dei ruoli
class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

# Associazione tra utenti e gruppi
user_group_association = Table(
    "user_group_association",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("group_id", Integer, ForeignKey("groups.id")),
)

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"))

    role = relationship("Role")
    users = relationship("User", secondary=user_group_association, back_populates="groups")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)

    role = relationship("Role")
    groups = relationship("Group", secondary=user_group_association, back_populates="users")

class Inventory(Base):
    __tablename__ = "inventories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User")

class Item(Base):
    __tablename__ = "items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    qty = Column(Integer, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"))

class SharedInventory(Base):
    __tablename__ = "shared_inventories"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"))
    user_id = Column(Integer, ForeignKey("users.id"))