from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, func
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import relationship, sessionmaker, declarative_base, Session
from enum import Enum

Base = declarative_base()

class LoggingData:
    data_ins = Column(DateTime, server_default=func.now(), nullable=False)
    data_mod = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    @declared_attr
    def user_ins(cls):
        return Column(Integer, ForeignKey('users.id'), nullable=False)

    @declared_attr
    def user_mod(cls):
        return Column(Integer, ForeignKey('users.id'), nullable=True)

    # Esplicita le relazioni per evitare ambiguità
    @declared_attr
    def user_ins_rel(cls):
        return relationship("User", foreign_keys=[cls.user_ins])

    @declared_attr
    def user_mod_rel(cls):
        return relationship("User", foreign_keys=[cls.user_mod])

class RoleEnum(str, Enum):
    admin = "admin"
    moderator = "moderator"
    viewer = "viewer"

# Definizione dei ruoli
class Role(Base, LoggingData):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    users = relationship("User", back_populates="role", foreign_keys="[User.role_id]")

# Associazione tra utenti e gruppi
class UserGroupAssociation(Base, LoggingData):
    __tablename__ = "user_group_association"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), primary_key=True)

    # Relazioni con User e Group, specificando foreign_keys
    user = relationship("User", back_populates="group_associations", foreign_keys=[user_id])
    group = relationship("Group", back_populates="user_associations", foreign_keys=[group_id])

class User(Base, LoggingData):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)

    # Esplicita la foreign key nella relazione con Role
    role = relationship("Role", foreign_keys=[role_id])

    group_associations = relationship("UserGroupAssociation", back_populates="user")
    groups = relationship("Group", secondary="user_group_association", back_populates="users")

class Group(Base, LoggingData):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"))

    role = relationship("Role")
    user_associations = relationship("UserGroupAssociation", back_populates="group")
    users = relationship("User", secondary="user_group_association", back_populates="groups")

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