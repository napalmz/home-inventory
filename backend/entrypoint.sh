#!/bin/sh

echo "📁 Creating /app/backups with 777 permissions..."
mkdir -p /app/backups
chmod 777 /app/backups

echo "🔄 Applying database migrations..."
alembic upgrade head

echo "🚀 Starting backend..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload