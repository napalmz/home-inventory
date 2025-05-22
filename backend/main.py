import os
from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging
from database import SessionLocal, init_db
from dependencies import init_roles_and_admin, get_db, initialize_settings
from sqlalchemy.orm import Session
from routes.auth import router as auth_router
from routes.user import router as user_router
from routes.admin import router as admin_router
from routes.inventory import inventory_router, checklist_router
from routes.item import router as item_router
from routes.system import router as system_router
from routes.settings import router as settings_router
from routes.backup import router as backup_router
from fastapi.middleware.cors import CORSMiddleware
from models import Inventory, Item, User
from scheduler import start_scheduler

logging.basicConfig(level=logging.INFO)

db = SessionLocal()
init_db()
init_roles_and_admin(db)
db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = next(get_db())
    initialize_settings(db)
    yield
    db.close()

root_path = os.getenv("FASTAPI_ROOT_PATH", "")
api_version = os.getenv("API_VERSION", "unknown")

app = FastAPI(
    lifespan=lifespan
   ,title="Home Inventory"
   ,version=api_version
   ,root_path=root_path  # 👈
   #,openapi_url="/api/openapi.json" # Per usare il reverse proxy
   #,docs_url="/api/docs"            # Per usare il reverse proxy
   #,redoc_url="/api/redoc"          # Per usare il reverse proxy
)
app.openapi_schema = None  # Rigenera lo schema alla prima richiesta

# Avvio dello scheduler per i backup
start_scheduler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(user_router, prefix="/user", tags=["User"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])
app.include_router(inventory_router, prefix="/inventory", tags=["Inventory"])
app.include_router(checklist_router, prefix="/checklist", tags=["Checklist"])
app.include_router(item_router, prefix="/item", tags=["Item"])
app.include_router(system_router, prefix="/system", tags=["System"])
app.include_router(settings_router, prefix="/settings", tags=["Settings"])
app.include_router(backup_router, prefix="/backup", tags=["Backups"])

@app.get("/")
def home():
    db = SessionLocal()
    num_inventories = db.query(Inventory).filter(Inventory.type == "INVENTORY").count()
    num_checklists = db.query(Inventory).filter(Inventory.type == "CHECKLIST").count()
    num_inventories_items = db.query(Item).filter(Item.inventory.has(type="INVENTORY")).count()
    num_checklists_items = db.query(Item).filter(Item.inventory.has(type="CHECKLIST")).count()
    num_users = db.query(User).count()
    db.close()

    return {
        "title": "Home Inventory/List Management",
        "message": "Benvenuto nell'applicazione di gestione inventari e liste!",
        "stats": {
            "total_inventories": num_inventories,
            "total_inventories_items": num_inventories_items,
            "total_checklists": num_checklists,
            "total_checklists_items": num_checklists_items,
            "total_users": num_users
        }
    }