##@ Build et tests

build: ## Build les 5 projets
	@for p in $(PROJECTS); do echo "========= $$p ========="; (cd $$p && npm run build) || exit 1; done

test: ## Lance les tests d'identity-service, media-service et inventory-service
	@for p in identity-service media-service inventory-service; do echo "========= $$p ========="; (cd $$p && npm test) || exit 1; done

.PHONY: build test
