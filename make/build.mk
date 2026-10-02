##@ Build et tests

build: ## Build les 4 projets
	@for p in $(PROJECTS); do echo "========= $$p ========="; (cd $$p && npm run build) || exit 1; done

test: ## Lance les tests d'identity-service et media-service
	@for p in identity-service media-service; do echo "========= $$p ========="; (cd $$p && npm test) || exit 1; done

.PHONY: build test
