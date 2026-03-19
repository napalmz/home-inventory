"""
Route centralizzato per audit log e query storiche
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, false, func
from datetime import datetime, timezone
from models import ItemVersion, InventoryVersion, User, Inventory
from schemas import ItemVersionResponse, InventoryVersionResponse
from routes.auth import get_current_user
from dependencies import get_db
from typing import List, Optional, cast

router = APIRouter()

#############################################################################
# Query audit centralizzate (sola lettura)
#############################################################################

@router.get("/logs/items", response_model=List[ItemVersionResponse])
def get_item_audit_logs(
    inventory_id: Optional[int] = None,
    user_id: Optional[int] = None,
    user_scope: Optional[str] = None,
    operation: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recupera i log di audit degli item filtrati.
    Solo admin può vedere tutti i log; gli altri vedono solo i log dei loro inventari.
    """
    query = db.query(ItemVersion)

    # Filtri opzionali
    if inventory_id:
        query = query.filter(ItemVersion.inventory_id == inventory_id)
    if user_id:
        query = query.filter(ItemVersion.changed_by_id == user_id)
    if user_scope:
        username_present = and_(
            ItemVersion.changed_by_username.isnot(None),
            func.length(func.trim(ItemVersion.changed_by_username)) > 0,
        )
        if user_scope == "active":
            query = query.filter(ItemVersion.changed_by_id.isnot(None))
        elif user_scope == "none":
            query = query.filter(
                ItemVersion.changed_by_id.is_(None),
                ~username_present,
            )
        elif user_scope == "deleted":
            query = query.filter(
                ItemVersion.changed_by_id.is_(None),
                username_present,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="user_scope non valido. Valori ammessi: active, none, deleted",
            )
    if operation:
        query = query.filter(ItemVersion.operation == operation)
    if from_date:
        normalized_from = from_date.astimezone(timezone.utc).replace(tzinfo=None) if from_date.tzinfo else from_date
        query = query.filter(ItemVersion.changed_at >= normalized_from)
    if to_date:
        normalized_to = to_date.astimezone(timezone.utc).replace(tzinfo=None) if to_date.tzinfo else to_date
        query = query.filter(ItemVersion.changed_at <= normalized_to)

    # Permessi: solo admin vede tutto, altri vedono solo i loro inventari
    if current_user.role.name != "admin":
        visible_inventory_ids = (
            db.query(Inventory.id)
            .filter(
                or_(
                    Inventory.owner_id == current_user.id,
                )
            )
            .all()
        )
        ids = [inv_id[0] for inv_id in visible_inventory_ids]
        if ids:
            query = query.filter(ItemVersion.inventory_id.in_(ids))
        else:
            query = query.filter(false())  # No access

    logs = query.order_by(desc(ItemVersion.changed_at)).all()

    # Arricchisce ogni log item con nome/tipo inventario per una visualizzazione audit piu leggibile.
    inventory_ids = {
        cast(int, log.inventory_id)
        for log in logs
        if log.inventory_id is not None
    }
    inventory_map = {}

    if inventory_ids:
        current_inventories = (
            db.query(Inventory.id, Inventory.name, Inventory.type)
            .filter(Inventory.id.in_(inventory_ids))
            .all()
        )
        for inv_id, inv_name, inv_type in current_inventories:
            inventory_map[inv_id] = (inv_name, inv_type)

        missing_ids = [inv_id for inv_id in inventory_ids if inv_id not in inventory_map]
        if missing_ids:
            fallback_versions = (
                db.query(InventoryVersion)
                .filter(InventoryVersion.inventory_id.in_(missing_ids))
                .order_by(InventoryVersion.inventory_id.asc(), InventoryVersion.version_num.desc())
                .all()
            )
            for version in fallback_versions:
                version_inventory_id = cast(int, version.inventory_id)
                if version_inventory_id not in inventory_map:
                    inventory_map[version_inventory_id] = (version.name, version.type)

    for log in logs:
        log_inventory_id = cast(int, log.inventory_id)
        inv_name, inv_type = inventory_map.get(log_inventory_id, (None, None))
        setattr(log, "inventory_name", inv_name)
        setattr(log, "inventory_type", inv_type)

    return logs

@router.get("/logs/inventories", response_model=List[InventoryVersionResponse])
def get_inventory_audit_logs(
    user_id: Optional[int] = None,
    user_scope: Optional[str] = None,
    operation: Optional[str] = None,
    inventory_type: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Recupera i log di audit degli inventari/liste filtrati.
    Solo admin può vedere tutti; gli altri vedono solo i loro.
    """
    query = db.query(InventoryVersion)

    if user_id:
        query = query.filter(InventoryVersion.changed_by_id == user_id)
    if user_scope:
        username_present = and_(
            InventoryVersion.changed_by_username.isnot(None),
            func.length(func.trim(InventoryVersion.changed_by_username)) > 0,
        )
        if user_scope == "active":
            query = query.filter(InventoryVersion.changed_by_id.isnot(None))
        elif user_scope == "none":
            query = query.filter(
                InventoryVersion.changed_by_id.is_(None),
                ~username_present,
            )
        elif user_scope == "deleted":
            query = query.filter(
                InventoryVersion.changed_by_id.is_(None),
                username_present,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="user_scope non valido. Valori ammessi: active, none, deleted",
            )
    if operation:
        query = query.filter(InventoryVersion.operation == operation)
    if inventory_type in ("INVENTORY", "CHECKLIST"):
        query = query.filter(InventoryVersion.type == inventory_type)
    if from_date:
        normalized_from = from_date.astimezone(timezone.utc).replace(tzinfo=None) if from_date.tzinfo else from_date
        query = query.filter(InventoryVersion.changed_at >= normalized_from)
    if to_date:
        normalized_to = to_date.astimezone(timezone.utc).replace(tzinfo=None) if to_date.tzinfo else to_date
        query = query.filter(InventoryVersion.changed_at <= normalized_to)

    # Permessi
    if current_user.role.name != "admin":
        query = query.filter(InventoryVersion.owner_id == current_user.id)

    return query.order_by(desc(InventoryVersion.changed_at)).all()
