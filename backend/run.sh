#!/bin/bash
# Скрипт запуска backend с автоматической очисткой порта

PORT=${1:-8000}

echo "🔄 Stopping any existing uvicorn processes..."
pkill -9 -f "uvicorn.*${PORT}" 2>/dev/null
pkill -9 -f "python.*app.main" 2>/dev/null
sleep 1

echo "🚀 Starting backend on port ${PORT}..."
cd /mnt/c/Users/Alexey/Desktop/min/vNE/cee-hypervisor-v2/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
