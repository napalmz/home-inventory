from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import FileResponse
from fastapi import UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
import os
import subprocess
import threading
import logging
from dependencies import get_db, role_required
from models import RoleEnum
from dotenv import load_dotenv
from database import SessionLocal
from crud import get_setting, set_setting

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(role_required(RoleEnum.admin))])

BACKUP_DIR = Path("./backups")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/create")
def create_backup(db: Session = Depends(get_db), prefix: str = "manual"):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    full_backup_path = BACKUP_DIR / f"{prefix}_backup_{timestamp}.sql"
    users_backup_path = BACKUP_DIR / f"users_temp_{timestamp}.sql"

    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = os.getenv("POSTGRES_PASSWORD", "admin")

        logger.info(f"Avvio backup: {full_backup_path.name}")

        # Prima esportiamo gli utenti (senza admin)
        with open(users_backup_path, "w") as users_file:
            subprocess.run([
                "psql",
                "-U", os.getenv("POSTGRES_USER", "admin"),
                "-h", os.getenv("POSTGRES_HOST", "db"),
                "-d", os.getenv("POSTGRES_DB", "inventory"),
                "-c",
                """COPY (
                    SELECT 'INSERT INTO users (id, username, email, hashed_password, role_id, is_blocked, data_ins, data_mod) VALUES (' ||
                    id || ', ' || quote_literal(username) || ', ' || quote_literal(email) || ', ' || quote_literal(hashed_password) || ', ' || role_id || ', ' || is_blocked || ', ' || quote_literal(data_ins) || ', ' || quote_literal(data_mod) || ');'
                    FROM users
                    WHERE username != 'admin'
                ) TO STDOUT;"""
            ], check=True, env=env, stdout=users_file)

        # Poi esportiamo gli altri dati (senza utenti e senza ruoli)
        subprocess.run([
            "pg_dump",
            "-U", os.getenv("POSTGRES_USER", "admin"),
            "-h", os.getenv("POSTGRES_HOST", "db"),
            "-d", os.getenv("POSTGRES_DB", "inventory"),
            "--data-only",
            "--column-inserts",
            "--exclude-table-data=users",
            "--exclude-table-data=roles",
            "-f", str(full_backup_path)
        ], check=True, env=env)

        # Ora uniamo i due file, utenti prima
        with open(full_backup_path, "r+") as final_file:
            content = final_file.read()
            final_file.seek(0, 0)
            with open(users_backup_path, "r") as users_file:
                final_file.write(users_file.read() + "\n")
            final_file.write(content)

        # Cleanup: cancella file temporaneo
        users_backup_path.unlink()

        logger.info(f"Backup completato: {full_backup_path.name}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel backup: {str(e)}")

    return {"message": "Backup creato", "filename": full_backup_path.name}

@router.get("/")
def list_backups():
    backups = []
    for file in sorted(BACKUP_DIR.glob("*.sql")):
        backups.append({
            "filename": file.name,
            "size": file.stat().st_size,
            "modified": datetime.fromtimestamp(file.stat().st_mtime)
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
        logger.info(f"Cancellazione completata per il file: {filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante la cancellazione: {str(e)}")

    return {"message": "Backup cancellato"}

@router.post("/restore/{filename}")
def restore_backup(filename: str, confirm: bool = Body(...)):
    if not confirm:
        raise HTTPException(status_code=400, detail="Restore non confermato")

    if not filename.endswith(".sql"):
        raise HTTPException(status_code=400, detail="Formato file non valido per restore")

    file_path = BACKUP_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File non trovato")

    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = os.getenv("POSTGRES_PASSWORD", "admin")

        def run_restore():
            try:
                logger.info(f"Restore avviato per il file: {filename}")
                # Esegui il comando di restore in un thread separato
                from sqlalchemy import text

                logger.info(f"Pulizia tabelle prima del restore...")
                db = SessionLocal()
                db.execute(text("DELETE FROM shared_inventories"))
                db.execute(text("DELETE FROM shared_inventory_groups"))
                db.execute(text("DELETE FROM items"))
                db.execute(text("DELETE FROM inventories"))
                db.execute(text("DELETE FROM user_group_association"))
                db.execute(text("DELETE FROM groups"))
                #db.execute(text("DELETE FROM roles"))
                db.execute(text("DELETE FROM users WHERE username != 'admin'"))
                #db.execute(text("DELETE FROM settings"))
                db.commit()
                db.close()
                logger.info(f"Pulizia completata. Avvio restore da {filename}")

                subprocess.run([
                    "psql",
                    "-U", os.getenv("POSTGRES_USER", "admin"),
                    "-h", os.getenv("POSTGRES_HOST", "db"),
                    "-d", os.getenv("POSTGRES_DB", "inventory"),
                    "-f", str(file_path)
                ], check=True, env=env)
                logger.info(f"Restore completato per il file: {filename}")
            except Exception as e:
                logger.error(f"Errore durante il restore: {str(e)}")

        threading.Thread(target=run_restore).start()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel restore: {str(e)}")

    return {"message": "Restore avviato in background"}

@router.post("/upload")
def upload_backup(file: UploadFile = File(...)):
    if not file.filename.endswith(".sql"):
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