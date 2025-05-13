from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from dependencies import get_db
from models import User, Inventory, Item, SharedInventory, Group, SharedInventoryGroup, RoleEnum
from schemas import InventoryCreate, InventoryResponse, InventoryUpdate, ItemResponse, UserResponse, InventoryResponseWithItemCount
from routes.auth import get_current_user
from typing import List
import re

#router = APIRouter()
inventory_router = APIRouter() # INVENTORY_TYPE = "INVENTORY"
checklist_router = APIRouter() # INVENTORY_TYPE = "CHECKLIST"

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
def list_inventories_base(
    inventory_type: str, 
    filtro: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventories = db.query(Inventory).filter(Inventory.type == inventory_type).options(joinedload(Inventory.items)).all()
    visible_inventories = [
        inv for inv in inventories if can_access_inventory(user, inv, action="view")
    ]

    def highlight_match(text: str, filtro: str) -> str:
        pattern = re.compile(re.escape(filtro), re.IGNORECASE)
        return pattern.sub(lambda m: f"**{m.group(0)}**", text)

    result = []
    filtro_lower = filtro.lower()
    for inv in visible_inventories:
        matching_items = []
        if filtro:
            matching_items = []
            for item in inv.items:
                name_match = filtro_lower in (item.name or "").lower()
                desc_match = filtro_lower in (item.description or "").lower() if item.description else False
                if name_match or desc_match:
                    # Evidenzia la parte corrispondente nel nome e nella descrizione (case-insensitive)
                    name_highlight = (item.name or "")
                    desc_highlight = (item.description or "") if item.description else None
                    if name_match:
                        name_highlight = highlight_match(name_highlight, filtro)
                    if desc_match and desc_highlight is not None:
                        desc_highlight = highlight_match(desc_highlight, filtro)
                    matching_items.append({
                        **ItemResponse(
                            **item.__dict__,
                            username_ins=item.user_ins_rel.username if item.user_ins_rel else None,
                            username_mod=item.user_mod_rel.username if item.user_mod_rel else None,
                        ).model_dump(),
                        "highlighted": {
                            "name": name_highlight,
                            "description": desc_highlight
                        }
                    })
            if not matching_items:
                continue  # Skip inventories that do not match the filter

        result.append({
            **InventoryResponseWithItemCount(
                **InventoryResponse.model_validate(inv).model_dump(),
                item_count=len(inv.items)
            ).model_dump(),
            "matching_items": matching_items if filtro else None
        })

    return result

# Creazione inventario
def create_inventory_base(
    inventory_type: str, 
    inventory: InventoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    new_inventory = Inventory(name=inventory.name, owner_id=user.id, type=inventory_type)
    db.add(new_inventory)
    db.commit()
    db.refresh(new_inventory)
    return InventoryResponse.model_validate(new_inventory)  # Converti il modello SQLAlchemy in Pydantic

# Aggiornamento inventario
def update_inventory_base(
    inventory_type: str, 
    inventory_id: int,
    update: InventoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    inventory.name = update.name
    db.commit()
    db.refresh(inventory)
    return InventoryResponse.model_validate(inventory)

# Eliminazione inventario
def delete_inventory_base(
    inventory_type: str, 
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="delete"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    db.delete(inventory)
    db.commit()
    return {"detail": "Inventario eliminato"}

#############################################################################
# Recupero item dell'inventario
def list_items_base(
    inventory_type: str,
    inventory_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    inventory = db.query(Inventory).options(
        joinedload(Inventory.items).joinedload(Item.user_ins_rel),
        joinedload(Inventory.items).joinedload(Item.user_mod_rel)
    ).filter_by(id=inventory_id, type=inventory_type).first()
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
def count_items_base(
    inventory_type: str,
    inventory_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    return len(inventory.items)

#############################################################################
# Condivisione inventario
def share_base(
    inventory_type: str,
    inventory_id: int,
    username: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
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
def unshare_base(
    inventory_type: str,
    inventory_id: int,
    username: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
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
def list_shares_base(
    inventory_type: str,
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
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
def share_with_group_base(
    inventory_type: str,
    inventory_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
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
def unshare_from_group_base(
    inventory_type: str,
    inventory_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
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
def list_group_shares_base(
    inventory_type: str,
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    return [share.group.name for share in inventory.shared_with_groups]

#############################################################################
# Elencare tutti gli utenti che hanno accesso a un inventario, con tipo di accesso e modalità
def list_access_details_base(
    inventory_type: str,
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
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
def count_access_by_type_base(
    inventory_type: str,
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter_by(id=inventory_id, type=inventory_type).first()
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

def get_by_id_base(
    inventory_type: str,
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).options(joinedload(Inventory.items)).filter_by(id=inventory_id, type=inventory_type).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    return InventoryResponseWithItemCount(
        **InventoryResponse.model_validate(inventory).model_dump(),
        item_count=len(inventory.items)
    )

#############################################################################
#############################################################################
#############################################################################
#############################################################################

#############################################################################
# Lista degli inventari visibili all'utente
@inventory_router.get("/", response_model=List[dict])
def list_inventories(
    filtro: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_inventories_base(
        inventory_type="INVENTORY",
        filtro=filtro,
        db=db,
        user=user
    )

# Lista delle checklist visibili all'utente
@checklist_router.get("/", response_model=List[dict])
def list_checklists(
    filtro: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_inventories_base(
        inventory_type="CHECKLIST",
        filtro=filtro,
        db=db,
        user=user
    )

#############################################################################
# Creazione inventario
@inventory_router.post("/", response_model=InventoryResponse)
def create_inventory(
    inventory: InventoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return create_inventory_base(
        inventory_type="INVENTORY",
        inventory=inventory,
        db=db,
        user=user
    )
# Creazione checklist
@checklist_router.post("/", response_model=InventoryResponse)
def create_checklist(
    inventory: InventoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return create_inventory_base(
        inventory_type="CHECKLIST",
        inventory=inventory,
        db=db,
        user=user
    )

#############################################################################
# Aggiornamento inventario
@inventory_router.patch("/{inventory_id}", response_model=InventoryResponse)
def update_inventory(
    inventory_id: int,
    update: InventoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return update_inventory_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        update=update,
        db=db,
        user=user
    )
# Aggiornamento checklist
@checklist_router.patch("/{inventory_id}", response_model=InventoryResponse)
def update_checklist(
    inventory_id: int,
    update: InventoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return update_inventory_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        update=update,
        db=db,
        user=user
    )

#############################################################################
# Eliminazione inventario
@inventory_router.delete("/{inventory_id}")
def delete_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return delete_inventory_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
# Eliminazione checklist
@checklist_router.delete("/{inventory_id}")
def delete_checklist(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return delete_inventory_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        db=db,
        user=user
    )

#############################################################################
# Recupero item dell'inventario
@inventory_router.get("/item/{inventory_id}/", response_model=List[ItemResponse])
def list_items(
    inventory_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return list_items_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
# Recupero item della checklist
@checklist_router.get("/item/{inventory_id}/", response_model=List[ItemResponse])
def list_checklist_items(
    inventory_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return list_items_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        db=db,
        user=user
    )

#############################################################################
# Contare gli item dell'inventario
@inventory_router.get("/count/{inventory_id}", response_model=int)
def count_inventory_items(
    inventory_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return count_items_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
# Contare gli item della checklist
@checklist_router.get("/count/{inventory_id}", response_model=int)
def count_checklist_items(
    inventory_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return count_items_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        db=db,
        user=user
    )

#############################################################################
# Condivisione inventario
@inventory_router.post("/share/{inventory_id}/{username}")
def share_inventory(
    inventory_id: int,
    username: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return share_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        username=username,
        db=db,
        user=user
    )
# Condivisione checklist
@checklist_router.post("/share/{inventory_id}/{username}")
def share_checklist(
    inventory_id: int,
    username: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return share_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        username=username,
        db=db,
        user=user
    )

#############################################################################
# Revoca condivisione inventario
@inventory_router.delete("/share/{inventory_id}/{username}")
def unshare_inventory(
    inventory_id: int,
    username: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return unshare_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        username=username,
        db=db,
        user=user
    )
# Revoca condivisione checklist
@checklist_router.delete("/share/{inventory_id}/{username}")
def unshare_checklist(
    inventory_id: int,
    username: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return unshare_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        username=username,
        db=db,
        user=user
    )

#############################################################################
# Lista utenti con cui è condiviso un inventario
@inventory_router.get("/share/{inventory_id}", response_model=List[UserResponse])
def list_inventory_shares(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_shares_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
# Lista utenti con cui è condivisa una checklist
@checklist_router.get("/share/{inventory_id}", response_model=List[UserResponse])
def list_checklist_shares(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_shares_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        db=db,
        user=user
    )

#############################################################################
# Condivisione con gruppo
@inventory_router.post("/share_group/{inventory_id}/{group_id}")
def share_inventory_with_group(
    inventory_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return share_with_group_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        group_id=group_id,
        db=db,
        user=user
    )
# Condivisione checklist con gruppo
@checklist_router.post("/share_group/{inventory_id}/{group_id}")
def share_checklist_with_group(
    inventory_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return share_with_group_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        group_id=group_id,
        db=db,
        user=user
    )
#############################################################################
# Revoca condivisione inventario da gruppo
@inventory_router.delete("/share_group/{inventory_id}/{group_id}")
def unshare_inventory_from_group(
    inventory_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return unshare_from_group_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        group_id=group_id,
        db=db,
        user=user
    )
# Revoca condivisione checklist da gruppo
@checklist_router.delete("/share_group/{inventory_id}/{group_id}")
def unshare_checklist_from_group(
    inventory_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return unshare_from_group_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        group_id=group_id,
        db=db,
        user=user
    )
#############################################################################
# Lista gruppi con cui è condiviso un inventario
@inventory_router.get("/share_group/{inventory_id}", response_model=List[str])
def list_inventory_group_shares(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_group_shares_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
# Lista gruppi con cui è condivisa una checklist
@checklist_router.get("/share_group/{inventory_id}", response_model=List[str])
def list_checklist_group_shares(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_group_shares_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        db=db,
        user=user
    )

#############################################################################
# Elencare tutti gli utenti che hanno accesso a un inventario, con tipo di accesso e modalità
@inventory_router.get("/access_details/{inventory_id}", response_model=List[dict])
def list_inventory_access_details(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_access_details_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
# Elencare tutti gli utenti che hanno accesso a una checklist, con tipo di accesso e modalità
@checklist_router.get("/access_details/{inventory_id}", response_model=List[dict])
def list_checklist_access_details(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_access_details_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        db=db,
        user=user
    )

#############################################################################
# Contare gli utenti che possono accedere all’inventario, raggruppati per accesso
@inventory_router.get("/access_count/{inventory_id}", response_model=dict)
def count_inventory_access_by_type(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return count_access_by_type_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
# Contare gli utenti che possono accedere alla checklist, raggruppati per accesso
@checklist_router.get("/access_count/{inventory_id}", response_model=dict)
def count_checklist_access_by_type(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return count_access_by_type_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        db=db,
        user=user
    )

#############################################################################
# Recupero inventario per ID
@inventory_router.get("/{inventory_id}", response_model=InventoryResponseWithItemCount)
def get_inventory_by_id(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return get_by_id_base(
        inventory_type="INVENTORY",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
# Recupero checklist per ID
@checklist_router.get("/{inventory_id}", response_model=InventoryResponseWithItemCount)
def get_checklist_by_id(
    inventory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return get_by_id_base(
        inventory_type="CHECKLIST",
        inventory_id=inventory_id,
        db=db,
        user=user
    )
#############################################################################
