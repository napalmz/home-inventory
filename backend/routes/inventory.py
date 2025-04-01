from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from dependencies import get_db
from models import User, Inventory, SharedInventory
from schemas import InventoryCreate, InventoryResponse
from routes.auth import get_current_user

router = APIRouter()

@router.post("/", response_model=InventoryResponse)
def create_inventory(
    inventory: InventoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    new_inventory = Inventory(name=inventory.name, owner_id=user.id)
    db.add(new_inventory)
    db.commit()
    db.refresh(new_inventory)
    #return new_inventory
    return InventoryResponse.model_validate(new_inventory)  # Converti il modello SQLAlchemy in Pydantic

@router.get("/", response_model=list[InventoryResponse])
def list_inventories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    #return db.query(Inventory).filter((Inventory.owner_id == user.id) | (Inventory.id == SharedInventory.inventory_id)).all()
    inventories = db.query(Inventory).filter((Inventory.owner_id == user.id) |
                                             (Inventory.id == SharedInventory.inventory_id)).all()
    return [InventoryResponse.model_validate(inv) for inv in inventories]  # ✅ Converti SQLAlchemy → Pydantic