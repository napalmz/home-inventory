from typing import List, Optional
from pydantic import BaseModel

# Modello per la creazione di un nuovo utente
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

# Modello per la visualizzazione delle informazioni dell'utente
class User(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

# Modello per la creazione di un nuovo gruppo
class GroupCreate(BaseModel):
    name: str

class GroupResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

# Modello per la visualizzazione delle informazioni del gruppo
class Group(BaseModel):
    id: int
    name: str
    users: List[User] = []

    class Config:
        from_attributes = True

# Modello per la creazione di un nuovo inventario
class InventoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class InventoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int

    class Config:
        from_attributes = True

# Modello per la visualizzazione delle informazioni dell'inventario
class Inventory(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int

    class Config:
        from_attributes = True

# Modello per la creazione di un nuovo item
class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    quantity: int

# Modello per la visualizzazione delle informazioni dell'item
class Item(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    quantity: int
    inventory_id: int

    class Config:
        from_attributes = True

# Modello per la gestione del token di accesso
class Token(BaseModel):
    access_token: str
    token_type: str

# Modello per i dati del token
class TokenData(BaseModel):
    username: Optional[str] = None

# Modello per la creazione di un nuovo ruolo
class RoleCreate(BaseModel):
    name: str

class RoleResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

# Modello per la visualizzazione delle informazioni dei ruoli
class Role(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True