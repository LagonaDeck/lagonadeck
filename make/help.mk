##@ Aide

help: ## Affiche cette aide
	@LC_ALL=C awk -f make/help.awk $(MAKEFILE_LIST)

.PHONY: help
