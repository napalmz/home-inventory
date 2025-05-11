# Usa un'immagine di base con Python
FROM python:3.11-slim

# Imposta le variabili d'ambiente
ENV PYTHONDONTWRITEBYTECODE=1

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
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache

# Copia il codice dell'app
COPY . .

# Pulisci i file non necessari
RUN rm -f Dockerfile requirements.txt

# Esponi la porta 8000 per FastAPI
EXPOSE 8000

# Crea cartelle per i backup e imposta i permessi
RUN mkdir -p /app/backups && chmod 777 /app/backups

# Comando per avviare l'API
ENTRYPOINT ["/app/entrypoint.sh"]