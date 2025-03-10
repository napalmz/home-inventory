#!/bin/sh

echo "🔄 Applying database migrations..."
alembic upgrade head

echo "🚀 Starting backend..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload