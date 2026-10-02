##@ Aide

help: ## Affiche cette aide
	@awk -f make/help.awk $(MAKEFILE_LIST)

.PHONY: help
