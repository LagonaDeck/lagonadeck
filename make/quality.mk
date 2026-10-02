##@ Qualité

format: ## Formate tout le dépôt avec Prettier
	@npx --yes prettier@3 --write .

lint: ## Lint les 4 projets avec ESLint
	@for p in $(PROJECTS); do echo "========= $$p ========="; (cd $$p && npm run lint) || exit 1; done

quality: ## Formate puis lint tout le dépôt
	@$(MAKE) format
	@$(MAKE) lint

.PHONY: format lint quality
