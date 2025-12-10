#!/usr/bin/env bash
set -e

VENV_DIR="venv"
REQ_FILE="requirements.txt"

# 1. crea venv se mancante
if [ ! -d "$VENV_DIR" ]; then
  echo "[setup] Creo virtualenv in $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

# 2. attiva venv
source "$VENV_DIR/bin/activate"

# 3. aggiorna pip
python -m pip install --upgrade pip wheel setuptools

# 4. requirements.txt di default se non presente
if [ ! -f "$REQ_FILE" ]; then
  echo "[setup] Creo requirements.txt di base"
  cat > "$REQ_FILE" <<'EOF'
fastapi
uvicorn
sqlalchemy
pydantic
psycopg2-binary
alembic
python-multipart
passlib[bcrypt]
python-jose[cryptography]
EOF
fi

# 5. installa pacchetti
echo "[setup] Installo dipendenze da $REQ_FILE"
pip install -r "$REQ_FILE"

echo "[setup] Ambiente pronto. Attivalo con:"
echo "source $VENV_DIR/bin/activate"