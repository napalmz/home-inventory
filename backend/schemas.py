from __future__ import annotations
from typing import List, Optional, TYPE_CHECKING
from pydantic import BaseModel
from datetime import datetime

################################################
# Modello base per aggiungere campi comuni
class LoggingResponse(BaseModel):
    data_ins: datetime
    data_mod: datetime
    user_ins: Optional[int] = None  # ID dell'utente che ha creato il record
    user_mod: Optional[int] = None  # ID dell'utente che ha modificato il record

LoggingResponse.model_rebuild()

################################################
# Modello per i ruoli
class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class RoleResponse(RoleBase, LoggingResponse):
    id: int
    
    class Config:
        from_attributes = True

RoleBase.model_rebuild()
RoleCreate.model_rebuild()
RoleResponse.model_rebuild()

################################################
# Modello per gli utenti
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    hashed_password: str  # La password non viene restituita nelle risposte

class UserUpdate(UserBase):
    role_id: Optional[int] = None
    is_blocked: Optional[bool] = None  # ✅ Permette di aggiornare lo stato bloccato

class UserResponse(UserBase, LoggingResponse):
    id: int
    role: Optional['RoleResponse']
    is_blocked: bool
    
    class Config:
        from_attributes = True

UserBase.model_rebuild()
UserCreate.model_rebuild()
UserUpdate.model_rebuild()
UserResponse.model_rebuild()

################################################
# Modello per i gruppi
class GroupBase(BaseModel):
    name: str

class GroupCreate(GroupBase):
    pass

class GroupResponse(GroupBase, LoggingResponse):
    id: int
    users: List['UserResponse'] = []
    
    class Config:
        from_attributes = True

GroupBase.model_rebuild()
GroupCreate.model_rebuild()
GroupResponse.model_rebuild()

################################################
# Modello per la creazione e risposta di un inventario
class InventoryBase(BaseModel):
    name: str

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase, LoggingResponse):
    id: int
    owner: 'UserResponse'  # Riferimento all'utente proprietario
    
    class Config:
        from_attributes = True

InventoryBase.model_rebuild()
InventoryCreate.model_rebuild()
InventoryResponse.model_rebuild()

################################################
# Modello per gli elementi di un inventario
class InventoryItemBase(BaseModel):
    name: str
    qty: int
    inventory_id: int

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemResponse(InventoryItemBase, LoggingResponse):
    id: int
    
    class Config:
        from_attributes = True

InventoryItemBase.model_rebuild()
InventoryItemCreate.model_rebuild()
InventoryItemResponse.model_rebuild()

##############################################################
# Modello per la gestione del token di accesso
class Token(BaseModel):
    access_token: str
    token_type: str

# Modello per i dati del token
class TokenData(BaseModel):
    username: Optional[str] = None

Token.model_rebuild()
TokenData.model_rebuild()