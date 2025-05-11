# Usa un'immagine di base con Python
FROM python:3.11-slim

# Aggiungi repository PostgreSQL 17 in modo moderno e sicuro
RUN apt-get update && apt-get install -y wget gnupg lsb-release && \
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgres.gpg

# Install curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    postgresql-client-17 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Imposta la directory di lavoro nel container
WORKDIR /app

# Copia i file necessari
COPY requirements.txt .

# Installa le dipendenze
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice dell'app
COPY . .

# Esponi la porta 8000 per FastAPI
EXPOSE 8000

# Comando per avviare l'API
#CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
ENTRYPOINT ["/app/entrypoint.sh"]