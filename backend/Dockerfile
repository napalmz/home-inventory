# Usa un'immagine di base con Python
FROM python:3.11-slim

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
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]