##@ Installation

install: ## Installe les dépendances de chaque projet et les hooks lefthook
	@for p in $(PROJECTS); do echo "========= $$p ========="; (cd $$p && npm install) || exit 1; done
	@echo "========= lefthook ========="
	@npx --yes lefthook install

.PHONY: install
