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

##################################################
# Modello per la risposta all'HEALTHCHECK dell'API
class HealthCheckResponse(BaseModel):
    version: str

#################################################
# Endpoint per ottenere la versione dell'API
@router.get("/version", response_model=VersionResponse)
def get_api_version():
    return {"version": os.getenv("API_VERSION", "unknown")}

#################################################
# Endpoint usato dall'HEALTHCHECK di Docker
@router.get("/health-check", response_model=HealthCheckResponse)
def get_health():
    return {"status": "Everything is OK", "version": os.getenv("API_VERSION", "unknown")}