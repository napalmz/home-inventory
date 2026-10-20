# Sentinel Security Journal

## 2025-02-23 - Path Traversal in Backup File Management Routes
**Vulnerability:** Backup management routes (`download`, `delete`, `restore`, `upload`, `delete-bulk`) in `backend/routes/backup.py` accepted raw filename path parameters directly concatenated with `BACKUP_DIR`. Path traversal payloads such as `../../.env` allowed downloading, deleting, or overwriting files outside the intended backup directory.
**Learning:** File management endpoints that take user-controlled filenames as route parameters or payload properties can expose sensitive files if path resolution is not strictly restricted to the target directory.
**Prevention:** Always validate filenames against path traversal characters (`/`, `\`, `..`), enforce expected file extensions, and resolve paths using `Path.resolve()` verifying that the resolved path is relative to the designated base directory before performing filesystem operations.

## 2025-05-18 - Unenforced Account Blocking in Login/Me Endpoints & Self-Block Runtime Exception
**Vulnerability:** Blocked users (`is_blocked = True`) were issued valid JWT access tokens upon logging in via `/auth/login` and could query `/auth/me`. Additionally, `/user/users/{user_id}/block` called `role_required(RoleEnum.admin).id`, causing an `AttributeError` at runtime and preventing self-blocking validation.
**Learning:** Checking `is_blocked` only inside a generic `get_current_user` dependency leaves unauthenticated or custom auth endpoints (`/login`, `/me`) vulnerable if they do not explicitly check user block status or use `get_current_user`.
**Prevention:** Always check `user.is_blocked` during primary login authentication and profile queries, and use `Depends(role_required(RoleEnum.admin))` directly to obtain current user info in admin endpoints.
