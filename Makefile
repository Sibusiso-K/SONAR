# Common tasks. `make help` lists them.
.DEFAULT_GOAL := help
PY ?= python3

.PHONY: help install data lint test test-web e2e check audit smoke serve

help: ## Show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install Python dev tools and the web app's dependencies
	$(PY) -m pip install -r requirements-dev.txt
	cd web && bun install --frozen-lockfile

data: ## Regenerate opportunities.json and the calendar from the source data
	$(PY) scripts/migrate_to_opportunities.py
	$(PY) scripts/sonar.py ics

lint: ## Lint Python and the web app
	ruff check scripts tests
	cd web && bun run typecheck && bun run lint

test: ## Python tests (includes data-integrity checks)
	$(PY) -m pytest

test-web: ## Web unit tests
	cd web && bun run test

e2e: ## Browser end-to-end tests (builds the app, serves fixtures)
	cd web && bun run test:e2e

check: lint test test-web ## Everything fast: lint, types, unit and data tests

audit: ## Dependency and static security scans
	cd web && bun audit --audit-level=high
	bandit -q -r scripts -c pyproject.toml

smoke: ## Smoke-test a running site: make smoke URL=https://...
	$(PY) scripts/smoke_check.py $(URL)

serve: ## Build the web app for production and serve it locally on :4173
	cd web && bun run build:e2e && PORT=4173 HOST=127.0.0.1 node .output/server/index.mjs
