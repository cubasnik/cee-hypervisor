.PHONY: help setup dev stop clean docker-up docker-down test

help:
	@echo "Доступные команды:"
	@echo "  make setup    - установка всех зависимостей"
	@echo "  make dev      - запуск в режиме разработки"
	@echo "  make stop     - остановка dev режима"
	@echo "  make docker-up  - запуск через Docker"
	@echo "  make docker-down - остановка Docker"
	@echo "  make test     - запуск тестов"
	@echo "  make clean    - очистка временных файлов"

setup:
	@echo "📦 Установка зависимостей..."
	@cd backend && python3 -m venv venv && . venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt
	@cd frontend && npm install
	@echo "✅ Готово"

dev:
	@./scripts/start-dev.sh

stop:
	@./scripts/stop-dev.sh

docker-up:
	@docker-compose up -d
	@echo "✅ Сервисы запущены: http://localhost:3000"

docker-down:
	@docker-compose down

test:
	@cd backend && pytest -v
	@cd frontend && npm test

clean:
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete
	@rm -rf backend/venv frontend/node_modules
	@echo "✅ Очистка завершена"
