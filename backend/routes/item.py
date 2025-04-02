from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from models import Item, Inventory
from dependencies import get_db
from schemas import ItemCreate, ItemUpdate, ItemDelete, ItemResponse
from routes.auth import get_current_user
from fastapi import status

#router = APIRouter(prefix="/item", tags=["item"])
router = APIRouter()

# Creazione item
@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(item: ItemCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    #inventory = db.query(Inventory).filter(Inventory.id == item.inventory_id).first()
    inventory = db.query(Inventory).options(joinedload(Inventory.shared_with)).filter(Inventory.id == item.inventory_id).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    #if inventory.owner_id != user.id:
    if inventory.owner_id != user.id and user.id not in [s.user_id for s in inventory.shared_with]:
        raise HTTPException(status_code=403, detail="Non sei il proprietario dell'inventario")
    db_item = Item(**item.model_dump())
    db_item.user_ins = user.id
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# Lista degli item visibili all'utente
@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item non trovato")
    #if item.inventory.owner_id != user.id:
    if item.inventory.owner_id != user.id and user.id not in [s.user_id for s in item.inventory.shared_with]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    return item

# Aggiornamento item
@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, item_update: ItemUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item non trovato")
    #if item.inventory.owner_id != user.id:
    if item.inventory.owner_id != user.id and user.id not in [s.user_id for s in item.inventory.shared_with]:
        raise HTTPException(status_code=403, detail="Accesso negato")

    for field, value in item_update.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.user_mod = user.id
    db.commit()
    db.refresh(item)
    return item

# Eliminazione item
@router.delete("/{item_id}")
def delete_item(item_id: int, delete: ItemDelete, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not delete.confirm:
        raise HTTPException(status_code=400, detail="Cancellazione non confermata")
    item = db.query(Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item non trovato")
    #if item.inventory.owner_id != user.id:
    if item.inventory.owner_id != user.id and user.id not in [s.user_id for s in item.inventory.shared_with]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    db.delete(item)
    db.commit()
    return {"detail": "Item eliminato"}