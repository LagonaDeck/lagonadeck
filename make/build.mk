##@ Build et tests

build: ## Build les 5 projets
	@for p in $(PROJECTS); do echo "========= $$p ========="; (cd $$p && npm run build) || exit 1; done

test: ## Lance les tests d'identity-service, media-service, inventory-service et mail-service
	@for p in identity-service media-service inventory-service; do echo "========= $$p ========="; (cd $$p && npm test) || exit 1; done
	@$(call mail_service,uv run pytest)

.PHONY: build test
