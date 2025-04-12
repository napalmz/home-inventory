from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from models import User, Item, Inventory
from dependencies import get_db
from schemas import ItemCreate, ItemUpdate, ItemDelete, ItemResponse
from routes.auth import get_current_user
from routes.inventory import can_access_inventory
from fastapi import status
from datetime import datetime, timezone

router = APIRouter()

# Funzione per verificare se l'utente ha accesso a un item
def can_access_item(user: User, item: Item, action: str = "view") -> bool:
    if not item.inventory:
        return False
    return can_access_inventory(user, item.inventory, action)

#############################################################################
# Visualizzazione item
@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item non trovato")
    if not can_access_item(user, item, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    return item

#############################################################################
# Creazione item
@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(item: ItemCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    inventory = db.query(Inventory).filter(Inventory.id == item.inventory_id).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    db_item = Item(**item.model_dump())
    db_item.user_ins = user.id
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    inventory.data_mod = datetime.now(timezone.utc)
    inventory.user_mod = user.id
    db.commit()
    return db_item

#############################################################################
# Aggiornamento item
@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, item_update: ItemUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item non trovato")
    if not can_access_item(user, item, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    for field, value in item_update.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.user_mod = user.id
    db.commit()
    db.refresh(item)
    item.inventory.data_mod = datetime.now(timezone.utc)
    db.commit()
    return item

#############################################################################
# Eliminazione item
@router.delete("/{item_id}")
def delete_item(item_id: int, delete: ItemDelete, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not delete.confirm:
        raise HTTPException(status_code=400, detail="Cancellazione non confermata")
    item = db.query(Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item non trovato")
    if not can_access_item(user, item, action="delete"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    item.inventory.data_mod = datetime.now(timezone.utc)
    db.delete(item)
    db.commit()
    return {"detail": "Item eliminato"}