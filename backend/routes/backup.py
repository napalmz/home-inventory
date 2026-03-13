from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import FileResponse
from fastapi import UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from pathlib import Path
import os
import subprocess
import threading
import logging
import json
import re
from dependencies import get_db, role_required
from models import RoleEnum
from dotenv import load_dotenv
from database import SessionLocal
from crud import get_setting, set_setting
from pydantic import BaseModel
from typing import Literal

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(role_required(RoleEnum.admin))])

BACKUP_DIR = Path("./backups")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

BACKUP_META_PREFIX = "-- HI_BACKUP_META: "


class RestoreRequest(BaseModel):
    confirm: bool
    mode: Literal["base", "advanced"] = "base"
    overwrite_users_roles: bool = False
    overwrite_settings: bool = False
    overwrite_admin: bool = False


def _backup_meta_path(file_path: Path) -> Path:
    return file_path.parent / f"{file_path.name}.meta.json"


def _get_alembic_version(db: Session) -> str | None:
    row = db.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).fetchone()
    return row[0] if row else None


def _write_backup_metadata(file_path: Path, metadata: dict) -> None:
    meta_path = _backup_meta_path(file_path)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=True, indent=2)


def _prepend_backup_metadata_comment(file_path: Path, metadata: dict) -> None:
    # Manteniamo i backup single-file auto-descrittivi anche in caso di upload/download solo .sql
    meta_line = f"{BACKUP_META_PREFIX}{json.dumps(metadata, ensure_ascii=True)}\n"
    with open(file_path, "r", encoding="utf-8") as f:
        original = f.read()
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(meta_line)
        f.write(original)


def _read_backup_metadata(file_path: Path) -> dict | None:
    sidecar = _backup_meta_path(file_path)
    if sidecar.exists():
        with open(sidecar, "r", encoding="utf-8") as f:
            return json.load(f)

    with open(file_path, "r", encoding="utf-8") as f:
        for _ in range(30):
            line = f.readline()
            if not line:
                break
            if line.startswith(BACKUP_META_PREFIX):
                raw = line[len(BACKUP_META_PREFIX):].strip()
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return None
    return None


def _build_filtered_restore_sql(
    source_file: Path,
    output_file: Path,
    include_tables: set[str],
    skip_admin_insert: bool,
) -> None:
    insert_re = re.compile(r"^INSERT INTO (?:public\.)?\"?([a-zA-Z0-9_]+)\"? ")
    setval_re = re.compile(r"^SELECT pg_catalog\.setval\('(?:public\.)?\"?([a-zA-Z0-9_]+)_")

    with open(source_file, "r", encoding="utf-8") as src, open(output_file, "w", encoding="utf-8") as dst:
        for line in src:
            if line.startswith(BACKUP_META_PREFIX):
                continue

            ins = insert_re.match(line)
            if ins:
                table = ins.group(1)
                if table not in include_tables:
                    continue
                if table == "users" and skip_admin_insert and "'admin'" in line:
                    continue
                dst.write(line)
                continue

            seq = setval_re.match(line)
            if seq:
                table = seq.group(1)
                if table not in include_tables:
                    continue
                dst.write(line)
                continue

            # Manteniamo SET/SELECT/COMMENT utili al restore
            dst.write(line)

@router.post("/create")
def create_backup(db: Session = Depends(get_db), prefix: str = "manual"):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    full_backup_path = BACKUP_DIR / f"{prefix}_backup_{timestamp}.sql"

    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = os.getenv("POSTGRES_PASSWORD", "admin")

        logger.info(f"Avvio backup: {full_backup_path.name}")

        # Backup totale data-only: include tutte le tabelle/record
        subprocess.run([
            "pg_dump",
            "-U", os.getenv("POSTGRES_USER", "admin"),
            "-h", os.getenv("POSTGRES_HOST", "db"),
            "-d", os.getenv("POSTGRES_DB", "inventory"),
            "--data-only",
            "--column-inserts",
            "-f", str(full_backup_path)
        ], check=True, env=env)

        metadata = {
            "format": "home-inventory-backup-v2",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "db_alembic_version": _get_alembic_version(db),
        }
        _write_backup_metadata(full_backup_path, metadata)
        _prepend_backup_metadata_comment(full_backup_path, metadata)

        logger.info(f"Backup completato: {full_backup_path.name}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel backup: {str(e)}")

    return {"message": "Backup creato", "filename": full_backup_path.name}

