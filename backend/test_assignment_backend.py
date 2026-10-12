from datetime import timedelta

import pytest

import assignment_service
from models import ListAssignment
from test_barcode_backend import ctx, _create_item  # noqa: F401


def _make(ctx, stock=10, qty=3):
    client, db = ctx["client"], ctx["db"]
    src = _create_item(client, ctx["inv_a"], "Latte")
    client.patch(f"/item/{src['id']}", json={"name": "Latte", "description": None, "quantity": stock, "inventory_id": ctx["inv_a"]})
    from models import Inventory
    lst = Inventory(name="Spesa", type="CHECKLIST", owner_id=1)
    db.add(lst)
    db.commit()
    row = client.post("/item/", json={"name": "Latte", "quantity": 0, "inventory_id": lst.id}).json()
    resp = client.post("/assignment/", json={"list_item_id": row["id"], "source_item_id": src["id"], "qty": qty})
    assert resp.status_code == 201, resp.text
    return src, row, lst.id


def _set(ctx, row, qty, **params):
    return ctx["client"].patch(
        f"/item/{row['id']}", params=params,
        json={"name": row["name"], "description": None, "quantity": qty, "inventory_id": row["inventory_id"]},
    )


def _stock(ctx, src):
    return ctx["client"].get(f"/item/{src['id']}").json()


def test_gross_and_net_in_inventory(ctx):
    src, row, _ = _make(ctx, stock=10, qty=3)
    data = _stock(ctx, src)
    assert (data["quantity"], data["assigned_qty"], data["net_qty"]) == (10, 3, 7)
    listing = ctx["client"].get(f"/inventory/item/{ctx['inv_a']}/").json()
    assert listing[0]["net_qty"] == 7
    by_source = ctx["client"].get(f"/assignment/by-source/{src['id']}").json()
    assert by_source[0]["list_name"] == "Spesa" and by_source[0]["qty"] == 3


def test_check_deducts_and_clears_pending(ctx):
    src, row, _ = _make(ctx)
    assert _set(ctx, row, 1).status_code == 200
    data = _stock(ctx, src)
    assert data["quantity"] == 7
    assert data.get("assigned_qty", 0) == 0
    assert _set(ctx, row, 1).status_code == 200  # nessun doppio scarico
    assert _stock(ctx, src)["quantity"] == 7


def test_uncheck_within_window_restores(ctx):
    src, row, _ = _make(ctx)
    _set(ctx, row, 1)
    _set(ctx, row, 0)
    assert _stock(ctx, src)["quantity"] == 10


def test_uncheck_after_window_keeps_stock(ctx):
    src, row, _ = _make(ctx)
    _set(ctx, row, 1)
    a = ctx["db"].query(ListAssignment).one()
    a.applied_at = a.applied_at - timedelta(seconds=assignment_service.UNDO_WINDOW_SECONDS + 5)
    ctx["db"].commit()
    _set(ctx, row, 0)
    data = _stock(ctx, src)
    assert data["quantity"] == 7
    assert data["assigned_qty"] == 3  # di nuovo in essere per il ciclo successivo


def test_insufficient_stock_asks_then_zeroes(ctx):
    src, row, _ = _make(ctx, stock=5, qty=5)
    ctx["client"].patch(f"/item/{src['id']}", json={"name": "Latte", "description": None, "quantity": 2, "inventory_id": ctx["inv_a"]})
    resp = _set(ctx, row, 1)
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "insufficient_stock"
    assert resp.json()["detail"]["available"] == 2
    assert _stock(ctx, src)["quantity"] == 2
    assert _set(ctx, row, 0).status_code == 200  # annulla: nessuna modifica
    assert _set(ctx, row, 1, on_insufficient="zero").status_code == 200
    assert _stock(ctx, src)["quantity"] == 0
    _set(ctx, row, 0)
    assert _stock(ctx, src)["quantity"] == 2  # ripristina solo quanto scaricato


def test_validation_and_cleanup(ctx):
    src, row, list_id = _make(ctx)
    client = ctx["client"]
    dup = client.post("/assignment/", json={"list_item_id": row["id"], "source_item_id": src["id"], "qty": 1})
    assert dup.status_code == 409
    bad = client.post("/assignment/", json={"list_item_id": src["id"], "source_item_id": src["id"], "qty": 1})
    assert bad.status_code == 400
    aid = ctx["db"].query(ListAssignment).one().id
    assert client.patch(f"/assignment/{aid}", json={"qty": 0}).status_code == 422
    assert client.patch(f"/assignment/{aid}", json={"qty": 4}).json()["qty"] == 4
    assert client.request("DELETE", f"/item/{row['id']}", json={"confirm": True}).status_code == 200
    ctx["db"].expire_all()
    assert ctx["db"].query(ListAssignment).count() == 0
    assert "assigned_qty" not in _stock(ctx, src) or _stock(ctx, src)["assigned_qty"] == 0


def test_qty_limited_to_stock_and_source_net(ctx):
    src, row, _ = _make(ctx, stock=4, qty=3)
    client = ctx["client"]
    aid = ctx["db"].query(ListAssignment).one().id
    assert client.patch(f"/assignment/{aid}", json={"qty": 5}).status_code == 400
    from models import Inventory
    other = client.post("/item/", json={"name": "Latte", "quantity": 0, "inventory_id": row["inventory_id"]}).json()
    too_many = client.post("/assignment/", json={"list_item_id": other["id"], "source_item_id": src["id"], "qty": 5})
    assert too_many.status_code == 400
    second = client.post("/assignment/", json={"list_item_id": other["id"], "source_item_id": src["id"], "qty": 3})
    assert second.status_code == 201
    assert second.json()["source_net_qty"] == -2  # 4 - (3+3): negativo teorico
    rows = client.get(f"/checklist/item/{row['inventory_id']}/").json()
    assert all(r["assignment"]["source_net_qty"] == -2 for r in rows)
