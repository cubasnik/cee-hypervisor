#!/bin/bash
cd "$(dirname "$0")"
export PYTHONPATH="$PWD:$PYTHONPATH"
echo "🚀 Запуск сервера с PYTHONPATH=$PYTHONPATH"
uvicorn app.main:app --reload --port 8000
