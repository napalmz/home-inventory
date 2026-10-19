import pytest
from fastapi import HTTPException
from routes.backup import _safe_backup_path, BACKUP_DIR


def test_safe_backup_path_valid():
    filename = "manual_backup_20250101_120000.sql"
    path = _safe_backup_path(filename)
    assert path.name == filename
    assert path.parent == BACKUP_DIR.resolve()


def test_safe_backup_path_traversal_attempts():
    invalid_filenames = [
        "../../.env",
        "../test.sql",
        "..\\test.sql",
        "sub/test.sql",
        "/etc/passwd",
        "C:\\Windows\\system32\\cmd.exe",
        "test.txt",
        "",
        "..",
        ".sql",
    ]

    for fn in invalid_filenames:
        with pytest.raises(HTTPException) as exc_info:
            _safe_backup_path(fn)
        assert exc_info.value.status_code == 400