@router.get("/")
def list_backups(db: Session = Depends(get_db)):
    backups = []
    current_revision = _get_alembic_version(db)
    for file in sorted(BACKUP_DIR.glob("*.sql")):
        metadata = _read_backup_metadata(file)
        backup_revision = metadata.get("db_alembic_version") if metadata else None
        backups.append({
            "filename": file.name,
            "size": file.stat().st_size,
            "modified": datetime.fromtimestamp(file.stat().st_mtime),
            "metadata": metadata,
            "has_metadata": metadata is not None,
            "db_alembic_version": backup_revision,
            "current_db_alembic_version": current_revision,
            "restorable_on_current_db": bool(metadata and backup_revision and backup_revision == current_revision),
        })
    return backups

@router.get("/download/{filename}")
def download_backup(filename: str):
    file_path = BACKUP_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File non trovato")
    return FileResponse(path=file_path, filename=filename, media_type='application/octet-stream')

@router.delete("/delete/{filename}")
def delete_backup(filename: str, confirm: bool = Body(...)):
    if not confirm:
        raise HTTPException(status_code=400, detail="Cancellazione non confermata")

    if not filename.endswith(".sql"):
        raise HTTPException(status_code=400, detail="Formato file non valido per cancellazione")

    file_path = BACKUP_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File non trovato")

    try:
        logger.info(f"Cancellazione avviata per il file: {filename}")
        file_path.unlink()
        meta_path = _backup_meta_path(file_path)
        if meta_path.exists():
            meta_path.unlink()
        logger.info(f"Cancellazione completata per il file: {filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante la cancellazione: {str(e)}")

    return {"message": "Backup cancellato"}

@router.post("/restore/{filename}")
def restore_backup(filename: str, payload: RestoreRequest = Body(...)):
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Restore non confermato")

    if not filename.endswith(".sql"):
        raise HTTPException(status_code=400, detail="Formato file non valido per restore")

    file_path = BACKUP_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File non trovato")

    if payload.mode == "advanced" and payload.overwrite_users_roles and not payload.overwrite_admin:
        raise HTTPException(
            status_code=400,
            detail="Per sovrascrivere utenti/ruoli e mantenere consistenza è necessario abilitare anche overwrite_admin",
        )

    metadata = _read_backup_metadata(file_path)
    if not metadata or not metadata.get("db_alembic_version"):
        raise HTTPException(status_code=400, detail="Backup privo di metadati versione, restore bloccato")

    current_db = SessionLocal()
    try:
        current_revision = _get_alembic_version(current_db)
    finally:
        current_db.close()

    if metadata.get("db_alembic_version") != current_revision:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Backup non ripristinabile su questo DB: versione backup={metadata.get('db_alembic_version')} "
                f"versione corrente={current_revision}"
            ),
        )

    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = os.getenv("POSTGRES_PASSWORD", "admin")

        business_tables = {
            "shared_inventories",
            "shared_inventory_groups",
            "item_versions",
            "inventory_versions",
            "items",
            "inventories",
            "user_group_association",
            "groups",
        }

        include_tables = set(business_tables)
        include_tables.add("users")
        if payload.mode == "advanced" and payload.overwrite_users_roles:
            include_tables.add("roles")
        if payload.mode == "advanced" and payload.overwrite_settings:
            include_tables.add("settings")

        skip_admin_insert = not (payload.mode == "advanced" and payload.overwrite_users_roles and payload.overwrite_admin)

        restore_sql_path = BACKUP_DIR / f"tmp_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        _build_filtered_restore_sql(file_path, restore_sql_path, include_tables, skip_admin_insert)

        def run_restore():
            db = None
            try:
                logger.info(f"Restore avviato per il file: {filename}")
                # Esegui il comando di restore in un thread separato
                logger.info(f"Pulizia tabelle prima del restore...")
                db = SessionLocal()
                db.execute(text("DELETE FROM shared_inventories"))
                db.execute(text("DELETE FROM shared_inventory_groups"))
                db.execute(text("DELETE FROM item_versions"))
                db.execute(text("DELETE FROM inventory_versions"))
                db.execute(text("DELETE FROM items"))
                db.execute(text("DELETE FROM inventories"))
                db.execute(text("DELETE FROM user_group_association"))
                db.execute(text("DELETE FROM groups"))

                if payload.mode == "advanced" and payload.overwrite_users_roles and payload.overwrite_admin:
                    db.execute(text("DELETE FROM users"))
                    db.execute(text("DELETE FROM roles"))
                else:
                    db.execute(text("DELETE FROM users WHERE username != 'admin'"))

                if payload.mode == "advanced" and payload.overwrite_settings:
                    db.execute(text("DELETE FROM settings"))

                db.commit()
                logger.info(f"Pulizia completata. Avvio restore da {filename}")

                subprocess.run([
                    "psql",
                    "-U", os.getenv("POSTGRES_USER", "admin"),
                    "-h", os.getenv("POSTGRES_HOST", "db"),
                    "-d", os.getenv("POSTGRES_DB", "inventory"),
                    "-f", str(restore_sql_path)
                ], check=True, env=env)
                logger.info(f"Restore completato per il file: {filename}")
            except Exception as e:
                logger.error(f"Errore durante il restore: {str(e)}")
            finally:
                if db:
                    db.close()
                try:
                    if restore_sql_path.exists():
                        restore_sql_path.unlink()
                except Exception:
                    logger.warning(f"Impossibile eliminare file temporaneo restore {restore_sql_path.name}")

        threading.Thread(target=run_restore).start()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel restore: {str(e)}")

    return {"message": "Restore avviato in background", "mode": payload.mode}

