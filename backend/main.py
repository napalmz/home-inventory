import os
from sqlalchemy.orm import Session
from fastapi import FastAPI
from database import engine, Base, SessionLocal, init_db, init_roles_and_admin
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.inventory import router as inventory_router
from routes.user import router as user_router

db = SessionLocal()
init_db()
init_roles_and_admin(db)
db.close()

app = FastAPI()
app.openapi_schema = None  # Rigenera lo schema alla prima richiesta

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(user_router, prefix="/user", tags=["User"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])
app.include_router(inventory_router, prefix="/inventory", tags=["Inventory"])

@app.get("/")
def home():
    return {"message": "API Inventory attiva!"}