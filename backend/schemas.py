from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel

################################################
# Modello per i ruoli
class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class RoleResponse(RoleBase):
    id: int
    
    class Config:
        from_attributes = True

RoleResponse.model_rebuild()

################################################
# Modello per gli utenti
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str  # La password non viene restituita nelle risposte

class UserResponse(UserBase):
    id: int
    role: Optional[RoleResponse]
    
    class Config:
        from_attributes = True

UserResponse.model_rebuild()

################################################
# Modello per i gruppi
class GroupBase(BaseModel):
    name: str

class GroupCreate(GroupBase):
    pass

class GroupResponse(GroupBase):
    id: int
    users: List[UserResponse] = []
    
    class Config:
        from_attributes = True

GroupResponse.model_rebuild()

################################################
# Modello per la creazione e risposta di un inventario
class InventoryBase(BaseModel):
    name: str

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: int
    owner: UserResponse  # Riferimento all'utente proprietario
    
    class Config:
        from_attributes = True

InventoryResponse.model_rebuild()

################################################
# Modello per gli elementi di un inventario
class InventoryItemBase(BaseModel):
    name: str
    quantity: int

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemResponse(InventoryItemBase):
    id: int
    inventory_id: int
    
    class Config:
        from_attributes = True

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