## 2025-05-18 - [Batch Item Version Queries to Fix N+1]
**Learning:** In `backend/routes/inventory.py`, `_current_item_version_num` was called per item inside response serialisation loops in `list_inventories_base` and `list_items_base`, executing 1 query per item.
**Action:** Use a batched SQLAlchemy `GROUP BY ItemVersion.item_id` query filtered by `item_id.in_(...)` to fetch item versions in 1 query for all items.
