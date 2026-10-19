# Sentinel Security Journal

## 2025-02-23 - Path Traversal in Backup File Management Routes
**Vulnerability:** Backup management routes (`download`, `delete`, `restore`, `upload`, `delete-bulk`) in `backend/routes/backup.py` accepted raw filename path parameters directly concatenated with `BACKUP_DIR`. Path traversal payloads such as `../../.env` allowed downloading, deleting, or overwriting files outside the intended backup directory.
**Learning:** File management endpoints that take user-controlled filenames as route parameters or payload properties can expose sensitive files if path resolution is not strictly restricted to the target directory.
**Prevention:** Always validate filenames against path traversal characters (`/`, `\`, `..`), enforce expected file extensions, and resolve paths using `Path.resolve()` verifying that the resolved path is relative to the designated base directory before performing filesystem operations.
