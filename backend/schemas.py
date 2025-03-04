from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str

class InventoryCreate(BaseModel):
    name: str

class InventoryResponse(BaseModel):
    id: int
    name: str
    owner_id: int

class Token(BaseModel):
    access_token: str
    token_type: str