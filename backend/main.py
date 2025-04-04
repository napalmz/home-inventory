import os
from fastapi import FastAPI
import logging
from database import SessionLocal, init_db
from dependencies import init_roles_and_admin
from routes.auth import router as auth_router
from routes.user import router as user_router
from routes.admin import router as admin_router
from routes.inventory import router as inventory_router
from routes.item import router as item_router
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)

db = SessionLocal()
init_db()
init_roles_and_admin(db)
db.close()

app = FastAPI()
app.openapi_schema = None  # Rigenera lo schema alla prima richiesta

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(user_router, prefix="/user", tags=["User"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])
app.include_router(inventory_router, prefix="/inventory", tags=["Inventory"])
app.include_router(item_router, prefix="/item", tags=["Item"])

@app.get("/")
def home():
    return {"message": "API Inventory attiva!"}