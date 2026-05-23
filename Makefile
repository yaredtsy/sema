.PHONY: dev dev-backend dev-frontend test seed types lint fmt

dev:
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals"

dev-backend:
	uv run uvicorn sace.api.app:create_app --factory --reload --app-dir backend

dev-frontend:
	cd frontend && npm run dev

test:
	uv run pytest
	cd frontend && npm run test --if-present

seed:
	uv run python scripts/seed_tree.py

types:
	uv run python scripts/gen_types.py

lint:
	uv run ruff check backend
	cd frontend && npm run lint --if-present

fmt:
	uv run ruff format backend
	cd frontend && npm run format --if-present
