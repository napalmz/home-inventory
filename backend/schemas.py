from __future__ import annotations  # Necessario per risolvere ForwardRef automaticamente
from typing import List, Optional
from pydantic import BaseModel

##############################################################
# Modello per la creazione di un nuovo utente
class UserCreate(BaseModel):
    username: str
    password: str

# Modello per la visualizzazione delle informazioni dell'utente
class User(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

User.model_rebuild()  # ✅ Ricostruisce il modello

##############################################################
# Modello per la creazione di un nuovo gruppo
class GroupCreate(BaseModel):
    name: str

# Modello per la visualizzazione delle informazioni del gruppo
class Group(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

Group.model_rebuild()  # ✅ Ricostruisce il modello

##############################################################
# Modello per la creazione di un nuovo inventario
class InventoryCreate(BaseModel):
    name: str

# Modello per la visualizzazione delle informazioni dell'inventario
class Inventory(BaseModel):
    id: int
    name: str
    owner: "User"  # ✅ Usa una stringa per evitare errori di ForwardRef

    class Config:
        from_attributes = True

Inventory.model_rebuild()  # ✅ Ricostruisce il modello

class InventoryResponse(Inventory):
    id: int
    name: str
    owner: "User"  # ✅ Usa una stringa per evitare errori di ForwardRef

    class Config:
        from_attributes = True

InventoryResponse.model_rebuild()  # ✅ Ricostruisce il modello

##############################################################
# Modello per la creazione di un nuovo item
class ItemCreate(BaseModel):
    name: str
    qty: int

# Modello per la visualizzazione delle informazioni dell'item
class Item(BaseModel):
    id: int
    name: str
    qty: int
    inventory_id: int

    class Config:
        from_attributes = True

Item.model_rebuild()  # ✅ Ricostruisce il modello

##############################################################
# Modello per la gestione del token di accesso
class Token(BaseModel):
    access_token: str
    token_type: str

# Modello per i dati del token
class TokenData(BaseModel):
    username: Optional[str] = None

##############################################################
# Modello per la creazione di un nuovo ruolo
class RoleCreate(BaseModel):
    name: str

# Modello per la visualizzazione delle informazioni dei ruoli
class Role(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

Role.model_rebuild()  # ✅ Ricostruisce il modello