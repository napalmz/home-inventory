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
    email: Optional[str] = None  # ✅ Aggiunto campo email

class UserCreate(UserBase):
    password: str  # La password non viene restituita nelle risposte

class UserUpdate(UserBase):
    is_blocked: Optional[bool] = None  # ✅ Permette di aggiornare lo stato bloccato
    role_id: int

class UserResponse(UserBase, LoggingResponse):
    id: int
    role: 'RoleResponse'
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

class InventoryUpdate(InventoryBase):
    pass

class InventoryResponse(InventoryBase, LoggingResponse):
    id: int
    owner: 'UserResponse'  # Riferimento all'utente proprietario
    
    class Config:
        from_attributes = True

class InventoryResponseWithItemCount(InventoryResponse):
    item_count: int

InventoryBase.model_rebuild()
InventoryCreate.model_rebuild()
InventoryUpdate.model_rebuild()
InventoryResponse.model_rebuild()
InventoryResponseWithItemCount.model_rebuild()

################################################
# Modello per gli elementi di un inventario
class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    quantity: int
    inventory_id: int

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    name: Optional[str]
    description: Optional[str]
    quantity: Optional[int]
    inventory_id: Optional[int]

class ItemDelete(BaseModel):
    confirm: bool

class ItemResponse(ItemBase, LoggingResponse):
    id: int
    
    class Config:
        from_attributes = True

ItemBase.model_rebuild()
ItemCreate.model_rebuild()
ItemUpdate.model_rebuild()
ItemDelete.model_rebuild()
ItemResponse.model_rebuild()

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

##############################################################
class InventoryShareRequest(BaseModel):
    group_ids: List[int]

InventoryShareRequest.model_rebuild()