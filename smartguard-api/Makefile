CHECK_DIRS := .

# --- Ruff ---

format-fix:
	uv run ruff format $(CHECK_DIRS) 
	uv run ruff check --select I --fix

lint-fix:
	uv run ruff check --fix

format-check:
	uv run ruff format --check $(CHECK_DIRS) 
	uv run ruff check -e
	uv run ruff check --select I -e

lint-check:
	uv run ruff check $(CHECK_DIRS)

# --- MCP Server ---

start-smartguard-api: stop-smartguard-api
	docker build -t smartguard-api . && \
	docker run -d -p 8080:8080 --name smartguard-api --env-file .env smartguard-api

stop-smartguard-api:
	docker stop smartguard-api || true && \
	docker rm smartguard-api || true
