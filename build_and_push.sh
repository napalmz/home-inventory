#!/bin/bash

set -e  # Interrompe l'esecuzione in caso di errore

# Ottiene le versioni per backend e frontend
BACKEND_VERSION=$(grep '^API_VERSION=' backend/.env | cut -d '=' -f2)
FRONTEND_VERSION=$(jq -r '.version' frontend/package.json)

if [[ -z "$BACKEND_VERSION" || "$BACKEND_VERSION" == "null" ]]; then
  echo "Errore: impossibile ottenere la versione del Backend."
  exit 1
fi
if [[ -z "$FRONTEND_VERSION" || "$FRONTEND_VERSION" == "null" ]]; then
  echo "Errore: impossibile ottenere la versione del Frontend."
  exit 1
fi

echo "Ultima versione di Backend: $BACKEND_VERSION"
echo "Ultima versione di Frontend: $FRONTEND_VERSION"

# Esportiamo la versione come variabile globale per essere usata nei Dockerfile
export BACKEND_VERSION=$BACKEND_VERSION
export FRONTEND_VERSION=$FRONTEND_VERSION

PLATFORMS="linux/amd64,linux/arm64"

# Variabili per i tag
BACKEND_TAG_BASE="napalmzrpi/home-inventory-backend"
BACKEND_TAG_VERSION="$BACKEND_TAG_BASE:$BACKEND_VERSION"
BACKEND_TAG_LATEST="$BACKEND_TAG_BASE:latest"

FRONTEND_TAG_BASE="napalmzrpi/home-inventory-frontend"
FRONTEND_TAG_VERSION="$FRONTEND_TAG_BASE:$FRONTEND_VERSION"
FRONTEND_TAG_LATEST="$FRONTEND_TAG_BASE:latest"

# Funzione per chiedere conferma
ask_confirmation() {
  local prompt="$1 [Y/N] (default: N): "
  local response
  read -r -p "$prompt" response
  response=$(echo "$response" | tr '[:upper:]' '[:lower:]')  # Convertire in minuscolo

  if [[ "$response" == "y" ]]; then
    return 0  # Vero, esegui l'operazione
  else
    return 1  # Falso, salta l'operazione
  fi
}

# Chiedere se costruire l'immagine per Backend
if ask_confirmation "Vuoi costruire l'immagine per Backend?"; then
  echo "Costruzione dell'immagine per Backend..."
  cd backend || { echo "Directory backend non trovata"; exit 1; }
  docker buildx build --platform $PLATFORMS --build-arg BACKEND_VERSION=$BACKEND_VERSION \
    -t $BACKEND_TAG_VERSION \
    -t $BACKEND_TAG_LATEST \
    -f Dockerfile . --push
  BUILD_SERVER=true
  cd ../ || { echo "Directory principale non trovata"; exit 1; }
else
  echo "Costruzione dell'immagine per Backend saltato."
fi

# Chiedere se costruire l'immagine per Frontend
if ask_confirmation "Vuoi costruire l'immagine per Frontend?"; then
  echo "Costruzione dell'immagine per Frontend..."
  cd frontend || { echo "Directory frontend non trovata"; exit 1; }
  docker buildx build --platform $PLATFORMS --build-arg FRONTEND_VERSION=$FRONTEND_VERSION \
    -t $FRONTEND_TAG_VERSION \
    -t $FRONTEND_TAG_LATEST \
    -f Dockerfile . --push
  BUILD_AGENT=true
  cd ../ || { echo "Directory principale non trovata"; exit 1; }
else
  echo "Costruzione dell'immagine per Frontend saltato."
fi