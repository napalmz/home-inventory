from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from barcode_service import lookup_product, normalize_code
from dependencies import get_db
from models import Item, ItemBarcode
from routes.auth import get_current_user
from routes.item import can_access_item
from schemas import BarcodeLookupResponse, BarcodeMatch, BarcodeProduct

router = APIRouter()


@router.get("/lookup", response_model=BarcodeLookupResponse)
def lookup_barcode(
    code: str = Query(..., min_length=1, max_length=256),
    inventory_id: int | None = Query(None, description="Limita le corrispondenze a un inventario"),
    external: bool = Query(True, description="Se nessun item corrisponde, interroga l'anagrafica esterna (EAN/UPC)"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    normalized = normalize_code(code)
    if not normalized:
        raise HTTPException(status_code=400, detail="Codice vuoto")

    query = (
        db.query(Item)
        .join(ItemBarcode, ItemBarcode.item_id == Item.id)
        .options(joinedload(Item.inventory))
        .filter(ItemBarcode.code == normalized)
    )
    if inventory_id is not None:
        query = query.filter(Item.inventory_id == inventory_id)

    matches = [
        BarcodeMatch(
            item_id=item.id,
            name=item.name,
            quantity=item.quantity,
            inventory_id=item.inventory_id,
            inventory_name=item.inventory.name if item.inventory else None,
            inventory_type=item.inventory.type if item.inventory else None,
        )
        for item in query.all()
        if can_access_item(user, item, action="view")
    ]

    product = None
    if not matches and external:
        cached = lookup_product(db, normalized)
        if cached is not None:
            product = BarcodeProduct(
                name=cached.name,
                brand=cached.brand,
                quantity_label=cached.quantity_label,
                image_url=cached.image_url,
                source=cached.source,
            )

    return BarcodeLookupResponse(code=normalized, matches=matches, product=product)
