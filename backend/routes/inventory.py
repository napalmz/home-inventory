from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from dependencies import get_db
from models import User, Inventory, SharedInventory, Group, SharedInventoryGroup
from schemas import InventoryCreate, InventoryResponse, InventoryUpdate, ItemResponse, InventoryShareRequest
from routes.auth import get_current_user
from typing import List

router = APIRouter()

#############################################################################
# Lista degli inventari visibili all'utente
@router.get("/", response_model=list[InventoryResponse])
def list_inventories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    owned  = db.query(Inventory).filter(Inventory.owner_id == user.id)
    shared = db.query(Inventory).join(SharedInventory).filter(SharedInventory.user_id == user.id)
    inventories = owned.union(shared).all()
    return [InventoryResponse.model_validate(inv) for inv in inventories]  # ✅ Converti SQLAlchemy → Pydantic

# Creazione inventario
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
    return InventoryResponse.model_validate(new_inventory)  # Converti il modello SQLAlchemy in Pydantic

# Aggiornamento inventario
@router.patch("/{inventory_id}", response_model=InventoryResponse)
def update_inventory(
    inventory_id: int,
    update: InventoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).options(joinedload(Inventory.shared_with)).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id and user.id not in [s.user_id for s in inventory.shared_with]:
        raise HTTPException(status_code=403, detail="Accesso negato")

    inventory.name = update.name
    db.commit()
    db.refresh(inventory)
    return InventoryResponse.model_validate(inventory)

# Eliminazione inventario
@router.delete("/{inventory_id}")
def delete_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).options(joinedload(Inventory.shared_with)).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id and user.id not in [s.user_id for s in inventory.shared_with]:
        raise HTTPException(status_code=403, detail="Accesso negato")

    db.delete(inventory)
    db.commit()
    return {"detail": "Inventario eliminato"}

#############################################################################
# Recupero item dell'inventario
@router.get("/item/{inventory_id}/", response_model=List[ItemResponse])
def list_items(inventory_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    inventory = db.query(Inventory).options(joinedload(Inventory.shared_with)).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id and user.id not in [s.user_id for s in inventory.shared_with]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    return inventory.items

# Contare gli item dell'inventario
@router.get("/count/{inventory_id}", response_model=int)
def count_items(inventory_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    inventory = db.query(Inventory).options(joinedload(Inventory.shared_with)).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id and user.id not in [s.user_id for s in inventory.shared_with]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    return len(inventory.items)

#############################################################################
# Condivisione inventario
@router.post("/share/{inventory_id}")
def share_inventory(
    inventory_id: int,
    request: InventoryShareRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Solo il proprietario può condividere l'inventario")

    target_user = db.query(User).filter(User.username == request.username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utente da condividere non trovato")

    existing = db.query(SharedInventory).filter_by(user_id=target_user.id, inventory_id=inventory_id).first()
    if existing:
        return {"detail": "Inventario già condiviso con questo utente"}

    shared = SharedInventory(user_id=target_user.id, inventory_id=inventory_id)
    db.add(shared)
    db.commit()
    return {"detail": f"Inventario condiviso con {target_user.username}"}

# Revoca condivisione inventario
@router.delete("/share/{inventory_id}/{username}")
def unshare_inventory(
    inventory_id: int,
    username: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Solo il proprietario può revocare la condivisione")

    target_user = db.query(User).filter(User.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    shared = db.query(SharedInventory).filter_by(user_id=target_user.id, inventory_id=inventory_id).first()
    if not shared:
        raise HTTPException(status_code=404, detail="Condivisione non trovata")

    db.delete(shared)
    db.commit()
    return {"detail": f"Condivisione revocata per {username}"}

# Lista utenti con cui è condiviso un inventario
@router.get("/share/{inventory_id}", response_model=List[str])
def list_inventory_shares(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).options(joinedload(Inventory.shared_with).joinedload(SharedInventory.user)).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Solo il proprietario può vedere le condivisioni")

    return [share.user.username for share in inventory.shared_with]

#############################################################################
# Condivisione con gruppo
@router.post("/share_group/{inventory_id}/{group_id}")
def share_inventory_with_group(
    inventory_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Solo il proprietario può condividere l'inventario")

    group = db.query(Group).get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")

    existing = db.query(SharedInventoryGroup).filter_by(group_id=group_id, inventory_id=inventory_id).first()
    if existing:
        return {"detail": "Inventario già condiviso con questo gruppo"}

    shared = SharedInventoryGroup(group_id=group_id, inventory_id=inventory_id)
    db.add(shared)
    db.commit()
    return {"detail": f"Inventario condiviso con il gruppo '{group.name}'"}

# Revoca condivisione da gruppo
@router.delete("/share_group/{inventory_id}/{group_id}")
def unshare_inventory_from_group(
    inventory_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Solo il proprietario può revocare la condivisione")

    shared = db.query(SharedInventoryGroup).filter_by(group_id=group_id, inventory_id=inventory_id).first()
    if not shared:
        raise HTTPException(status_code=404, detail="Condivisione non trovata")

    db.delete(shared)
    db.commit()
    return {"detail": "Condivisione con gruppo revocata"}

# Lista gruppi con cui è condiviso un inventario
@router.get("/share_group/{inventory_id}", response_model=List[str])
def list_inventory_group_shares(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).options(joinedload(Inventory.shared_with_groups).joinedload(SharedInventoryGroup.group)).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if inventory.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Solo il proprietario può vedere le condivisioni")

    return [share.group.name for share in inventory.shared_with_groups]