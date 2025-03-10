from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import relationship, sessionmaker, declarative_base, Session
from enum import Enum

Base = declarative_base()

class LoggingData:
    data_ins = Column(DateTime, default=lambda: datetime.now(datetime.UTC), nullable=False)
    data_mod = Column(DateTime, default=lambda: datetime.now(datetime.UTC), onupdate=lambda: datetime.now(datetime.UTC), nullable=False)

    @declared_attr
    def user_ins(cls):
        return Column(Integer, ForeignKey('users.id'), nullable=False)

    @declared_attr
    def user_mod(cls):
        return Column(Integer, ForeignKey('users.id'), nullable=True)

class RoleEnum(str, Enum):
    admin = "admin"
    moderator = "moderator"
    viewer = "viewer"

# Definizione dei ruoli
class Role(Base, LoggingData):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

# Associazione tra utenti e gruppi
class UserGroupAssociation(Base, LoggingData):
    __tablename__ = "user_group_association"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), primary_key=True)

    # Relazioni con User e Group
    user = relationship("User", back_populates="group_associations")
    group = relationship("Group", back_populates="user_associations")

class Group(Base, LoggingData):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"))

    role = relationship("Role")
    user_links = relationship("UserGroupAssociation", back_populates="group")

class User(Base, LoggingData):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)

    role = relationship("Role")
    group_links = relationship("UserGroupAssociation", back_populates="user")

class Inventory(Base, LoggingData):
    __tablename__ = "inventories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User")

class Item(Base, LoggingData):
    __tablename__ = "items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    qty = Column(Integer, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"))

class SharedInventory(Base, LoggingData):
    __tablename__ = "shared_inventories"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"))
    user_id = Column(Integer, ForeignKey("users.id"))