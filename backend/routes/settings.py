import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import crud as crud_settings
from models import RoleEnum
from dependencies import get_db, role_required

load_dotenv()

router = APIRouter()

#################################################
# Modello per la gestione delle impostazioni
class SettingUpdate(BaseModel):
    key: str
    value: str

#################################################
# Endpoint per impostare e leggere le impostazioni
@router.post("/settings", dependencies=[Depends(role_required(RoleEnum.admin))])
def update_setting(data: SettingUpdate, db: Session = Depends(get_db)):
    crud_settings.set_setting(db, data.key, data.value)
    return {"message": f"Impostazione {data.key} aggiornata"}

@router.get("/settings/{key}")
def read_setting(key: str, db: Session = Depends(get_db)):
    setting = crud_settings.get_setting(db, key)
    return setting

@router.get("/settings", dependencies=[Depends(role_required(RoleEnum.admin))])
def list_settings(db: Session = Depends(get_db)):
    settings = crud_settings.get_all_settings(db)
    return settings

@router.delete("/settings/{key}", dependencies=[Depends(role_required(RoleEnum.admin))])
def delete_setting(key: str, db: Session = Depends(get_db)):
    setting = crud_settings.get_setting(db, key)
    if setting.protected:
        raise HTTPException(status_code=403, detail="Impostazione protetta, non può essere cancellata")
    crud_settings.delete_setting(db, key)
    return {"message": f"Impostazione {key} cancellata"}