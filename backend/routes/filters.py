from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from dependencies import get_db
from models import FilterTemplate, Inventory, User
from routes.auth import get_current_user
from routes.inventory import can_access_inventory
from schemas import (
    FilterTemplateCreate,
    FilterTemplateListResponse,
    FilterTemplateResponse,
    FilterTemplateUpdate,
)


router = APIRouter()


def _get_inventory_or_404(db: Session, inventory_id: int) -> Inventory:
    inventory = db.query(Inventory).filter(Inventory.id == inventory_id).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventario non trovato")
    return inventory


def _get_filter_template_or_404(db: Session, template_id: int) -> FilterTemplate:
    template = db.query(FilterTemplate).filter(FilterTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template filtro non trovato")
    return template


@router.get("", response_model=List[FilterTemplateListResponse])
def list_filter_templates(
    inventory_id: int = Query(..., gt=0),
    include_shared: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inventory = _get_inventory_or_404(db, inventory_id)
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    query = db.query(FilterTemplate).filter(FilterTemplate.inventory_id == inventory_id)
    if not include_shared:
        query = query.filter(FilterTemplate.is_shared.is_(False))

    return query.order_by(FilterTemplate.data_mod.desc(), FilterTemplate.id.asc()).all()


@router.get("/{template_id}", response_model=FilterTemplateResponse)
def get_filter_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = _get_filter_template_or_404(db, template_id)
    inventory = _get_inventory_or_404(db, template.inventory_id)  # type: ignore
    if not can_access_inventory(user, inventory, action="view"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    return template


@router.post("", response_model=FilterTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_filter_template(
    payload: FilterTemplateCreate,
    inventory_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inventory = _get_inventory_or_404(db, inventory_id)
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Il nome del template non può essere vuoto")

    existing = db.query(FilterTemplate).filter(
        FilterTemplate.inventory_id == inventory_id,
        FilterTemplate.name == payload.name.strip(),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Esiste già un template con questo nome per l'inventario")

    template = FilterTemplate(
        inventory_id=inventory_id,
        name=payload.name.strip(),
        description=payload.description,
        filter_type=payload.filter_type,
        criteria=payload.criteria,
        is_shared=payload.is_shared,
        user_ins=user.id,
        user_mod=user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.patch("/{template_id}", response_model=FilterTemplateResponse)
def update_filter_template(
    template_id: int,
    payload: FilterTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = _get_filter_template_or_404(db, template_id)
    inventory = _get_inventory_or_404(db, template.inventory_id)  # type: ignore
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    updates = payload.model_dump(exclude_unset=True)
    
    if "name" in updates and updates["name"]:
        updates["name"] = updates["name"].strip()
        duplicate = db.query(FilterTemplate).filter(
            FilterTemplate.inventory_id == template.inventory_id,
            FilterTemplate.name == updates["name"],
            FilterTemplate.id != template.id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Esiste già un template con questo nome per l'inventario")

    for field, value in updates.items():
        setattr(template, field, value)

    template.user_mod = user.id
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_filter_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    template = _get_filter_template_or_404(db, template_id)
    inventory = _get_inventory_or_404(db, template.inventory_id)  # type: ignore
    if not can_access_inventory(user, inventory, action="edit"):
        raise HTTPException(status_code=403, detail="Accesso negato")

    db.delete(template)
    db.commit()
    return {"detail": "Template filtro eliminato"}
