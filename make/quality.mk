##@ Qualité

format: ## Formate tout le dépôt avec Prettier, et mail-service avec ruff
	@npx --yes prettier@3 --write .
	@$(call mail_service,uv run ruff format .)

lint: ## Lint les 5 projets avec ESLint, et mail-service avec ruff
	@for p in $(PROJECTS); do echo "========= $p ========="; (cd $p && npm run lint) || exit 1; done
	@$(call mail_service,uv run ruff check . && uv run ruff format --check .)

quality: ## Formate puis lint tout le dépôt
	@$(MAKE) format
	@$(MAKE) lint

.PHONY: format lint quality
