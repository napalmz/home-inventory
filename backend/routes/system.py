import os
from fastapi import APIRouter
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

##################################################
# Modello per la risposta della versione dell'API
class VersionResponse(BaseModel):
    version: str

#################################################
# Endpoint per ottenere la versione dell'API
@router.get("/version", response_model=VersionResponse)
def get_api_version():
    return {"version": os.getenv("API_VERSION", "unknown")}
