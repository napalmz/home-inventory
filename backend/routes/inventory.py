from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from dependencies import get_db
from models import User, Inventory, Item, SharedInventory, Group, SharedInventoryGroup, RoleEnum
from schemas import InventoryCreate, InventoryResponse, InventoryUpdate, ItemResponse, UserResponse, InventoryResponseWithItemCount
from routes.auth import get_current_user
from typing import List

router = APIRouter()

# Funzione per verificare se l'utente ha accesso all'inventario
def can_access_inventory(user: User, inventory: Inventory, action: str = "view") -> bool:
    # Admin ha sempre accesso
    if user.role.name == RoleEnum.admin.value:
        return True

    if action == "view":
        # Chiunque può vedere se è condiviso o è il proprietario
        if inventory.owner_id == user.id:
            return True
        if user.id in [s.user_id for s in inventory.shared_with_users]:
            return True
        user_group_ids = {assoc.group_id for assoc in user.group_associations}
        inventory_group_ids = {g.group_id for g in inventory.shared_with_groups}
        if user_group_ids & inventory_group_ids:
            return True
    elif action in ("edit", "delete"):
        # Moderatori possono modificare/eliminare solo se è proprio o condiviso con loro
        if user.role.name == RoleEnum.moderator.value:
            if inventory.owner_id == user.id:
                return True
            if user.id in [s.user_id for s in inventory.shared_with_users]:
                return True
            user_group_ids = {assoc.group_id for assoc in user.group_associations}
            inventory_group_ids = {g.group_id for g in inventory.shared_with_groups}
            if user_group_ids & inventory_group_ids:
                return True

    return False

#############################################################################
# Lista degli inventari visibili all'utente
@router.get("/", response_model=list[InventoryResponseWithItemCount])
def list_inventories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventories = db.query(Inventory).options(joinedload(Inventory.items)).all()
    visible_inventories = [
        inv for inv in inventories if can_access_inventory(user, inv, action="view")
    ]
    return [
        InventoryResponseWithItemCount(
            **InventoryResponse.model_validate(inv).model_dump(),
            item_count=len(inv.items)
        )
        for inv in visible_inventories
    ]

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
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="edit"):
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
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="delete"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    db.delete(inventory)
    db.commit()
    return {"detail": "Inventario eliminato"}

#############################################################################
# Recupero item dell'inventario
@router.get("/item/{inventory_id}/", response_model=List[ItemResponse])
def list_items(inventory_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    inventory = db.query(Inventory).options(
        joinedload(Inventory.items).joinedload(Item.user_ins_rel),
        joinedload(Inventory.items).joinedload(Item.user_mod_rel)
    ).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    #return inventory.items
    return [
        ItemResponse(
            **item.__dict__,
            username_ins=item.user_ins_rel.username if item.user_ins_rel else None,
            username_mod=item.user_mod_rel.username if item.user_mod_rel else None,
        )
        for item in inventory.items
    ]

# Contare gli item dell'inventario
@router.get("/count/{inventory_id}", response_model=int)
def count_items(inventory_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    return len(inventory.items)

#############################################################################
# Condivisione inventario
@router.post("/share/{inventory_id}/{username}")
def share_inventory(
    inventory_id: int,
    username: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    target_user = db.query(User).filter(User.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utente da condividere non trovato")

    # Verifica condivisione diretta
    existing = db.query(SharedInventory).filter_by(user_id=target_user.id, inventory_id=inventory_id).first()
    if existing:
        return {"detail": "Inventario già condiviso direttamente con questo utente"}

    # Verifica condivisione tramite gruppo
    user_group_ids = [assoc.group_id for assoc in target_user.group_associations]
    group_shares = db.query(SharedInventoryGroup).filter(
        SharedInventoryGroup.inventory_id == inventory_id,
        SharedInventoryGroup.group_id.in_(user_group_ids)
    ).first()
    if group_shares:
        return {"detail": "Inventario già accessibile tramite gruppo dell'utente"}

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
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

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
@router.get("/share/{inventory_id}", response_model=List[UserResponse])
def list_inventory_shares(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    return [
        db.query(User).get(share.user_id)
        for share in inventory.shared_with_users
    ]

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
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

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
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

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
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    return [share.group.name for share in inventory.shared_with_groups]

#############################################################################
# Elencare tutti gli utenti che hanno accesso a un inventario, con tipo di accesso e modalità
@router.get("/access_details/{inventory_id}", response_model=List[dict])
def list_inventory_access_details(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    access_details = []

    # Utente proprietario
    owner = db.query(User).get(inventory.owner_id)
    access_details.append({
        "username": owner.username,
        "access": "edit",
        "via": "owner",
        "group": None
    })

    # Amministratori
    admins = db.query(User).filter(User.role.has(name=RoleEnum.admin.value)).all()
    for admin in admins:
        if admin.id != inventory.owner_id:
            access_details.append({
                "username": admin.username,
                "access": "edit",
                "via": "admin",
                "group": None
            })

    # Utenti condivisione diretta
    for share in inventory.shared_with_users:
        user = db.query(User).get(share.user_id)
        access = "edit" if user.role.name in (RoleEnum.admin.value, RoleEnum.moderator.value) else "view"
        access_details.append({
            "username": user.username,
            "access": access,
            "via": "share",
            "group": None
        })

    # Utenti condivisione tramite gruppo
    for shared_group in inventory.shared_with_groups:
        group = db.query(Group).get(shared_group.group_id)
        for assoc in group.user_associations:
            access = "edit" if assoc.user.role.name in (RoleEnum.admin.value, RoleEnum.moderator.value) else "view"
            access_details.append({
                "username": assoc.user.username,
                "access": access,
                "via": "group",
                "group": group.name
            })

    return access_details

#############################################################################
# Contare gli utenti che possono accedere all’inventario, raggruppati per accesso
@router.get("/access_count/{inventory_id}", response_model=dict)
def count_inventory_access_by_type(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    access_by_user = {}

    # Owner
    owner = db.query(User).get(inventory.owner_id)
    access_by_user[owner.username] = "edit"

    # Admin (aggiunti solo se non già presenti)
    admins = db.query(User).filter(User.role.has(name=RoleEnum.admin.value)).all()
    for admin in admins:
        if admin.username not in access_by_user:
            access_by_user[admin.username] = "admin"

    # Dirette
    for share in inventory.shared_with_users:
        user = db.query(User).get(share.user_id)
        access = "edit" if user.role.name in (RoleEnum.admin.value, RoleEnum.moderator.value) else "view"
        access_by_user[user.username] = access

    # Gruppi
    for shared_group in inventory.shared_with_groups:
        group = db.query(Group).get(shared_group.group_id)
        for assoc in group.user_associations:
            access = "edit" if assoc.user.role.name in (RoleEnum.admin.value, RoleEnum.moderator.value) else "view"
            # Se già presente come 'edit' non sovrascrivere
            if assoc.user.username not in access_by_user or access_by_user[assoc.user.username] != "edit":
                access_by_user[assoc.user.username] = access

    # Conta
    view_count = sum(1 for access in access_by_user.values() if access == "view")
    edit_count = sum(1 for access in access_by_user.values() if access == "edit")
    admin_count = sum(1 for access in access_by_user.values() if access == "admin")

    return {"view": view_count, "edit": edit_count, "admin": admin_count}

@router.get("/{inventory_id}", response_model=InventoryResponseWithItemCount)
def get_inventory_by_id(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).options(joinedload(Inventory.items)).get(inventory_id)
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    return InventoryResponseWithItemCount(
        **InventoryResponse.model_validate(inventory).model_dump(),
        item_count=len(inventory.items)
    )