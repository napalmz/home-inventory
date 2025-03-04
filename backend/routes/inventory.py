from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Inventory, SharedInventory
from schemas import InventoryCreate, InventoryResponse
from routes.auth import get_current_user
from models import User

router = APIRouter()

@router.post("/", response_model=InventoryResponse)
def create_inventory(inventory: InventoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    new_inventory = Inventory(name=inventory.name, owner_id=user.id)
    db.add(new_inventory)
    db.commit()
    db.refresh(new_inventory)
    return new_inventory

@router.get("/", response_model=list[InventoryResponse])
def list_inventories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Inventory).filter((Inventory.owner_id == user.id) |
                                      (Inventory.id == SharedInventory.inventory_id)).all()