@router.post("/upload")
def upload_backup(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".sql"):
        raise HTTPException(status_code=400, detail="Formato file non valido. Sono ammessi solo file .sql.")

    file_path = BACKUP_DIR / file.filename

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())
        logger.info(f"File di backup caricato: {file.filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante il caricamento del file: {str(e)}")

    return {"message": "Backup caricato correttamente", "filename": file.filename}

@router.get("/schedule")
def get_backup_schedule(db: Session = Depends(get_db)):
    """Restituisce la configurazione della schedulazione backup."""
    frequency   = get_setting(db, "BACKUP_FREQUENCY")
    int_days    = get_setting(db, "BACKUP_INTERVAL_DAYS")
    int_hours   = get_setting(db, "BACKUP_INTERVAL_HOURS")
    int_minutes = get_setting(db, "BACKUP_INTERVAL_MINUTES")
    retention   = get_setting(db, "BACKUP_RETENTION")
    return {
        "BACKUP_FREQUENCY": frequency,
        "BACKUP_INTERVAL_DAYS": int_days,
        "BACKUP_INTERVAL_HOURS": int_hours,
        "BACKUP_INTERVAL_MINUTES": int_minutes,
        "BACKUP_RETENTION": retention
    }

@router.post("/schedule")
def set_backup_schedule(
    backup_frequency:   str = Body(..., embed=True),
    backup_int_days:    int = Body(..., embed=True),
    backup_int_hours:   int = Body(..., embed=True),
    backup_int_minutes: int = Body(..., embed=True),
    backup_retention:   int = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """Aggiorna o crea la configurazione della schedulazione backup."""
    set_setting(db, "BACKUP_FREQUENCY", str(backup_frequency))
    set_setting(db, "BACKUP_INTERVAL_DAYS", str(backup_int_days))
    set_setting(db, "BACKUP_INTERVAL_HOURS", str(backup_int_hours))
    set_setting(db, "BACKUP_INTERVAL_MINUTES", str(backup_int_minutes))
    set_setting(db, "BACKUP_RETENTION", str(backup_retention))

    try:
        from scheduler import start_scheduler as perform_start_scheduler
        perform_start_scheduler()
    except Exception as e:
        logger.error(f"Errore durante l'avvio dello scheduler: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Errore durante l'avvio dello scheduler: {str(e)}")
    
    return {"message": "Schedulazione aggiornata correttamente."}

@router.post("/schedule/trigger")
def trigger_backup_now(db: Session = Depends(get_db)):
    """Esegue immediatamente un backup manuale come se fosse schedulato."""
    try:
        from scheduler import scheduled_backup as perform_scheduled_backup
        perform_scheduled_backup()
        return {"message": "Backup schedulato avviato manualmente."}
    except Exception as e:
        logger.error(f"Errore durante il trigger manuale del backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Errore durante il trigger manuale del backup: {str(e)}")