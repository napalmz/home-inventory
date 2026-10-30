# Sentinel Security Journal

## 2025-02-23 - Path Traversal in Backup File Management Routes
**Vulnerability:** Backup management routes (`download`, `delete`, `restore`, `upload`, `delete-bulk`) in `backend/routes/backup.py` accepted raw filename path parameters directly concatenated with `BACKUP_DIR`. Path traversal payloads such as `../../.env` allowed downloading, deleting, or overwriting files outside the intended backup directory.
**Learning:** File management endpoints that take user-controlled filenames as route parameters or payload properties can expose sensitive files if path resolution is not strictly restricted to the target directory.
**Prevention:** Always validate filenames against path traversal characters (`/`, `\`, `..`), enforce expected file extensions, and resolve paths using `Path.resolve()` verifying that the resolved path is relative to the designated base directory before performing filesystem operations.

## 2025-05-18 - Unenforced Account Blocking in Login/Me Endpoints & Self-Block Runtime Exception
**Vulnerability:** Blocked users (`is_blocked = True`) were issued valid JWT access tokens upon logging in via `/auth/login` and could query `/auth/me`. Additionally, `/user/users/{user_id}/block` called `role_required(RoleEnum.admin).id`, causing an `AttributeError` at runtime and preventing self-blocking validation.
**Learning:** Checking `is_blocked` only inside a generic `get_current_user` dependency leaves unauthenticated or custom auth endpoints (`/login`, `/me`) vulnerable if they do not explicitly check user block status or use `get_current_user`.
**Prevention:** Always check `user.is_blocked` during primary login authentication and profile queries, and use `Depends(role_required(RoleEnum.admin))` directly to obtain current user info in admin endpoints.

## 2025-05-19 - Administrative Lockout via Unchecked Last-Admin Role Demotion or Blocking
**Vulnerability:** User role update (`PUT /user/users/{user_id}`, `PUT /admin/users/{user_id}/role/`, `POST /user/users/{user_id}/role/{role_id}`) and user blocking endpoints allowed demoting or blocking the last active enabled administrator. This created a denial-of-administration scenario where 0 active admins remained.
**Learning:** Endpoints that mutate user roles or status must check total system active admin count before permitting changes that revoke admin access.
**Prevention:** Always validate that at least one active, unblocked admin user remains before executing role demotion, account blocking, or deletion operations.

## 2025-05-20 - Broken Object Level Authorization (IDOR) in Filter Template Management
**Vulnerability:** Unbound filter templates (`inventory_id = None`) could be retrieved by any authenticated user via `GET /filter-templates/{id}` or `GET /filter-templates` regardless of `is_shared` or owner status, exposing private filter criteria.
**Learning:** Checking inventory-level access controls when `inventory_id` is present is insufficient if resources can also exist independently without an associated inventory container.
**Prevention:** Always enforce both container-level permissions (if linked) and resource-level access control (`is_shared`, `user_ins == current_user`, or admin role) sequentially on read and list endpoints.

## 2025-05-21 - Router-Level Over-Restriction and Missing IDOR Checks in Shareable Users Endpoint
**Vulnerability:** `GET /user/users/shareable/{inventory_id}` was blocked for non-admin moderators due to `role_required(RoleEnum.admin)` attached at the `user.py` `APIRouter` constructor. In addition, the route handler lacked an object-level authorization check (`can_access_inventory`), exposing shareable user lists for arbitrary inventory IDs to any user who could access the route.
**Learning:** Applying router-level role requirements (`dependencies=[Depends(role_required(...))]`) on mixed routers blocks sub-routes intended for multi-role functionality. Furthermore, context-dependent endpoints must explicitly enforce object-level authorization on target resources.
**Prevention:** Isolate admin-only endpoints into dedicated subrouters, and ensure all endpoints operating on specific resources validate user permissions against those resources (`can_access_inventory`).

## 2025-05-22 - Information Disclosure in Filter Template Scope Preview
**Vulnerability:** Filter template scope preview endpoints (`GET /filter-templates/scope-preview` and `GET /filter-templates`) evaluated metadata definition assignments against `db.query(Inventory).all()` without filtering by user access, leaking names and IDs of private inventories belonging to other users.
**Learning:** Helper functions that compute scope or compatibility metrics across system-wide resources can bypass object-level authorization if they query all containers without contextual user filtering.
**Prevention:** Always filter system-wide container lists using `can_access_inventory(user, container, action="view")` before including resource summaries or scope metadata in responses returned to non-admin users.

## 2025-05-23 - Broken Object Level Authorization & Scope Restriction in Item Audit Logs
**Vulnerability:** `get_item_audit_logs` in `backend/routes/audit.py` filtered item audit logs strictly by `Inventory.owner_id == current_user.id`, ignoring shared and group-shared inventories. This created an authorization inconsistency where non-admin users with access to shared inventories could not access audit history for those inventories.
**Learning:** Hardcoding direct ownership queries in endpoints instead of using central access control helpers causes inconsistent scope restriction across shared resources.
**Prevention:** Always use `can_access_inventory(user, inventory, action="view")` to determine inventory visibility for non-admin users across all endpoints, including audit logs and report queries.
