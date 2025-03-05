from pydantic import BaseModel
from typing import Optional, List

class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class RoleResponse(RoleBase):
    id: int

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    role_id: Optional[int]

    class Config:
        from_attributes = True

class GroupBase(BaseModel):
    name: str

class GroupCreate(GroupBase):
    role_id: int

class GroupResponse(GroupBase):
    id: int
    role_id: int
    users: List[UserResponse] = []

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class InventoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class InventoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        orm_mode = True