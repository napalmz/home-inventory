import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from models import BarcodeProductCache

# Anagrafica esterna: famiglia Open * Facts (gratuita, senza API key, dati ODbL).
# Ogni fonte viene interrogata in ordine finche' non trova il prodotto.
LOOKUP_SOURCES = [
    ("openfoodfacts", "https://world.openfoodfacts.org"),
    ("openbeautyfacts", "https://world.openbeautyfacts.org"),
    ("openpetfoodfacts", "https://world.openpetfoodfacts.org"),
    ("openproductsfacts", "https://world.openproductsfacts.org"),
]
USER_AGENT = "home-inventory/1.0 (https://github.com/napalmz/home-inventory)"
HTTP_TIMEOUT_SECONDS = 4
CACHE_TTL_FOUND = timedelta(days=30)
CACHE_TTL_NOT_FOUND = timedelta(days=1)


def lookup_enabled() -> bool:
    return os.getenv("BARCODE_LOOKUP_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")


def normalize_code(raw: str) -> str:
    """Normalizza un codice scansionato.

    I codici numerici perdono spazi; gli UPC-A (12 cifre) diventano EAN-13 con zero
    iniziale, cosi' la stessa etichetta letta da scanner diversi coincide.
    I codici non numerici (QR, Code128 alfanumerici) vengono solo ripuliti.
    """
    code = (raw or "").strip()
    compact = re.sub(r"\s+", "", code)
    if compact.isdigit():
        return "0" + compact if len(compact) == 12 else compact
    return code


def is_valid_gtin(code: str) -> bool:
    if not code.isdigit() or len(code) not in (8, 12, 13, 14):
        return False
    digits = [int(c) for c in code]
    check = digits.pop()
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(digits)))
    return (10 - total % 10) % 10 == check


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _fetch_product(base_url: str, code: str) -> tuple[str, Optional[dict]]:
    """Ritorna ("found", prodotto) | ("missing", None) | ("error", None)."""
    url = (
        f"{base_url}/api/v2/product/{urllib.parse.quote(code)}.json"
        "?fields=product_name,product_name_it,generic_name,brands,quantity,image_front_small_url"
    )
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return ("missing", None) if exc.code == 404 else ("error", None)
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return "error", None
    product = payload.get("product") if payload.get("status") == 1 else None
    return ("found", product) if product else ("missing", None)


def lookup_product(db: Session, code: str) -> Optional[BarcodeProductCache]:
    """Restituisce la riga di cache (found=True) oppure None. Non solleva mai per errori di rete."""
    if not lookup_enabled() or not is_valid_gtin(code):
        return None

    now = _utc_now_naive()
    cached = db.get(BarcodeProductCache, code)
    if cached is not None:
        ttl = CACHE_TTL_FOUND if cached.found else CACHE_TTL_NOT_FOUND
        if now - cached.fetched_at < ttl:
            return cached if cached.found else None

    found_product = None
    found_source = None
    all_missing = True
    for source, base_url in LOOKUP_SOURCES:
        outcome, product = _fetch_product(base_url, code)
        if outcome == "found":
            found_product, found_source = product, source
            break
        if outcome == "error":
            all_missing = False

    row = cached or BarcodeProductCache(code=code)
    if found_product is None:
        # Il negativo si memorizza solo se tutte le fonti hanno risposto "non trovato".
        if all_missing:
            row.found = False
            row.name = row.brand = row.quantity_label = row.image_url = row.source = None
            row.fetched_at = now
            db.add(row)
            db.commit()
        return None

    row.found = True
    row.name = (
        found_product.get("product_name_it")
        or found_product.get("product_name")
        or found_product.get("generic_name")
        or None
    )
    row.brand = (found_product.get("brands") or "").split(",")[0].strip() or None
    row.quantity_label = found_product.get("quantity") or None
    row.image_url = found_product.get("image_front_small_url") or None
    row.source = found_source
    row.fetched_at = now
    db.add(row)
    db.commit()
    return row
