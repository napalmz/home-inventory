# backend/scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from database import SessionLocal
from routes.backup import create_backup, BACKUP_DIR
from datetime import datetime, timezone, timedelta
from crud import get_setting, set_setting
import logging
import traceback
from models import ItemVersion, InventoryVersion, Item, Inventory

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

def cleanup_old_backups(retention_count: int):
    backups = sorted(BACKUP_DIR.glob("auto_*.sql"), key=lambda x: x.stat().st_mtime)
    if len(backups) > retention_count:
        deleted = 0
        for backup in backups[:-retention_count]:
            logger.info(f"Eliminazione backup scaduto: {backup.name}")
            backup.unlink()
            deleted += 1
        logger.info(f"Backup eliminati: {deleted}")

def cleanup_old_audit_versions():
    """Pulisce solo i log di audit orfani più vecchi di AUDIT_RETENTION_DAYS.

    Un record audit è considerato orfano quando l'entità principale non esiste più.
    Le versioni di entità ancora presenti non vengono mai eliminate da questa retention.
    """
    db = SessionLocal()
    try:
        setting = get_setting(db, "AUDIT_RETENTION_DAYS")
        retention_days = int(setting.value if setting else 90)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)

        # Elimina ItemVersion orfani precedenti alla data cutoff
        deleted_items = db.query(ItemVersion).filter(
            ItemVersion.changed_at < cutoff_date,
            ~ItemVersion.item_id.in_(db.query(Item.id))
        ).delete(synchronize_session=False)

        # Elimina InventoryVersion orfani precedenti alla data cutoff
        deleted_inventories = db.query(InventoryVersion).filter(
            InventoryVersion.changed_at < cutoff_date,
            ~InventoryVersion.inventory_id.in_(db.query(Inventory.id))
        ).delete(synchronize_session=False)

        db.commit()
        if deleted_items + deleted_inventories > 0:
            logger.info(f"Pulizia audit: {deleted_items} item versions + {deleted_inventories} inventory versions eliminate (>= {retention_days} giorni)")
    except Exception as e:
        logger.error(f"Errore nella pulizia audit: {traceback.format_exc()}")
    finally:
        db.close()

def scheduled_backup():
    logger.info("Backup automatico avviato...")
    db = SessionLocal()
    try:
        create_backup(db, "auto")
        set_setting(db, "BACKUP_LAST_RUN", datetime.now(timezone.utc))
        
        # Controllo della retention
        setting = get_setting(db, "BACKUP_RETENTION")
        retention = int(setting.value if setting else 10)
        cleanup_old_backups(retention)
        
        # Pulizia audit log
        cleanup_old_audit_versions()

    except Exception as e:
        logger.error(f"Errore nel backup automatico: {traceback.format_exc()}")
    finally:
        db.close()
    logger.info("Backup automatico completato.")

def start_scheduler():
    db = SessionLocal()
    try:
        setting = get_setting(db, "BACKUP_FREQUENCY")
        frequency = (setting.value if setting else "none").lower()
        setting = get_setting(db, "BACKUP_INTERVAL_DAYS")
        interval_days = int(setting.value if setting else 0)
        setting = get_setting(db, "BACKUP_INTERVAL_HOURS")
        interval_hours = int(setting.value if setting else 0)
        setting = get_setting(db, "BACKUP_INTERVAL_MINUTES")
        interval_minutes = int(setting.value if setting else 0)

        scheduler.remove_all_jobs()

        if frequency == "none":
            logger.info("Backup automatico disabilitato.")
            return

        if frequency == "hourly":
            scheduler.add_job(
                scheduled_backup,
                trigger="cron",
                minute=interval_minutes,
                id="backup_job",
                replace_existing=True,
            )
            logger.info(f"Scheduler avviato. Backup ogni ora al minuto {interval_minutes:02}.")
        elif frequency == "daily":
            scheduler.add_job(
                scheduled_backup,
                trigger="cron",
                hour=interval_hours,
                minute=interval_minutes,
                id="backup_job",
                replace_existing=True,
            )
            logger.info(f"Scheduler avviato. Backup giornaliero alle {interval_hours:02}:{interval_minutes:02}.")
        elif frequency == "weekly":
            scheduler.add_job(
                scheduled_backup,
                trigger="cron",
                day_of_week=interval_days,
                hour=interval_hours,
                minute=interval_minutes,
                id="backup_job",
                replace_existing=True,
            )
            logger.info(f"Scheduler avviato. Backup settimanale il giorno {interval_days} alle {interval_hours:02}:{interval_minutes:02}.")
        else:
            logger.warning(f"Frequenza di backup non riconosciuta: {frequency}")
            return

        if not scheduler.running:
            scheduler.start()

    except Exception as e:
        logger.error(f"Errore durante l'avvio del scheduler: {traceback.format_exc()}")
    finally:
        db.close()