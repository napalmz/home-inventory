from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, Boolean, func, UniqueConstraint
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import relationship, sessionmaker, declarative_base, Session
from enum import Enum

Base = declarative_base()

################################################
class LoggingData:
    data_ins = Column(DateTime, server_default=func.now(), nullable=False)
    data_mod = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    @declared_attr
    def user_ins(cls):
        return Column(Integer, ForeignKey('users.id'), nullable=True)

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

################################################
class RoleEnum(str, Enum):
    admin = "admin"
    moderator = "moderator"
    viewer = "viewer"

################################################
# Definizione dei ruoli
class Role(Base, LoggingData):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    users = relationship("User", back_populates="role", foreign_keys="[User.role_id]")

################################################
# Associazione tra utenti e gruppi
class UserGroupAssociation(Base, LoggingData):
    __tablename__ = "user_group_association"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), primary_key=True)

    # Relazioni esplicite con Foreign Keys
    user = relationship("User", back_populates="group_associations", foreign_keys=[user_id], overlaps="groups")
    group = relationship("Group", back_populates="user_associations", foreign_keys=[group_id], overlaps="users")

################################################
class User(Base, LoggingData):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_blocked = Column(Boolean, default=False)
    email = Column(String, nullable=True)

    # Relazioni esplicite
    role = relationship("Role", foreign_keys=[role_id])
    
    # Relazione con UserGroupAssociation con chiave esplicita
    group_associations = relationship("UserGroupAssociation",
                                      back_populates="user",
                                      foreign_keys="[UserGroupAssociation.user_id]",
                                      overlaps="groups"
                                    )
    # Relazione Many-to-Many con Group tramite user_group_association con Foreign Keys esplicite
    groups = relationship("Group",
                          secondary="user_group_association",
                          primaryjoin="User.id == UserGroupAssociation.user_id",
                          secondaryjoin="Group.id == UserGroupAssociation.group_id",
                          back_populates="users",
                          overlaps="group_associations,user"
                        )

################################################
class Group(Base, LoggingData):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"))

    role = relationship("Role")

    # Relazione esplicita con UserGroupAssociation
    user_associations = relationship("UserGroupAssociation",
                                     back_populates="group",
                                     foreign_keys="[UserGroupAssociation.group_id]",
                                     overlaps="users"
                                    )
    # Relazione Many-to-Many con User con chiavi esplicite
    users = relationship("User",
                         secondary="user_group_association",
                         primaryjoin="Group.id == UserGroupAssociation.group_id",
                         secondaryjoin="User.id == UserGroupAssociation.user_id",
                         back_populates="groups",
                         overlaps="user_associations,group"
                        )

################################################
class Inventory(Base, LoggingData):
    __tablename__ = "inventories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(String, nullable=False, default="INVENTORY")
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", foreign_keys=[owner_id])
    items = relationship("Item", back_populates="inventory", cascade="all, delete-orphan")

    # Relazione per gli utenti con cui è condiviso
    shared_with_users = relationship("SharedInventory", back_populates="inventory", cascade="all, delete-orphan")

    # Relazione per i gruppi con cui è condiviso
    shared_with_groups = relationship("SharedInventoryGroup", back_populates="inventory", cascade="all, delete-orphan")

################################################
class Item(Base, LoggingData):
    __tablename__ = "items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    quantity = Column(Integer, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"), nullable=False)
    inventory = relationship("Inventory", back_populates="items")

################################################
class SharedInventory(Base, LoggingData):
    __tablename__ = "shared_inventories"
    __table_args__ = (UniqueConstraint('user_id', 'inventory_id', name='_user_inventory_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    inventory = relationship("Inventory", back_populates="shared_with_users")

################################################
class SharedInventoryGroup(Base, LoggingData):
    __tablename__ = "shared_inventory_groups"
    __table_args__ = (UniqueConstraint('group_id', 'inventory_id', name='_group_inventory_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"))
    group_id = Column(Integer, ForeignKey("groups.id"))

    inventory = relationship("Inventory", back_populates="shared_with_groups")
    group = relationship("Group", backref="shared_inventories")

################################################
class Setting(Base, LoggingData):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String)
    protected = Column(Boolean, default=False)  # ← nuovo campo