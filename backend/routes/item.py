import json
from typing import Any, List, cast
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from models import User, Item, Inventory, ItemVersion
from dependencies import get_db
from schemas import ItemCreate, ItemUpdate, ItemDelete, ItemResponse, ItemVersionResponse, VersionBulkDeleteRequest
from routes.auth import get_current_user
from routes.inventory import can_access_inventory
from fastapi import status
from datetime import datetime, timezone, timedelta

router = APIRouter()
QUANTITY_MERGE_WINDOW_SECONDS = 45


def _utc_now_naive() -> datetime:
    # Usiamo UTC naive in modo coerente con i campi datetime senza timezone nel DB.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)

# Funzione per verificare se l'utente ha accesso a un item
def can_access_item(user: User, item: Item, action: str = "view") -> bool:
    if not item.inventory:
        return False
    return can_access_inventory(user, item.inventory, action)

# ---------------------------------------------------------------------------
# Helpers per la versioning degli item
# ---------------------------------------------------------------------------
def _snapshot_item(item: Item) -> dict:
    return {
        "name": item.name,
        "description": item.description,
        "quantity": item.quantity,
        "inventory_id": item.inventory_id,
    }

def _next_item_version_num(db: Session, item_id: int) -> int:
    last = db.query(func.max(ItemVersion.version_num)).filter(
        ItemVersion.item_id == item_id
    ).scalar()
    return (last or 0) + 1

def _write_item_version(
    db: Session,
    item: Item,
    operation: str,
    user: User,
    old_snapshot: dict[str, Any] | None = None,
    merge_quantity_updates: bool = True,
) -> None:
    diff: dict = {}
    new_snapshot = None
    if old_snapshot and operation == "UPDATE":
        new_snapshot = _snapshot_item(item)
        for key, new_val in new_snapshot.items():
            old_val = old_snapshot.get(key)
            if old_val != new_val:
                diff[key] = {"from": old_val, "to": new_val}

        # Evita versioni vuote quando non cambia nulla
        if not diff:
            return

        # Accorpa aggiornamenti consecutivi di sola quantita in una sola versione
        # (stesso item, stesso utente, finestra temporale breve)
        if merge_quantity_updates and set(diff.keys()) == {"quantity"}:
            item_id = cast(int, item.id)
            last_version = (
                db.query(ItemVersion)
                .filter(ItemVersion.item_id == item_id)
                .order_by(ItemVersion.version_num.desc())
                .first()
            )

            if not last_version:
                last_changed_at = None
                last_operation = None
                last_changed_by_id = None
                last_diff_raw = None
            else:
                raw_changed_at = cast(datetime | None, last_version.changed_at)
                last_changed_at = _to_utc_naive(raw_changed_at) if raw_changed_at else None
                last_operation = cast(str, last_version.operation)
                last_changed_by_id = cast(int | None, last_version.changed_by_id)
                last_diff_raw = cast(str | None, last_version.diff)

            if (
                last_version
                and last_operation == "UPDATE"
                and last_changed_by_id == user.id
                and last_changed_at is not None
                and last_changed_at >= _utc_now_naive() - timedelta(seconds=QUANTITY_MERGE_WINDOW_SECONDS)
            ):
                try:
                    previous_diff = json.loads(last_diff_raw) if last_diff_raw else {}
                except Exception:
                    previous_diff = {}

                # Accorpa solo se anche la versione precedente era di sola quantita
                if set(previous_diff.keys()) == {"quantity"}:
                    qty_from = previous_diff.get("quantity", {}).get("from", old_snapshot.get("quantity"))
                    qty_to = new_snapshot.get("quantity")

                    # Se qty_from == qty_to, le modifiche si annullano: non registrare nulla
                    # MA solo se siamo ancora entro la finestra di merge (doppio check per sicurezza)
                    if qty_from == qty_to:
                        # Verifica ancora che siamo dentro la finestra (re-check per edge cases)
                        time_since_last = (_utc_now_naive() - last_changed_at).total_seconds()
                        if time_since_last <= QUANTITY_MERGE_WINDOW_SECONDS:
                            # Rimuovi la versione precedente dal db poiché è stata annullata
                            db.delete(last_version)
                            return
                        # Se siamo fuori della finestra, non cancellare: crea una nuova versione

                    setattr(last_version, "name", item.name)
                    setattr(last_version, "description", item.description)
                    setattr(last_version, "quantity", item.quantity)
                    setattr(last_version, "inventory_id", item.inventory_id)
                    setattr(last_version, "changed_at", _utc_now_naive())
                    setattr(last_version, "changed_by_username", user.username)
                    setattr(last_version, "diff", json.dumps({"quantity": {"from": qty_from, "to": qty_to}}))
                    return

    item_id = cast(int, item.id)
    inventory_id = cast(int, item.inventory_id)
    version = ItemVersion(
        item_id=item_id,
        inventory_id=inventory_id,
        name=item.name,
        description=item.description,
        quantity=item.quantity,
        version_num=_next_item_version_num(db, item_id),
        operation=operation,
        changed_at=_utc_now_naive(),
        changed_by_id=user.id,
        changed_by_username=user.username,
        diff=json.dumps(diff) if diff else None,
    )
    db.add(version)

def _build_item_response(db: Session, item: Item) -> ItemResponse:
    current_version = db.query(func.max(ItemVersion.version_num)).filter(
        ItemVersion.item_id == item.id
    ).scalar() or 0
    return ItemResponse(
        **item.__dict__,
        username_ins=item.user_ins_rel.username if item.user_ins_rel else None,
        username_mod=item.user_mod_rel.username if item.user_mod_rel else None,
        version_num=current_version,
    )

