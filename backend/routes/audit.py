"""
Route centralizzato per audit log e query storiche
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, false
from datetime import datetime, timezone
from models import ItemVersion, InventoryVersion, User
from schemas import ItemVersionResponse, InventoryVersionResponse
from routes.auth import get_current_user
from dependencies import get_db
from typing import List, Optional

router = APIRouter()

#############################################################################
# Query audit centralizzate (sola lettura)
#############################################################################

@router.get("/logs/items", response_model=List[ItemVersionResponse])
def get_item_audit_logs(
    inventory_id: Optional[int] = None,
    user_id: Optional[int] = None,
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
        from models import Inventory
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

    return query.order_by(desc(ItemVersion.changed_at)).all()

@router.get("/logs/inventories", response_model=List[InventoryVersionResponse])
def get_inventory_audit_logs(
    user_id: Optional[int] = None,
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
