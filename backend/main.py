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
from routes.inventory import router as inventory_router
from routes.item import router as item_router
from routes.system import router as system_router
from routes.settings import router as settings_router
from fastapi.middleware.cors import CORSMiddleware
from models import Inventory, Item, User

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

app = FastAPI(lifespan=lifespan)
app.openapi_schema = None  # Rigenera lo schema alla prima richiesta

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
app.include_router(item_router, prefix="/item", tags=["Item"])
app.include_router(system_router, prefix="/system", tags=["System"])
app.include_router(settings_router, prefix="/settings", tags=["Settings"])

@app.get("/")
def home():
    db = SessionLocal()
    num_inventories = db.query(Inventory).count()
    num_items = db.query(Item).count()
    num_users = db.query(User).count()
    db.close()

    return {
        "title": "Home Inventory Management",
        "message": "Benvenuto nell'applicazione di gestione inventario!",
        "stats": {
            "total_inventories": num_inventories,
            "total_items": num_items,
            "total_users": num_users
        }
    }