#############################################################################
# Visualizzazione item
@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item non trovato")
    if not can_access_item(user, item, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    return _build_item_response(db, item)

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
    db_item.user_mod = user.id
    db.add(db_item)
    db.flush()                                   # ottieni db_item.id senza commit
    _write_item_version(db, db_item, "CREATE", user)
    db.commit()
    db.refresh(db_item)
    inventory.data_mod = datetime.now(timezone.utc)
    inventory.user_mod = user.id
    db.commit()
    return _build_item_response(db, db_item)

#############################################################################
# Aggiornamento item
@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, item_update: ItemUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item non trovato")
    if not can_access_item(user, item, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    old_snapshot = _snapshot_item(item)         # cattura stato precedente
    for field, value in item_update.model_dump(exclude_unset=True).items():
        if field in ("quantity") and value is not None:
            if isinstance(value, (int, float)) and value < 0:
                raise HTTPException(status_code=400, detail=f"{field} non può essere negativo")
        setattr(item, field, value)
    item.user_mod = user.id
    _write_item_version(db, item, "UPDATE", user, old_snapshot)
    db.commit()
    db.refresh(item)
    item.inventory.data_mod = datetime.now(timezone.utc)
    item.inventory.user_mod = user.id
    db.commit()
    return _build_item_response(db, item)

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
    _write_item_version(db, item, "DELETE", user)   # registra prima della delete
    item.inventory.data_mod = datetime.now(timezone.utc)
    item.inventory.user_mod = user.id
    db.delete(item)
    db.commit()
    return {"detail": "Item eliminato"}

#############################################################################
# Cronologia versioni item
@router.get("/{item_id}/history", response_model=List[ItemVersionResponse])
def get_item_history(item_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Se l'item esiste ancora, verifica i permessi
    item = db.query(Item).get(item_id)
    if item:
        if not can_access_item(user, item, action="view"):
            raise HTTPException(status_code=403, detail="Accesso negato")
    else:
        # Se l'item è stato cancellato, prova a validare accesso tramite inventario d'origine
        latest = (
            db.query(ItemVersion)
            .filter(ItemVersion.item_id == item_id)
            .order_by(ItemVersion.version_num.desc())
            .first()
        )
        if latest:
            source_inventory = db.query(Inventory).filter(Inventory.id == latest.inventory_id).first()
            if source_inventory and not can_access_inventory(user, source_inventory, action="view"):
                raise HTTPException(status_code=403, detail="Accesso negato")
            # Se l'inventario non esiste più, limitiamo la visibilità agli admin
            if not source_inventory and user.role.name != "admin":
                raise HTTPException(status_code=403, detail="Accesso negato")

    versions = (
        db.query(ItemVersion)
        .filter(ItemVersion.item_id == item_id)
        .order_by(ItemVersion.version_num.asc())
        .all()
    )
    return versions

#############################################################################
# Rollback a una versione precedente
@router.post("/{item_id}/rollback/{version_num}", response_model=ItemResponse)
def rollback_item(
    item_id: int,
    version_num: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    target = db.query(ItemVersion).filter(
        ItemVersion.item_id == item_id,
        ItemVersion.version_num == version_num,
    ).first()
    if not target or cast(str, target.operation) == "DELETE":
        raise HTTPException(status_code=400, detail="Versione non valida per il rollback")

    item = db.query(Item).get(item_id)

    # Ripristino di item cancellato: ricreazione dal snapshot della versione
    if not item:
        parent_inventory = db.query(Inventory).filter(Inventory.id == target.inventory_id).first()
        if not parent_inventory:
            raise HTTPException(status_code=404, detail="Inventario origine non trovato: ripristina prima l'inventario")
        if not can_access_inventory(user, parent_inventory, action="edit"):
            raise HTTPException(status_code=403, detail="Accesso negato")

        restored_item = Item(
            id=item_id,
            name=target.name,
            description=target.description,
            quantity=target.quantity,
            inventory_id=target.inventory_id,
            user_ins=user.id,
            user_mod=user.id,
        )
        db.add(restored_item)
        db.flush()
        _write_item_version(db, restored_item, "CREATE", user)
        db.commit()
        db.refresh(restored_item)
        return _build_item_response(db, restored_item)

    if not can_access_item(user, item, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    old_snapshot = _snapshot_item(item)
    item.name = target.name
    item.description = target.description
    item.quantity = target.quantity
    item.user_mod = user.id
    _write_item_version(db, item, "UPDATE", user, old_snapshot, merge_quantity_updates=False)
    db.commit()
    db.refresh(item)
    return _build_item_response(db, item)

#############################################################################
# Pulizia cronologia versioni item (solo admin)
@router.delete("/{item_id}/history/{version_num}")
def delete_item_history_version(
    item_id: int,
    version_num: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Solo admin può cancellare versioni")

    deleted = (
        db.query(ItemVersion)
        .filter(ItemVersion.item_id == item_id, ItemVersion.version_num == version_num)
        .delete(synchronize_session=False)
    )
    db.commit()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Versione non trovata")
    return {"detail": "Versione eliminata", "deleted": deleted}


@router.post("/{item_id}/history/delete")
def delete_item_history_versions(
    item_id: int,
    payload: VersionBulkDeleteRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Solo admin può cancellare versioni")
    if not payload.version_nums:
        raise HTTPException(status_code=400, detail="Nessuna versione selezionata")

    deleted = (
        db.query(ItemVersion)
        .filter(ItemVersion.item_id == item_id, ItemVersion.version_num.in_(payload.version_nums))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"detail": "Pulizia cronologia completata", "deleted": deleted}